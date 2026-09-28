#!/bin/bash
# run-job-devin.sh <run_id> <kind: repo|program-id> <target> [cluster]
# Devin-engine job runner for the web casca (M1.5):
#   FETCH + STATIC are deterministic scripts (fast, free);
#   RESEARCH..REPORT are driven by a headless `devin -p` session running the
#   /cachorro-sol skill, which narrates the hunt into RUN_DIR/events.jsonl —
#   the live feed the UI renders.
# Falls back to the deterministic-only runner when the devin CLI is absent.
# Never leaves status 'running': any failure ends in status 'error'.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVIN_BIN="${DEVIN_BIN:-/root/.local/bin/devin}"
AI_TIMEOUT="${CACHORRO_AI_TIMEOUT:-5400}"

# scan modes: quick (top-1 survivor, ~40min cap), deep (top-3, default),
# full (all survivors, deepest). Mode tunes the AI timeout + engine guidance.
MODE_TIMEOUT() { case "$1" in quick) echo 2400 ;; full) echo 9000 ;; *) echo 5400 ;; esac; }

if [[ "${1:-}" != "--inner" ]]; then
  ID="${1:?run id}"; KIND="${2:?kind}"; TARGET="${3:?target}"; CLUSTER="${4:-mainnet}"; MODE="${5:-deep}"
  ST="$ROOT/cachorro-out/runs/$ID/status.json"
  OUTER=$(( ${CACHORRO_AI_TIMEOUT:-$(MODE_TIMEOUT "$MODE")} + 1200 ))
  timeout "$OUTER" bash "$ROOT/scripts/run-job-devin.sh" --inner "$ID" "$KIND" "$TARGET" "$CLUSTER" "$MODE"
  RC=$?
  python3 - "$ST" "$RC" "$OUTER" <<'PY'
import json, os, sys, tempfile, time
path, rc, outer = sys.argv[1], int(sys.argv[2]), sys.argv[3]
try:
    with open(path) as f: d = json.load(f)
except Exception:
    sys.exit(0)
if d.get('status') == 'running':
    d['status'] = 'error'
    d['error'] = 'timeout: job exceeded %ss' % outer if rc == 124 else 'runner exited with code %d' % rc
    d['updatedAt'] = int(time.time())
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
    with os.fdopen(fd, 'w') as f: json.dump(d, f, indent=2)
    os.replace(tmp, path)
PY
  exit 0
fi

shift
ID="${1:?run id}"; KIND="${2:?kind}"; TARGET="${3:?target}"; CLUSTER="${4:-mainnet}"; MODE="${5:-deep}"
AI_TIMEOUT="${CACHORRO_AI_TIMEOUT:-$(MODE_TIMEOUT "$MODE")}"
RUN="$ROOT/cachorro-out/runs/$ID"
ST="$RUN/status.json"
mkdir -p "$RUN"

jset() { bash "$ROOT/scripts/jset.sh" "$ST" "$@"; }
emit() { bash "$ROOT/scripts/emit-event.sh" "$RUN" "$@"; }
fail() { emit "engine" "runner" error "$1"; jset "status=error" "error=$1"; exit 1; }

# ---------- 1. FETCH (deterministic) ----------
jset "status=running" "stage=fetch" "stage.fetch=running" "engine=devin" "mode=$MODE"
emit fetch runner action "clonando alvo: $TARGET"
if [[ "$KIND" == "repo" ]]; then
  bash "$ROOT/scripts/fetch-target.sh" --repo "$TARGET" "$RUN" > "$RUN/fetch.log" 2>&1
else
  bash "$ROOT/scripts/fetch-target.sh" --program-id "$TARGET" "$CLUSTER" "$RUN" > "$RUN/fetch.log" 2>&1
fi
FETCH_RC=$?
if [[ "$KIND" == "repo" && ! -d "$RUN/repo" ]]; then
  jset "stage.fetch=error"
  fail "fetch failed: clone produced no repo (rc=$FETCH_RC)"
fi
jset "stage.fetch=done"
# record what we actually hunted — the upgrade monitor compares against this
if [[ -d "$RUN/repo" ]]; then
  REV=$(git -C "$RUN/repo" rev-parse HEAD 2>/dev/null || true)
elif [[ -f "$RUN/onchain/program.so" ]]; then
  REV=$(sha256sum "$RUN/onchain/program.so" | cut -d' ' -f1)
else
  REV=""
fi
[[ -n "$REV" ]] && jset "targetRev=$REV"
emit fetch runner obs "alvo baixado; $(du -sh "$RUN/repo" 2>/dev/null | cut -f1 || echo '?') de fonte"

# ---------- 2. STATIC (deterministic) ----------
jset "stage=static" "stage.static=running"
if [[ -d "$RUN/repo" ]]; then
  emit static runner action "lint Anchor/Rust + heurísticas de superfície"
  SKIP_CLIPPY=1 bash "$ROOT/scripts/static-scan.sh" "$RUN/repo" "$RUN" > "$RUN/static.log" 2>&1
  if [[ -f "$RUN/static/summary.txt" ]]; then
    jset "stage.static=done"
    emit static runner obs "$(grep -c ':' "$RUN/static/summary.txt" 2>/dev/null || echo '?') sinais no sumário estático"
  else
    jset "stage.static=error"
    fail "static scan produced no summary"
  fi
else
  echo "[~] bytecode only — no source, static skipped; provide the repo" > "$RUN/static.log"
  jset "stage.static=skipped" "staticNote=bytecode only — no source, static skipped; provide the repo"
  emit static runner note "só bytecode on-chain — sem fonte, análise vai ser rasa"
fi

# ---------- 3..8 AI stages — Devin drives ----------
if [[ ! -x "$DEVIN_BIN" ]]; then
  jset "stage.research=pending-ai" "stage.analyze=pending-ai" "stage.devil=pending-ai" \
       "stage.poc=pending-ai" "stage.review=pending-ai"
  emit engine runner error "devin CLI ausente — estágios de IA ficam pending"
  jset "stage=report" "stage.report=done" "stage=done" "status=done"
  exit 0
fi

emit engine runner action "devin assumindo — matilha solta nos estágios de IA"
MODE_GUIDE="Modo DEEP (padrão): fan-out por cluster se o alvo for grande; PoC dos top-3 survivors."
case "$MODE" in
  quick) MODE_GUIDE="Modo QUICK: sem fan-out — um passe de ANALYZE focado nas classes T1/T2 do atlas, DEVIL só nos candidatos critical/high, PoC do top-1 survivor apenas. Velocidade > cobertura." ;;
  full)  MODE_GUIDE="Modo FULL: fan-out por cluster obrigatório, DEVIL em dois passes (segundo passe re-lê os killed buscando ressurreição válida), PoC de TODOS os survivors ordenados por severidade. Cobertura > velocidade." ;;
esac
PROMPT="Leia $ROOT/.devin/skills/cachorro-sol/SKILL.md e execute o pipeline /cachorro-sol para o alvo $TARGET com RUN_DIR=$RUN e TARGET_DIR=$RUN/repo (fetch e static já feitos — vá direto pro estágio 3 RESEARCH). $MODE_GUIDE Siga o contrato de observabilidade do skill ao pé da letra: jset nos estágios e emit-event a cada passo. Trabalhe de forma autônoma até o REPORT; não peça confirmação."

timeout "$AI_TIMEOUT" "$DEVIN_BIN" -p "$PROMPT" \
  --permission-mode bypass \
  --respect-workspace-trust false \
  > "$RUN/devin.log" 2>&1
DEVIN_RC=$?

# If devin finished cleanly it already set status=done; only patch leftovers.
python3 - "$ST" "$DEVIN_RC" <<'PY'
import json, os, sys, tempfile, time
path, rc = sys.argv[1], int(sys.argv[2])
try:
    with open(path) as f: d = json.load(f)
except Exception:
    sys.exit(0)
if d.get('status') == 'running':
    if rc == 124:
        d['error'] = 'devin session exceeded AI timeout'
    elif rc != 0:
        d['error'] = 'devin exited with code %d (see devin.log)' % rc
    else:
        d['error'] = 'devin finished without closing the run'
    d['status'] = 'error'
d['updatedAt'] = int(time.time())
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
with os.fdopen(fd, 'w') as f: json.dump(d, f, indent=2)
os.replace(tmp, path)
PY

# ---------- 9. ATTEST (deterministic post-step, best-effort) ----------
# Hunt is closed; if it produced a report, anchor the receipt on devnet.
# Fails soft (unfunded keypair -> attestStatus=unfunded), never changes
# the hunt outcome.
if grep -q '"status": *"done"' "$ST" 2>/dev/null; then
  bash "$ROOT/scripts/attest-run.sh" "$ID" || true
fi
exit 0

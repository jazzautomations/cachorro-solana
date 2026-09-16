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

if [[ "${1:-}" != "--inner" ]]; then
  ID="${1:?run id}"; KIND="${2:?kind}"; TARGET="${3:?target}"; CLUSTER="${4:-mainnet}"
  ST="$ROOT/cachorro-out/runs/$ID/status.json"
  timeout 7200 bash "$ROOT/scripts/run-job-devin.sh" --inner "$ID" "$KIND" "$TARGET" "$CLUSTER"
  RC=$?
  python3 - "$ST" "$RC" <<'PY'
import json, os, sys, tempfile, time
path, rc = sys.argv[1], int(sys.argv[2])
try:
    with open(path) as f: d = json.load(f)
except Exception:
    sys.exit(0)
if d.get('status') == 'running':
    d['status'] = 'error'
    d['error'] = 'timeout: job exceeded 7200s' if rc == 124 else 'runner exited with code %d' % rc
    d['updatedAt'] = int(time.time())
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
    with os.fdopen(fd, 'w') as f: json.dump(d, f, indent=2)
    os.replace(tmp, path)
PY
  exit 0
fi

shift
ID="${1:?run id}"; KIND="${2:?kind}"; TARGET="${3:?target}"; CLUSTER="${4:-mainnet}"
RUN="$ROOT/cachorro-out/runs/$ID"
ST="$RUN/status.json"
mkdir -p "$RUN"

jset() { bash "$ROOT/scripts/jset.sh" "$ST" "$@"; }
emit() { bash "$ROOT/scripts/emit-event.sh" "$RUN" "$@"; }
fail() { emit "engine" "runner" error "$1"; jset "status=error" "error=$1"; exit 1; }

# ---------- 1. FETCH (deterministic) ----------
jset "status=running" "stage=fetch" "stage.fetch=running" "engine=devin"
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
PROMPT="Leia $ROOT/.devin/skills/cachorro-sol/SKILL.md e execute o pipeline /cachorro-sol para o alvo $TARGET com RUN_DIR=$RUN e TARGET_DIR=$RUN/repo (fetch e static já feitos — vá direto pro estágio 3 RESEARCH). Siga o contrato de observabilidade do skill ao pé da letra: jset nos estágios e emit-event a cada passo. Trabalhe de forma autônoma até o REPORT; não peça confirmação."

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
exit 0

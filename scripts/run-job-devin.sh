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
DEVIN_BIN="${DEVIN_BIN:-$(command -v devin 2>/dev/null || echo /root/.local/bin/devin)}"
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
    os.chmod(tmp, 0o644)  # mkstemp makes 0600 — hunts run as root, the web reads as ubuntu
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
elif [[ "$KIND" == "site" ]]; then
  emit fetch runner action "recon black-box GET-only: $TARGET"
  bash "$ROOT/scripts/fetch-target.sh" --site "$TARGET" "$RUN" > "$RUN/fetch.log" 2>&1
else
  bash "$ROOT/scripts/fetch-target.sh" --program-id "$TARGET" "$CLUSTER" "$RUN" > "$RUN/fetch.log" 2>&1
fi
FETCH_RC=$?
# artifact checks below are the source of truth — fetch-target.sh can exit
# non-zero after a successful clone (last grep probe), and --site now only
# creates the dir after the SSRF guard passes, so a missing dir IS the refusal
if [[ "$KIND" == "repo" && ! -d "$RUN/repo" ]]; then
  jset "stage.fetch=error"
  fail "fetch failed: clone produced no repo (rc=$FETCH_RC)"
fi
if [[ "$KIND" == "site" && ! -d "$RUN/site" ]]; then
  jset "stage.fetch=error"
  fail "fetch failed: site recon produced nothing (rc=$FETCH_RC)"
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
if [[ "$KIND" == "site" ]]; then
  PROMPT="Leia $ROOT/.devin/skills/cachorro-sol/SKILL.md e execute o pipeline /cachorro-sol para o alvo $TARGET com RUN_DIR=$RUN e TARGET_DIR=$RUN/site — alvo é um SITE (black-box web). Fetch e static já feitos; TARGET_DIR contém index.html, headers, probe_paths.txt e js/*. Use o pipeline de forma adaptada: RESEARCH identifica stack/provedor de auth/endpoints; ANALYZE caça classes web2↔web3 + AI (atlas); DEVIL tenta matar; PoC = requests curl reproduzíveis (GET apenas, nada destrutivo — race, IDOR-read, header smudge). $MODE_GUIDE jset/emit-event a cada passo. Autônomo até o REPORT."
else
  PROMPT="Leia $ROOT/.devin/skills/cachorro-sol/SKILL.md e execute o pipeline /cachorro-sol para o alvo $TARGET com RUN_DIR=$RUN e TARGET_DIR=$RUN/repo (fetch e static já feitos — vá direto pro estágio 3 RESEARCH). $MODE_GUIDE Siga o contrato de observabilidade do skill ao pé da letra: jset nos estágios e emit-event a cada passo. Trabalhe de forma autônoma até o REPORT; não peça confirmação."
fi

# ── untrusted hunts run the AI stage inside a mount+user namespace ──────────
# anonymous targets are attacker-controlled content: prompt injection is a
# real RCE vector. the devin stage drops to uid nobody inside a namespace
# where /root and system secrets are bind-hidden, env is clean, and exec is
# gated by the fast model ("smart" mode). trusted hunts keep the fast path.
TRUST="${6:-untrusted}"
if [[ "$TRUST" == "untrusted" ]]; then
  SBX=/var/lib/cachorro-sandbox
  install -d -m 0755 "$SBX/work" "$SBX/home" "$SBX/bin" "$SBX/install" /var/lib/cachorro-empty
  cp -a /root/.config/devin "$SBX/home/.config-devin" 2>/dev/null || true
  mkdir -p "$SBX/home/.local/share"
  cp -a /root/.local/share/devin "$SBX/home/.local/share/" 2>/dev/null || true
  chmod -R a+rwX "$SBX/home" 2>/dev/null || true
  chmod -R a+rwX "$RUN"
  # DEVIN_BIN is usually a symlink into ~/.local/share/devin — inside the
  # namespace /root is hidden, so the symlink dangles (exec ENOENT). Bind the
  # resolved install tree at $SBX/install and point SBX_DEVIN at the real file.
  DEVIN_REAL="$(readlink -f "$DEVIN_BIN")"
  if [[ "$DEVIN_REAL" == /root/.local/share/devin/* ]]; then
    export SBX_DEVIN_SRC="/root/.local/share/devin"
    export SBX_DEVIN="$SBX/install/${DEVIN_REAL#/root/.local/share/devin/}"
  else
    export SBX_DEVIN_SRC="$(dirname "$DEVIN_REAL")"
    export SBX_DEVIN="$SBX/install/$(basename "$DEVIN_REAL")"
  fi
  export SBX_PROMPT="${PROMPT//$ROOT/$SBX/work}"
  export SBX_ROOT="$ROOT" SBX_AIT="$AI_TIMEOUT"
  unshare -m bash -c '
    mount --bind "$SBX_ROOT" /var/lib/cachorro-sandbox/work &&
    mount --bind "$SBX_DEVIN_SRC" /var/lib/cachorro-sandbox/install &&
    mount -o remount,ro,bind /var/lib/cachorro-sandbox/install &&
    ln -sfn "$SBX_DEVIN" /var/lib/cachorro-sandbox/bin/devin &&
    mount --bind /var/lib/cachorro-empty /root &&
    mount --bind /var/lib/cachorro-empty /etc/systemd/system &&
    mkdir -p /var/lib/cachorro-sandbox/home/.config &&
    ln -sfn /var/lib/cachorro-sandbox/home/.config-devin /var/lib/cachorro-sandbox/home/.config/devin &&
    cd /var/lib/cachorro-sandbox/work &&
    exec setpriv --reuid 65534 --regid 65534 --init-groups \
      env -i HOME=/var/lib/cachorro-sandbox/home PATH=/var/lib/cachorro-sandbox/bin:/usr/local/bin:/usr/bin:/bin \
      timeout "$SBX_AIT" "$SBX_DEVIN" -p "$SBX_PROMPT" \
      --permission-mode dangerous --respect-workspace-trust false
  ' > "$RUN/devin.log" 2>&1
  DEVIN_RC=$?
else
  timeout "$AI_TIMEOUT" "$DEVIN_BIN" -p "$PROMPT" \
    --permission-mode bypass \
    --respect-workspace-trust false \
    > "$RUN/devin.log" 2>&1
  DEVIN_RC=$?
fi

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
os.chmod(tmp, 0o644)  # mkstemp makes 0600 — hunts run as root, the web reads as ubuntu
os.replace(tmp, path)
PY

# ---------- 9. ATTEST (deterministic post-step, best-effort) ----------
# Hunt is closed; if it produced a report, anchor the receipt on devnet.
# Fails soft (unfunded keypair -> attestStatus=unfunded), never changes
# the hunt outcome.
if grep -q '"status": *"done"' "$ST" 2>/dev/null; then
  # jev second opinion — calibrated plausibility on every promoted claim
  if [[ -f /root/.secrets-typesafe ]]; then
    python3 "$ROOT/scripts/jev-judge.py" "$RUN" --emit >/dev/null 2>&1 || true
  fi
  # self-audit before the anchor — tripwire flags become part of the receipt's journal
  python3 "$ROOT/scripts/tripwires-hunt.py" "$RUN" --emit >/dev/null 2>&1 || true
  SA=$(python3 - "$RUN/self_audit.json" <<'PY2'
import json, sys
try:
    d = json.load(open(sys.argv[1])); print("clean" if d["clean"] else "%d flags" % len(d["flags"]))
except Exception: print("skipped")
PY2
)
  jset "selfAudit=$SA"
  bash "$ROOT/scripts/attest-run.sh" "$ID" || true
fi
exit 0

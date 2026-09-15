#!/bin/bash
# run-job.sh <run_id> <kind: repo|program-id> <target> [cluster]
# Deterministic job runner for the web casca (M0): FETCH + STATIC only.
# AI stages (research/analyze/devil/poc/review) stay 'pending-ai' until M1.
# Never leaves status 'running': any failure ends in status 'error'.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" != "--inner" ]]; then
  ID="${1:?run id}"; KIND="${2:?kind}"; TARGET="${3:?target}"; CLUSTER="${4:-mainnet}"
  ST="$ROOT/cachorro-out/runs/$ID/status.json"
  timeout 600 bash "$ROOT/scripts/run-job.sh" --inner "$ID" "$KIND" "$TARGET" "$CLUSTER"
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
    d['error'] = 'timeout: job exceeded 600s' if rc == 124 else 'runner exited with code %d' % rc
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

# atomic status.json patch: jset key=value ... ("stage.<name>=value" writes into stages{})
jset() {
  python3 - "$ST" "$@" <<'PY'
import json, os, sys, tempfile, time
path = sys.argv[1]
try:
    with open(path) as f: d = json.load(f)
except Exception:
    d = {}
d.setdefault('stages', {})
for p in sys.argv[2:]:
    k, v = p.split('=', 1)
    if k.startswith('stage.'):
        d['stages'][k[6:]] = v
    else:
        d[k] = v
d['updatedAt'] = int(time.time())
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
with os.fdopen(fd, 'w') as f: json.dump(d, f, indent=2)
os.replace(tmp, path)
PY
}

fail() { jset "status=error" "error=$1"; exit 1; }

# ---------- 1. FETCH ----------
jset "status=running" "stage=fetch" "stage.fetch=running"
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

# ---------- 2. STATIC ----------
jset "stage=static" "stage.static=running"
if [[ -d "$RUN/repo" ]]; then
  SKIP_CLIPPY=1 bash "$ROOT/scripts/static-scan.sh" "$RUN/repo" "$RUN" > "$RUN/static.log" 2>&1
  if [[ -f "$RUN/static/summary.txt" ]]; then
    jset "stage.static=done"
  else
    jset "stage.static=error"
    fail "static scan produced no summary"
  fi
else
  echo "[~] bytecode only — no source, static skipped; provide the repo" > "$RUN/static.log"
  jset "stage.static=skipped" "staticNote=bytecode only — no source, static skipped; provide the repo"
fi

# ---------- 3..7 AI stages (land in M1) ----------
jset "stage.research=pending-ai" "stage.analyze=pending-ai" "stage.devil=pending-ai" \
     "stage.poc=pending-ai" "stage.review=pending-ai"

# ---------- 8. REPORT ----------
jset "stage=report" "stage.report=done"
jset "stage=done" "status=done"
exit 0

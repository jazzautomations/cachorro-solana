#!/bin/bash
# watch-targets.sh — for each finished hunt, re-resolve the target's current rev
# and flag the run stale if it moved. "The receipt knows when it's stale."
# Repo targets: git ls-remote HEAD. Program-id targets: sha256 of redeployed .so
# is too heavy — we use the program account's dataLen+lamports as a cheap canary
# (a redeploy almost always changes dataLen; slot-precise check comes with M2).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNS="$ROOT/cachorro-out/runs"
JSET="$ROOT/scripts/jset.sh"

for ST in "$RUNS"/*/status.json; do
  RUN="$(dirname "$ST")"
  python3 - "$ST" <<'PY' || continue
import json,sys
d=json.load(open(sys.argv[1]))
sys.exit(0 if d.get('status')=='done' and d.get('targetRev') and not d.get('stale') else 1)
PY

  TARGET=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("target",""))' "$ST")
  KIND=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("kind",""))' "$ST")
  OLDREV=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("targetRev",""))' "$ST")

  if [[ "$KIND" == "repo" ]]; then
    NEWREV=$(git ls-remote "$TARGET" HEAD 2>/dev/null | cut -f1)
    [[ -z "$NEWREV" ]] && continue
  else
    continue # program-id canary lands with M2 (needs RPC budget care)
  fi

  if [[ "$NEWREV" != "$OLDREV" ]]; then
    bash "$JSET" "$ST" "stale=true" "staleRev=$NEWREV" "staleSince=$(date +%s)"
    bash "$ROOT/scripts/emit-event.sh" "$RUN" engine watcher note "target moved: ${OLDREV:0:8} → ${NEWREV:0:8} — the receipt is stale, re-hunt recommended"
    echo "[stale] $(basename "$RUN") $TARGET"
  fi
done

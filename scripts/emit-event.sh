#!/bin/bash
# emit-event.sh <RUN_DIR> <stage> <agent> <kind> <text...>
# Appends one JSONL entry to RUN_DIR/events.jsonl — the live "what the pack is
# thinking" feed the web UI renders next to the stage flow.
# kind: thought | action | obs | finding | verdict | poc | note | error
set -uo pipefail
RUN="${1:?run dir}"; STAGE="${2:?stage}"; AGENT="${3:?agent}"; KIND="${4:?kind}"; shift 4
mkdir -p "$RUN"
python3 - "$RUN/events.jsonl" "$STAGE" "$AGENT" "$KIND" "$*" <<'PY'
import json, sys, time
path, stage, agent, kind, text = sys.argv[1:6]
rec = {"ts": int(time.time()), "stage": stage, "agent": agent,
       "kind": kind, "text": text[:2000]}
with open(path, "a") as f:
    f.write(json.dumps(rec, ensure_ascii=False) + "\n")
PY

# critical alert: fire-and-forget webhook on critical findings/verdicts
if [[ -n "${CACHORRO_ALERT_URL:-}" ]] && [[ "$KIND" =~ ^(finding|verdict|poc)$ ]] && echo "$*" | grep -qiE 'critical|cr[ií]tico'; then
  curl -s -m 5 -X POST "$CACHORRO_ALERT_URL" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"run":sys.argv[1],"stage":sys.argv[2],"agent":sys.argv[3],"text":" ".join(sys.argv[4:])[:500]}))' "$(basename "$RUN")" "$STAGE" "$AGENT" "$@")" \
    >/dev/null 2>&1 &
fi
exit 0

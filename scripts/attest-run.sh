#!/bin/bash
# attest-run.sh <run_id> — anchor a finished hunt's report on devnet.
# Deterministic post-step (not an agent stage): runs after status=done.
# NEVER fails the run — unfunded keypair or RPC errors degrade to
# attestStatus=unfunded and a note in the feed, hunt stays done.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ID="${1:?run id}"
RUN="$ROOT/cachorro-out/runs/$ID"
ST="$RUN/status.json"
ATTEST="$ROOT/attest/bin/attest.js"

jset() { bash "$ROOT/scripts/jset.sh" "$ST" "$@"; }
emit() { bash "$ROOT/scripts/emit-event.sh" "$RUN" "$@"; }

[[ -f "$ST" ]] || { echo "no status.json for $ID"; exit 0; }
[[ -x "$(command -v node)" || -f "$ATTEST" ]] || { echo "attest cli missing"; exit 0; }

# pull what we need out of status.json
mapfile -t F < <(python3 - "$ST" <<'PY'
import json, sys
from datetime import datetime, timezone
d = json.load(open(sys.argv[1]))
ts = d.get("createdAt")
iso = datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00","Z") if ts else ""
for v in (d.get("status",""), d.get("target",""), d.get("targetRev",""), d.get("reportFile",""), iso):
    print(v)
PY
)
STATUS="${F[0]:-}"; TARGET="${F[1]:-}"; REV="${F[2]:-}"; REPORT="${F[3]:-}"; CREATED="${F[4]:-}"

[[ "$STATUS" == "done" ]] || { echo "run $ID not done ($STATUS) — skipping attest"; exit 0; }
if [[ -z "$REPORT" || ! -f "$RUN/$REPORT" ]]; then
  emit attest runner note "sem report file — recibo não ancorado"
  jset "attestStatus=skipped"
  exit 0
fi

# journal head for the run = hash-chain over the events log (each line is a
# record; head binds the whole feed to the receipt)
JHEAD=$(python3 - "$RUN/events.jsonl" <<'PY'
import hashlib, sys
h = b"\x00" * 32
try:
    with open(sys.argv[1], "rb") as f:
        for line in f:
            if line.strip():
                h = hashlib.sha256(h + line.rstrip(b"\n")).digest()
except FileNotFoundError:
    pass
print(h.hex())
PY
)

# no recorded rev (corpus / ad-hoc dir): bind the receipt to the audited
# file tree instead — sha256 over the sorted per-file digests
if [[ -z "$REV" && -d "$RUN/repo" ]]; then
  REV="tree:$(find "$RUN/repo" -type f -not -path '*/.git/*' -print0 | sort -z | xargs -0 sha256sum 2>/dev/null | sha256sum | cut -d' ' -f1)"
elif [[ -z "$REV" && -d "$RUN" ]]; then
  REV="tree:$(find "$RUN" -maxdepth 1 -type f -print0 | sort -z | xargs -0 sha256sum 2>/dev/null | sha256sum | cut -d' ' -f1)"
fi
[[ -z "$REV" ]] && REV="unknown"

emit attest runner action "ancorando recibo on-chain — memo cachorro:v1:<digest> no devnet"
jset "attestStatus=anchoring"

ARGS=(anchor "$RUN/$REPORT" --target "$TARGET" --journal-head "$JHEAD" ${CREATED:+--created-at "$CREATED"})
[[ -n "$REV" ]] && ARGS+=(--commit "$REV")

OUT=$(cd "$ROOT/attest" && node bin/attest.js "${ARGS[@]}" 2>&1)
RC=$?
echo "$OUT" > "$RUN/attest.log"

if [[ $RC -ne 0 || ! "$OUT" =~ ANCHORED ]]; then
  # keep an anchor-ready local receipt so /report + /verify can show the
  # pending attestation — the digest binds report bytes + commit + journal
  DARGS=(digest "$RUN/$REPORT" --target "$TARGET" --journal-head "$JHEAD" ${CREATED:+--created-at "$CREATED"})
  [[ -n "$REV" ]] && DARGS+=(--commit "$REV")
  DOUT=$(cd "$ROOT/attest" && node bin/attest.js "${DARGS[@]}" 2>&1) || true
  DSHA=$(echo "$DOUT" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("attestation_sha256",""))
except Exception: print("")' 2>/dev/null)
  emit attest runner note "anchor falhou (keypair sem saldo ou faucet/RPC) — recibo fica pending, anchor-ready"
  if [[ -n "$DSHA" ]]; then
    jset "attestStatus=pending" "attestation=$DSHA"
  else
    jset "attestStatus=unfunded"
  fi
  exit 0
fi

read -r SHA SIG URL < <(python3 - "$OUT" <<'PY2'
import re, sys
out = sys.argv[1]
def grab(k):
    m = re.search(rf"{k}\s*:\s*(\S+)", out)
    return m.group(1) if m else ""
print(grab("attestation_sha"), grab("signature"), grab("explorer"))
PY2
)

jset "attestStatus=anchored" "attestation=$SHA" "attestationSig=$SIG" "attestationUrl=$URL"
emit attest runner verdict "recibo ancorado on-chain — memo cachorro:v1:${SHA:0:8}… sig ${SIG:0:12}…"
echo "anchored $SHA $SIG"

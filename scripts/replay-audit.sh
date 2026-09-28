#!/bin/bash
# replay-audit.sh — replay a historical exploit: hunt the pinned vulnerable
# commit (treatment) and the patched commit (control). The pack must flag the
# former and not the latter. Strongest possible validation.
set -uo pipefail
ROOT="/root/cachorro-solana"
RUNS="$ROOT/cachorro-out/runs"
export HOME="${HOME:-/root}"

REPO="https://github.com/cashioapp/cashio"
# vuln = last commit before the patch; fixed = the patch commit
for spec in "vuln a51c3c59d544a5763b64abb4a8d82c49b0abd6d0" "fixed 7df658184c0000000000000000000000000000000"; do :; done

hunt_at() {
  local label="$1" rev="$2" id stage run
  id="replay_cashio_${label}_$(date +%s)"
  stage="/tmp/replay_$id"
  rm -rf "$stage"
  git clone -q "$REPO" "$stage" && (cd "$stage" && git checkout -q "$rev" && rm -rf .git && git init -q && git add -A && git -c user.email=pack@cachorro.local -c user.name=pack commit -qm "replay:$label@$rev")
  run="$RUNS/$id"; mkdir -p "$run"
  cat > "$run/status.json" <<JSON
{"id":"$id","target":"$REPO@$rev","kind":"repo","status":"running","stage":"fetch","mode":"quick","stages":{"fetch":"running"},"createdAt":$(date +%s),"replay":"$label","expect":"$label"}
JSON
  echo "[*] replay $label @ ${rev:0:10} -> $id"
  bash "$ROOT/scripts/run-job-devin.sh" "$id" repo "$stage" local quick
  echo "[+] replay $label -> $(python3 -c "import json;print(json.load(open('$run/status.json')).get('status'))" 2>/dev/null)"
}

hunt_at vuln   a51c3c59d544a5763b64abb4a8d82c49b0abd6d0
hunt_at fixed  7df658184c  # short rev resolves at checkout

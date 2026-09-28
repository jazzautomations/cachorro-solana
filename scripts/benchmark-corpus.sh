#!/bin/bash
# benchmark-corpus.sh — run the pack against seeded sealevel-attacks variants.
# Insecure variants MUST be flagged; secure/recommended MUST come back clean.
# Produces the public metric: "X/Y seeded bugs caught, 0 false alarms".
set -uo pipefail
ROOT="/root/cachorro-solana"
CORPUS="$ROOT/corpus/sealevel-attacks"
RUNS="$ROOT/cachorro-out/runs"
mkdir -p "$RUNS"
export HOME="${HOME:-/root}"

declare -a CASES=(
  "0-signer-authorization/insecure signer-authorization"
  "5-arbitrary-cpi/insecure arbitrary-cpi"
  "9-closing-accounts/insecure closing-accounts"
  "0-signer-authorization/secure signer-authorization"
  "5-arbitrary-cpi/recommended arbitrary-cpi"
)

for spec in "${CASES[@]}"; do
  read -r variant expect <<<"$spec"
  src="$CORPUS/$variant"
  [[ -d "$src" ]] || { echo "[~] missing $src"; continue; }
  id="bench_$(date +%s)_$(echo "$variant" | tr '/-' '__')"

  # stage the variant as its own git repo (receipt binds a real commit)
  stage="/tmp/bench_$id"
  rm -rf "$stage"; mkdir -p "$stage"
  cp -r "$src"/. "$stage/"
  (cd "$stage" && git init -q && git add -A && git -c user.email=pack@cachorro.local -c user.name=pack commit -qm "variant: $variant")
  run="$RUNS/$id"; mkdir -p "$run"
  cat > "$run/status.json" <<JSON
{"id":"$id","target":"$variant","kind":"repo","status":"running","stage":"fetch","mode":"quick","stages":{"fetch":"running"},"createdAt":$(date +%s),"expect":"$expect","benchmark":true}
JSON
  echo "[*] hunting $variant -> $id (expect $expect)"
  bash "$ROOT/scripts/run-job-devin.sh" "$id" repo "$stage" local quick
  echo "[+] done $variant -> $(python3 -c "import json;print(json.load(open('$run/status.json')).get('status'))" 2>/dev/null)"
done
echo "BENCHMARK COMPLETE"

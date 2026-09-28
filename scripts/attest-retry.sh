#!/bin/bash
# attest-retry.sh — re-run attest for hunts whose receipts are pending.
# Cheap: skips fast unless attestStatus=pending. Timer-driven, hourly.
set -uo pipefail
ROOT="/root/cachorro-solana"
for st in "$ROOT"/cachorro-out/runs/*/status.json; do
  grep -q "\"attestStatus\": *\"pending\"" "$st" 2>/dev/null || continue
  id=$(basename "$(dirname "$st")")
  bash "$ROOT/scripts/attest-run.sh" "$id" >/dev/null 2>&1 || true
done
exit 0

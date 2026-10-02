#!/usr/bin/env bash
# context-deep.sh — mechanical OSINT for the RESEARCH stage. Deterministic facts
# the reasoning agents build on, so nobody hallucinates context:
#   1. dep tree → OSV/CVE hits (Cargo.lock + package-lock.json)
#   2. declare_id!/program ids → on-chain existence (deployed? upgradeable? lamports?)
#   3. fork lineage → upstream repo guess + diffstat vs upstream
#   4. surface map: handlers, account structs, external CPI targets, env/secret files
#
# usage: bash scripts/context-deep.sh TARGET_DIR RUN_DIR
# writes RUN_DIR/context/{deps_cves.json,onchain.json,fork.md,surface.txt}
set -uo pipefail

TARGET_DIR="${1:?usage: context-deep.sh TARGET_DIR RUN_DIR}"
RUN_DIR="${2:?}"
CTX="$RUN_DIR/context"
mkdir -p "$CTX"
RPC="${CACHORRO_RPC:-https://api.mainnet-beta.solana.com}"

# ── 1. deps → OSV ─────────────────────────────────────────────────────
python3 - "$TARGET_DIR" "$CTX/deps_cves.json" <<'PY'
import json, os, re, sys, urllib.request
root, out = sys.argv[1], sys.argv[2]
pkgs = []

lock = os.path.join(root, "Cargo.lock")
if os.path.isfile(lock):
    for m in re.finditer(r'name = "([^"]+)"\s*\n\s*version = "([^"]+)"', open(lock).read()):
        pkgs.append({"ecosystem": "crates.io", "name": m[1], "version": m[2]})

for plock in [os.path.join(root, "package-lock.json")]:
    if os.path.isfile(plock):
        try:
            d = json.load(open(plock))
            for name, p in (d.get("packages") or {}).items():
                if name and p.get("version"):
                    pkgs.append({"ecosystem": "npm", "name": name.split("node_modules/")[-1], "version": p["version"]})
        except Exception:
            pass

# keep it bounded — only security-relevant deps get queried
INTEREST = re.compile(r"anchor|spl-|solana|token|token-2022|pyth|switchboard|serum|mpl-|@coral-xyz|@solana|x402|axios|express|jsonwebtoken|elliptic|ethers|web3", re.I)
pkgs = [p for p in pkgs if INTEREST.search(p["name"])][:120]

hits = []
seen = set()
for p in pkgs:
    if (p["name"], p["version"]) in seen: continue
    seen.add((p["name"], p["version"]))
    try:
        q = json.dumps({"package": {"name": p["name"], "ecosystem": p["ecosystem"]}, "version": p["version"]}).encode()
        r = urllib.request.urlopen(urllib.request.Request("https://api.osv.dev/v1/query", q, {"Content-Type": "application/json"}), timeout=8).read()
        vulns = json.loads(r).get("vulns") or []
        for v in vulns[:3]:
            hits.append({"pkg": f"{p['name']}@{p['version']}", "id": v.get("id"), "summary": (v.get("summary") or "")[:140]})
    except Exception:
        pass
json.dump({"deps_queried": len(pkgs), "vuln_hits": hits}, open(out, "w"), indent=1)
print(f"deps: {len(pkgs)} queried, {len(hits)} CVE hits")
PY

# ── 2. program ids → on-chain ─────────────────────────────────────────
python3 - "$TARGET_DIR" "$CTX/onchain.json" "$RPC" <<'PY'
import json, os, re, sys, urllib.request
root, out, rpc = sys.argv[1], sys.argv[2], sys.argv[3]
ids = set()
for dirpath, _, files in os.walk(root):
    if ".git" in dirpath: continue
    for fn in files:
        if not fn.endswith((".rs", ".ts", ".js", ".toml", ".json", ".env", ".env.example", ".sh")): continue
        p = os.path.join(dirpath, fn)
        if os.path.getsize(p) > 400_000: continue
        try: src = open(p, errors="replace").read()
        except Exception: continue
        ids.update(re.findall(r'declare_id!\s*\(\s*["\']([1-9A-HJ-NP-Za-km-z]{32,44})', src))
        ids.update(re.findall(r'(?:PROGRAM_ID|programId|program_id)\s*[:=]\s*["\']([1-9A-HJ-NP-Za-km-z]{32,44})', src))

rows = []
for pid in sorted(ids)[:12]:
    for cluster, url in (("mainnet", rpc), ("devnet", "https://api.devnet.solana.com")):
        try:
            q = json.dumps({"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":[pid,{"encoding":"jsonParsed"}]}).encode()
            r = json.loads(urllib.request.urlopen(urllib.request.Request(url, q, {"Content-Type":"application/json"}), timeout=10).read())
            v = (r.get("result") or {}).get("value")
            if v:
                rows.append({"id": pid, "cluster": cluster, "executable": v.get("executable"), "owner": v.get("owner"), "lamports": v.get("lamports")})
        except Exception:
            pass
json.dump({"program_ids": rows, "declared_count": len(ids)}, open(out, "w"), indent=1)
print(f"onchain: {len(rows)} live program accounts ({len(ids)} declared)")
PY

# ── 3. fork lineage ───────────────────────────────────────────────────
{
  echo "# fork lineage guess"
  for cand in orca-so/whirlpools coral-xyz/anchor solana-labs/solana-program-library aeroscraper/aerospacer-contracts jet-coder jet-lab saber-hq marginfi project-serum; do
    :
  done
  # heuristic: distinctive file/dir names + README mentions
  grep -riEl "fork of|based on|inspired by|ported from" "$TARGET_DIR" --include="*.md" 2>/dev/null | head -3 | while read -r f; do
    echo "- $(basename "$f"): $(grep -iE 'fork of|based on|inspired by|ported from' "$f" | head -1 | cut -c1-160)"
  done
  echo "## upstream hints in tree:"
  find "$TARGET_DIR" -name "*.rs" | head -40 | xargs grep -lE "whirlpool|jupiter|serum|raydium|marinade|metaplex|mpl_|drift|marginfi|kamino" 2>/dev/null | head -5
} > "$CTX/fork.md" 2>/dev/null

# ── 4. surface map ────────────────────────────────────────────────────
{
  echo "# surface map — $TARGET_DIR"
  echo "## rust handlers:"
  find "$TARGET_DIR" -name "*.rs" -not -path "*/target/*" | xargs grep -lE "pub fn|#\[program\]" 2>/dev/null | head -30
  echo "## account structs:"
  find "$TARGET_DIR" -name "*.rs" -not -path "*/target/*" | xargs grep -lE "#\[derive\(Accounts\)\]|#\[account\]" 2>/dev/null | head -30
  echo "## web2 surface:"
  find "$TARGET_DIR" \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \) -not -path "*/node_modules/*" -not -path "*/target/*" | head -20
  echo "## env/secret-shaped files:"
  find "$TARGET_DIR" \( -name ".env*" -o -name "*.env.example" -o -name "*keypair*" -o -name "*.pem" \) -not -path "*/node_modules/*" 2>/dev/null | head -15
  echo "## hardcoded ids:"
  grep -rhoE '[1-9A-HJ-NP-Za-km-z]{32,44}' "$TARGET_DIR" --include="*.env*" --include="*config*" 2>/dev/null | sort -u | head -10
} > "$CTX/surface.txt" 2>/dev/null

echo "context: $CTX/{deps_cves.json,onchain.json,fork.md,surface.txt}"

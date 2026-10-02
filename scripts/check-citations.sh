#!/usr/bin/env bash
# check-citations.sh — mechanical hallucination check between ANALYZE and DEVIL.
# Every finding must cite REAL code: file exists under TARGET_DIR and the
# quoted snippet literally greps inside it. A quote that doesn't match means
# the model never read the code — the finding dies here, before devil time.
#
# usage: bash scripts/check-citations.sh TARGET_DIR RUN_DIR
# writes RUN_DIR/citation_check.json; kills (marks hallucination:true) failures.
set -uo pipefail

TARGET_DIR="${1:?usage: check-citations.sh TARGET_DIR RUN_DIR}"
RUN_DIR="${2:?usage: check-citations.sh TARGET_DIR RUN_DIR}"
FINDINGS="$RUN_DIR/findings.json"
OUT="$RUN_DIR/citation_check.json"

[ -f "$FINDINGS" ] || { echo '{"error":"no findings.json"}' > "$OUT"; exit 0; }

python3 - "$TARGET_DIR" "$FINDINGS" "$OUT" <<'PY'
import json, os, re, sys

target_dir, findings_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
findings = json.load(open(findings_path))
results = []

def norm(s: str) -> str:
    # whitespace/punctuation-insensitive compare — model paraphrases spacing
    return re.sub(r"\s+", "", s or "")

for f in findings if isinstance(findings, list) else []:
    fid = f.get("id") or f.get("vulnerability_type", "?")
    rel = (f.get("file") or "").lstrip("/")
    # resolve: repo-relative, absolute-inside-target, or basename match
    path = None
    for cand in (os.path.join(target_dir, rel), rel):
        if os.path.isfile(cand):
            path = cand; break
    if path is None and rel:
        for root, _, files in os.walk(target_dir):
            if os.path.basename(rel) in files:
                cand = os.path.join(root, os.path.basename(rel))
                if rel.split("/")[-2:-1] and rel.split("/")[-2] in cand:
                    path = cand; break
    check = {"id": fid, "file": rel, "file_found": bool(path), "quote_found": False}
    if path:
        body = norm(open(path, errors="replace").read())
        snip = norm(f.get("code_snippet", ""))
        if len(snip) >= 24:
            check["quote_found"] = snip in body
        else:
            # short/absent snippet: check that function or distinctive string exists
            probe = norm(f.get("function", ""))
            check["quote_found"] = bool(probe) and probe in body
            check["weak_snippet"] = True
    f["citation_ok"] = check["file_found"] and check["quote_found"]
    if not f["citation_ok"]:
        f["hallucination"] = True
    results.append(check)

json.dump(findings, open(findings_path, "w"), indent=1)
json.dump({"checked": len(results), "failed": [r for r in results if not (r["file_found"] and r["quote_found"])]},
          open(out, "w"), indent=1)
bad = [r for r in results if not (r["file_found"] and r["quote_found"])]
print(f"citations: {len(results)} checked, {len(bad)} failed")
for r in bad: print("  KILL:", r["id"], "—", r["file"])
PY

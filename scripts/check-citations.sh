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
        body_raw = open(path, errors="replace").read()
        body = norm(body_raw)
        raw = (f.get("code_snippet", "") or "").replace("\\n", " ")
        # token-grounding: every distinctive identifier quoted must exist
        # verbatim in the file — catches invented code, tolerates paraphrase
        toks = set(re.findall(r"[A-Za-z_][A-Za-z0-9_.]{5,}", raw))
        toks = {t for t in toks if not t.startswith(("http", "JSON.string", "console"))}
        func_ok = False
        if f.get("function"):
            func_ok = norm(f["function"]) in body
        if toks:
            hits = sum(1 for t in toks if t in body_raw)
            ratio = hits / len(toks)
            check["tokens"] = f"{hits}/{len(toks)}"
            check["missing"] = sorted(t for t in toks if t not in body_raw)[:6]
            # grounded = most quoted identifiers exist, or the cited fn exists
            # and at least some tokens match. Zero grounding = invented code.
            check["quote_found"] = ratio >= 0.8 or (func_ok and ratio >= 0.3)
            check["weak_snippet"] = not check["quote_found"] and (func_ok or hits > 0)
        else:
            check["quote_found"] = func_ok
            check["weak_snippet"] = True
    f["citation_ok"] = check["file_found"] and check["quote_found"]
    f["citation_weak"] = bool(check.get("weak_snippet"))
    f["hallucination"] = not f["citation_ok"]  # always recompute — stale flags die
    results.append(check)

json.dump(findings, open(findings_path, "w"), indent=1)
json.dump({"checked": len(results), "failed": [r for r in results if not (r["file_found"] and r["quote_found"])]},
          open(out, "w"), indent=1)
bad = [r for r in results if not (r["file_found"] and r["quote_found"])]
print(f"citations: {len(results)} checked, {len(bad)} failed")
for r in bad: print("  KILL:", r["id"], "—", r["file"])
PY

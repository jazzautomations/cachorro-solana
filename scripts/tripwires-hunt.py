#!/usr/bin/env python3
"""tripwires-hunt.py <RUN_DIR> — post-hunt cognitive self-audit.

Port of pentest-agent v3.4 tripwires to cachorro hunt artifacts: deterministic
bias checks over the pack's own trail. A flag is evidence too — it surfaces in
the feed and on the certificate, it never edits the verdict.
"""
import json, os, sys, time
from collections import Counter

RUN = sys.argv[1]
flags = []

def flag(kind, severity, detail, **metrics):
    flags.append({"kind": kind, "severity": severity, "detail": detail, "metrics": metrics})

events = []
try:
    for line in open(os.path.join(RUN, "events.jsonl")):
        if line.strip():
            try: events.append(json.loads(line))
            except Exception: pass
except FileNotFoundError:
    pass

findings = survivors = []
try: findings = json.load(open(os.path.join(RUN, "findings.json"))) or []
except Exception: pass
try: survivors = json.load(open(os.path.join(RUN, "survivors.json"))) or []
except Exception: pass

reviewed = []
pdir = os.path.join(RUN, "pocs_reviewed")
if os.path.isdir(pdir):
    reviewed = [f for f in os.listdir(pdir) if f.startswith(("VERDE", "VERMELHO", "AMARELO"))]
import re as _re
def _fid(name):
    m = _re.match(r"(f\d+)", name)
    return m.group(1) if m else name
verde_files = {_fid(f.split("_poc_")[1].rsplit(".", 1)[0]) for f in reviewed if f.startswith("VERDE")}
vermelho_files = {_fid(f.split("_poc_")[1].rsplit(".", 1)[0]) for f in reviewed if f.startswith("VERMELHO")}

report = ""
st = {}
try: st = json.load(open(os.path.join(RUN, "status.json")))
except Exception: pass
rf = st.get("reportFile")
if rf:
    try: report = open(os.path.join(RUN, rf)).read()
    except Exception: pass

# 1 — promotion without proof: report claims VERDE for an id that never got a
# VERDE artifact. The exact failure a paper-only audit commits.
if report:
    import re
    verde_ids = set(re.findall(r"F\d+", " ".join(re.findall(r"VERDE[^\n]{0,60}", report))))
    # a VERDE mention is only a promotion claim if the finding lacks BOTH a
    # verde artifact and a vermelho one — refuted findings honestly mention
    # what was partially proven before the refutation (e.g. F2 arm(a)).
    missing = {i for i in verde_ids
               if i.lower() not in verde_files and i.lower() not in vermelho_files}
    if missing:
        flag("promotion-without-proof", "critical",
             "report claims VERDE for %s but no VERDE PoC artifact exists — promoted on prose" % sorted(missing),
             claimed=sorted(verde_ids), artifacts=sorted(verde_files))

# 2 — too-easy verification: a poc verdict emitted suspiciously fast after the
# stage opened. Real builds+runs take minutes; instant = probably asserted, not run.
poc_start = next((e["ts"] for e in events if e.get("stage") == "poc"), None)
if poc_start:
    for e in events:
        if e.get("stage") in ("poc", "review") and e.get("kind") in ("poc", "verdict") \
           and "VERDE" in e.get("text", "") and e["ts"] - poc_start < 45:
            flag("too-easy-verification", "warning",
                 "VERDE verdict %ds after POC stage opened — implausibly fast for a build+run cycle" % (e["ts"] - poc_start),
                 ts=e["ts"], text=e["text"][:120])
            break

# 3 — confirmation collapse: all candidates in one vuln class/file.
if len(findings) >= 3:
    kinds = Counter(f.get("vulnerability_type", "?") for f in findings)
    top_kind, top_n = kinds.most_common(1)[0]
    if top_n == len(findings):
        flag("confirmation-collapse", "warning",
             "all %d candidates are %r — the pack looked in one direction only" % (len(findings), top_kind),
             distribution=dict(kinds))

# 4 — rubber-stamp devil / refutation churn
if len(findings) >= 3 and len(survivors) == len(findings):
    flag("rubber-stamp-devil", "info",
         "devil killed 0 of %d candidates — no adversarial pressure applied" % len(findings),
         findings=len(findings))
if len(findings) >= 4 and len(survivors) == 0 and findings:
    flag("refutation-churn", "info",
         "devil killed all %d candidates — either the target is clean or analysis was hollow" % len(findings),
         findings=len(findings))

# 5 — suspiciously clean: report with zero candidates on a non-trivial surface
if report and not findings and st.get("mode") != "quick":
    flag("suspicious-clean", "info",
         "zero candidates survived a non-quick hunt — clean or blind, check coverage notes",
         mode=st.get("mode"))

# --emit: narrate the self-audit into the pack feed
if "--emit" in sys.argv:
    import subprocess, os.path as _p
    emitsh = _p.join(_p.dirname(_p.abspath(__file__)), "emit-event.sh")
    def _emit(kind, text):
        subprocess.run(["bash", emitsh, RUN, "self-audit", "tripwires", kind, text],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not flags:
        _emit("verdict", "self-audit clean — promotion gate, devil pressure, coverage & bias tripwires all pass")
    for f in flags:
        _emit("error" if f["severity"] == "critical" else "note",
              "tripwire %s [%s]: %s" % (f["kind"], f["severity"], f["detail"]))

# --emit: narrate the self-audit into the pack feed
if "--emit" in sys.argv:
    import subprocess, os.path as _p
    emitsh = _p.join(_p.dirname(_p.abspath(__file__)), "emit-event.sh")
    def _emit(kind, text):
        subprocess.run(["bash", emitsh, RUN, "self-audit", "tripwires", kind, text],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not flags:
        _emit("verdict", "self-audit clean — promotion gate, devil pressure, coverage & bias tripwires all pass")
    for f in flags:
        _emit("error" if f["severity"] == "critical" else "note",
              "tripwire %s [%s]: %s" % (f["kind"], f["severity"], f["detail"]))

out = {"checked_at": int(time.time()), "flags": flags, "clean": not flags,
       "counts": {"findings": len(findings), "survivors": len(survivors),
                  "verde": len(verde_files), "vermelho": len(vermelho_files)}}
with open(os.path.join(RUN, "self_audit.json"), "w") as f:
    json.dump(out, f, indent=2)
print(json.dumps(out))

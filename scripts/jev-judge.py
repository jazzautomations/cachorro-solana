#!/usr/bin/env python3
"""jev-judge.py <RUN_DIR> [--emit] — calibrated second opinion.

TypeSafe Jev (System One) scores every promoted claim: "is this a real
exploitable bug, given the code?" — returns a probability, not prose.
Advisory only: the promotion gate stays deterministic (PoC). A dissenting
judge surfaces as a tripwire flag and a feed event; it never edits verdicts.
"""
import json, os, re, sys, urllib.request

RUN = sys.argv[1]
EMIT = "--emit" in sys.argv
KEY_FILE = "/root/.secrets-typesafe"
API = "https://api.typesafe.ai/v1/systemone"

def get_key():
    try:
        for line in open(KEY_FILE):
            if line.startswith("TYPESAFE_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return os.environ.get("TYPESAFE_API_KEY")

def emit(kind, text):
    sh = os.path.join(os.path.dirname(os.path.abspath(__file__)), "emit-event.sh")
    import subprocess
    subprocess.run(["bash", sh, RUN, "jev", "jev", kind, text],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def noul(state, question, true_c, false_c):
    body = {"state": state, "model": "jev-latest",
            "questions": {"q": {"type": "noul", "instructions": question,
                                "criteria": {"true": true_c, "false": false_c}}}}
    req = urllib.request.Request(API, json.dumps(body).encode(),
        {"Authorization": "Bearer " + get_key(), "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["answers"]["q"]["noul"]

findings = survivors = []
try: findings = json.load(open(os.path.join(RUN, "findings.json"))) or []
except Exception: pass
try: survivors = json.load(open(os.path.join(RUN, "survivors.json"))) or []
except Exception: pass

# score the survivors — the claims that actually got promoted
items = survivors or findings
scores = {}
dissent = []
for f in items:
    fid = f.get("id", "?")
    state = {
        "file": f.get("file"), "vulnerability_type": f.get("vulnerability_type"),
        "severity_claimed": f.get("severity"),
        "description": f.get("description"),
        "attack_scenario": f.get("attack_scenario"),
        "code_snippet": str(f.get("code_snippet", ""))[:3000],
    }
    try:
        p = noul(state,
            "Is this a real, exploitable vulnerability in a Solana/Anchor program — "
            "not informational, not a style nit, not already guarded elsewhere in the snippet?",
            "concrete exploitable flaw with the stated impact plausible from this code",
            "informational, duplicate of a guard present in code, or impact not reachable")
        scores[fid] = round(p, 3)
        if EMIT:
            emit("obs", "jev %s: exploit-plausibility %.2f (%s)" % (fid, p, f.get("vulnerability_type", "?")))
        if p < 0.4:
            dissent.append({"id": fid, "score": round(p, 3)})
            if EMIT:
                emit("error", "jev DISSENT on %s: plausibility %.2f — judge not convinced" % (fid, p))
    except Exception as e:
        scores[fid] = None
        if EMIT: emit("note", "jev unreachable for %s: %s" % (fid, e))

valid = [v for v in scores.values() if v is not None]
out = {"checked_at": __import__("time").time(), "scores": scores,
       "mean": round(sum(valid)/len(valid), 3) if valid else None,
       "dissenting": dissent, "model": "jev-1.13.0"}
with open(os.path.join(RUN, "jev_audit.json"), "w") as f:
    json.dump(out, f, indent=2)
print(json.dumps(out))

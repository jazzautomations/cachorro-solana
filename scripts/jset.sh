#!/bin/bash
# jset.sh <status.json> key=value ...
# Atomic status.json patch shared by run-job*.sh and the Devin skill.
# "stage.<name>=value" writes into stages{}; anything else writes top-level.
set -uo pipefail
ST="${1:?status.json path}"; shift
python3 - "$ST" "$@" <<'PY'
import json, os, sys, tempfile, time
path = sys.argv[1]
try:
    with open(path) as f: d = json.load(f)
except Exception:
    d = {}
d.setdefault('stages', {})
for p in sys.argv[2:]:
    k, v = p.split('=', 1)
    if k.startswith('stage.'):
        d['stages'][k[6:]] = v
    else:
        d[k] = v
d['updatedAt'] = int(time.time())
fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path))
with os.fdopen(fd, 'w') as f: json.dump(d, f, indent=2)
os.replace(tmp, path)
PY

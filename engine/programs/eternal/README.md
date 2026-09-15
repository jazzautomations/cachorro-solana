# Eternal quick run

Generate a receipt, sign it with a local scope-authority key, initialize a fresh
workspace and perform one bounded observation:

```bash
python3 programs/eternal/build_scope.py \
  --username jazz-sec --ttl-hours 12 --output /tmp/eternal-scope.json
python3 runtime/scope_signing.py sign \
  /tmp/eternal-scope.json /path/to/private.pem /tmp/eternal-scope.signed.json
python3 runtime/campaign.py init . workspaces/runs/eternal-YYYYMMDD-v3 \
  /tmp/eternal-scope.signed.json --trusted-key /path/to/public.pem
python3 programs/eternal/seed_context.py . workspaces/runs/eternal-YYYYMMDD-v3
python3 runtime/run_adapter.py . workspaces/runs/eternal-YYYYMMDD-v3 \
  http-observe https://bugbounty.runnr.in/
```

The adapter DNS-pins the target, rejects private/rebound answers, sends the
signed `X-Hackerone` header, caps response size, and refuses redirects.

The optional seed step imports only an explicit public/OSINT allowlist. It does
not import OAuth traces, cookies, mailboxes, browser profiles or credentials.

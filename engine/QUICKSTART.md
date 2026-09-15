# Operational quickstart

The framework fails closed. Start with a real authorization document and create
a narrow JSON receipt matching `schemas/scope-receipt.schema.json`.

## 1. Validate dependencies

```bash
python3 runtime/doctor.py .
python3 runtime/validate_bundle.py .
```

Read-only source/git/HTTP adapters need `rg`, `git` and `curl`. Untrusted harness
or fuzzer execution additionally requires Docker with the `runsc` runtime. The
runtime refuses to downgrade to ordinary `runc`.

## 2. Create an offline scope authority

```bash
python3 runtime/scope_signing.py keygen /secure/scope-private.pem scope-public.pem
python3 runtime/scope_signing.py sign scope.json /secure/scope-private.pem scope.signed.json
python3 runtime/scope_signing.py verify scope.signed.json scope-public.pem
```

Keep the private key outside the framework and campaign workspace.

## 3. Initialize a campaign

```bash
python3 runtime/campaign.py init . workspaces/runs/example scope.signed.json \
  --trusted-key scope-public.pem
python3 runtime/campaign.py status . workspaces/runs/example
```

The campaign pins the framework tree hash, trusted public key and signed receipt.
Changing the framework mid-campaign causes it to fail closed.

## 4. Run bounded adapters

```bash
python3 runtime/run_adapter.py . workspaces/runs/example \
  source-search /authorized/source 'authorization|ownership'

python3 runtime/run_adapter.py . workspaces/runs/example \
  git-history /authorized/source --revision HEAD

python3 runtime/run_adapter.py . workspaces/runs/example \
  http-observe https://authorized.example/path --method GET

python3 runtime/run_adapter.py . workspaces/runs/example \
  hexstrike-passive subfinder-passive authorized.example \
  --server-url http://127.0.0.1:8888
```

The HTTP adapter reauthorizes scope, pins DNS, rejects private/rebinding answers
unless an explicit CIDR is scoped, uses `curl --resolve`, accepts only GET/HEAD
and never follows redirects automatically.

The HexStrike bridge supports only `subfinder-passive`, `gau-archive` and
`waybackurls-archive`. It accepts a plain domain, builds an exact payload without
free-form arguments, connects only to a literal loopback IP, and records the raw
response as untrusted evidence. It intentionally excludes active HexStrike
profiles because the upstream server constructs shell commands and cannot
reliably propagate program-required identification headers.

## 5. Run an agent package

The model bridge is an operator-controlled executable. It receives one JSON
request on stdin and returns `{output, model, model_version, usage}` on stdout.

```bash
python3 runtime/run_agent.py . workspaces/runs/example round-director input.json \
  --emit-event round.proposed \
  --provider-command /trusted/model-bridge --profile research
```

The runner validates input, loads declared skills, records each attempt, validates
the output contract and retries only with schema feedback. Provider commands are
never constructed by agents and never executed through a shell.

## 6. Approve and run a fuzz container

For untrusted harness/fuzzer execution, first generate the immutable container
plan, then create and sign a short-lived approval bound to that exact plan:

```bash
python3 runtime/run_fuzz.py plan /authorized/fuzz-work \
  registry/image@sha256:<digest> plan.json /opt/run-fuzzer -max_total_time=900
python3 runtime/approvals.py template plan.json approval-template.json \
  --approval-id approval-001 --scope-receipt-id <receipt-id> \
  --agent fuzz-campaign --ttl-seconds 600
python3 runtime/approvals.py sign approval-template.json \
  /secure/scope-private.pem approvals/approval-001.json
python3 runtime/run_fuzz.py execute . workspaces/runs/example plan.json \
  approvals/approval-001.json --trusted-key scope-public.pem
```

Execution fails before launching Docker unless `runsc` is registered, the image
is digest-pinned, the signed scope allows `code_execution`, and the approval
matches every plan field.

## 7. Package and attest

```bash
python3 runtime/package_bundle.py . dist/pentest-agent-v3.zip
python3 runtime/bundle_attestation.py create dist/pentest-agent-v3.zip \
  /secure/release-private.pem dist/pentest-agent-v3.attestation.json \
  --builder-id local-release
python3 runtime/bundle_attestation.py verify dist/pentest-agent-v3.zip \
  dist/pentest-agent-v3.attestation.json release-public.pem
```

The ZIP is deterministic and contains `MANIFEST.sha256` plus an SPDX 2.3 SBOM.

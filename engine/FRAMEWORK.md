# Pentest-Agent v3

Portable, filesystem-discovered framework for authorized vulnerability research.

The unit of composition is a directory. An agent package carries its method,
machine-readable contract, routes, skills, scripts, policies, fixtures and evals.
Copying the directory installs it; hashing the directory identifies the exact
agent used in a research round.

This directory is the v3 foundation, not a claim that autonomous zero-day
discovery has been solved. The current milestone makes the packaging contract,
scope matching, evidence vault, hash-chained journal, typed research graph,
portfolio scheduling, contracted agent execution and bounded adapters executable
and testable. Read-only source/git/HTTP adapters and a closed-profile passive
HexStrike bridge are enabled through capability mediation. Untrusted code
execution stays fail-closed unless a pinned image,
signed exact-plan approval and strong `runsc` sandbox are available.

## Invariants

- Scope, capability and side-effect limits are enforced by runtime code.
- A scanner result or model opinion is an observation, never proof by itself.
- HexStrike is restricted to reviewed passive profiles on a literal loopback
  service; free-form arguments and remote control planes are rejected.
- Every promoted finding requires an oracle, a negative control and clean-room
  reproduction.
- Failed and refuted hypotheses remain first-class data.
- Reports are generated only from verified graph state.
- Features must beat a model- and budget-matched baseline before promotion.

## Layout

```text
pentest-agent-v3/
├── framework.yaml
├── policies/
├── schemas/
├── runtime/
├── agents/
├── skills/
├── toolpacks/
├── evals/
├── fixtures/
└── tests/
```

Every directory below `agents/` containing `manifest.yaml` is an agent package.
Nested packages are allowed up to the limit in `framework.yaml`.

## Validate and package

```bash
python3 runtime/validate_bundle.py .
python3 -m unittest discover -s tests -v
python3 runtime/package_bundle.py . /tmp/pentest-agent-v3.zip
```

The packager validates first, refuses to overwrite an existing archive, rejects
symlinks, normalizes ZIP metadata and embeds `MANIFEST.sha256`. Identical source
trees therefore produce identical archives.

Runtime requirements are listed in `requirements.txt`. Agent scripts may have
additional, package-local requirements; those must be declared in their
manifest and lockfile before execution is enabled.

Scope receipts and high-risk approvals use Ed25519 signatures. HTTP plans use DNS
pinning/revalidation and do not follow redirects. Model-facing tool output is
bounded and explicitly marked untrusted. See `QUICKSTART.md` and run `doctor.py`
before creating a campaign.

# Eternal HackerOne program pack

Policy source: <https://hackerone.com/eternal?type=team>

Snapshot date: 2026-09-07 UTC. This pack is an operational encoding of the
program text and asset table supplied for this campaign. The signed receipt is
short lived on purpose; re-check the live HackerOne security page before every
renewal.

## Mandatory rules encoded by the pack

- Every active request carries `X-Hackerone: jazz-sec` from the signed scope
  receipt. Agents cannot replace or omit it.
- One request at a time, low volume, no broad scanner defaults, no DoS, spam,
  brute force, credential stuffing or password spraying.
- Only test accounts owned by the researcher may be used.
- No access, modification or download of other users' data. Stop at the minimum
  proof and report promptly.
- The Data Protection Program is passive/read-only. This active-testing pack
  does not authorize tests against partners or external systems.
- Redirects are never followed automatically. Each destination needs a fresh
  scope and DNS decision.
- SQL injection experiments must use paired treatment/control requests,
  non-destructive payloads and bounded repetitions. No stacked queries, data
  extraction, writes, delays intended to degrade service, or operating-system
  commands.

## Campaign focus

The public campaign text supplied for 2026-09-05 through 2026-09-13 UTC awards
a multiplier for new valid SQL injection reports. That promotion changes
priority and payout, not authorization or safety rules. The initial v3 lane is:

1. Ingest existing Eternal artifacts and deduplicate endpoints.
2. Identify query or body parameters that plausibly reach data stores.
3. Rank by context: search/filter/sort/export/ID boundaries, backend clues,
   response determinism and business impact.
4. Run low-volume differential controls before any deeper confirmation.
5. Require repeatability, a negative control and a clean-room replay before a
   finding can become reportable.

The dedicated `bugbounty.runnr.in` environment is preferred for applicable
Runnr flows. Explicit deny rules always win over wildcard allows.

# HexStrike passive bridge

This integration uses HexStrike as a local tool service while retaining the
Pentest-Agent v3 scope, evidence and promotion gates. The reviewed upstream
snapshot is recorded in `upstream.lock.json`; no upstream source is copied into
the bundle.

The bridge deliberately exposes three closed passive profiles:

- `subfinder-passive`
- `gau-archive`
- `waybackurls-archive`

The adapter accepts only a plain DNS name. It constructs all API parameters,
sets `additional_args` to the empty string, binds the request to an immutable
capability plan, and connects only to a literal loopback address. Raw responses
are stored in the evidence vault and marked `observation_only`.

Active endpoints are not enabled. At the reviewed upstream commit, the server
constructs shell command strings from HTTP parameters and invokes them with
`shell=True`. It also cannot guarantee propagation of target-program headers.
Adding an active profile therefore requires its own bounded parameter schema,
request-rate policy, required-header support, target-side oracle and tests.

Start a separately reviewed HexStrike service on loopback, then use:

```bash
python3 runtime/run_adapter.py . <campaign-workspace> \
  hexstrike-passive subfinder-passive <authorized-domain> \
  --server-url http://127.0.0.1:8888
```

The signed scope receipt must authorize `http.observe` and `network_read` for
the domain. A successful tool response expands the research surface; it never
confirms a vulnerability.

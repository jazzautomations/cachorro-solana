# Evaluation contract

Every feature is evaluated against a plain-agent baseline using the same model,
context, target snapshot, wall time and tool budget. Run each condition more than
once and retain variance; one lucky trajectory is not a result.

Primary metrics are unique verified bugs, precision, clean-room reproduction,
coverage delta, pass@1/pass@k, cost, elapsed time, tool calls, branch waste and
time to first oracle-backed evidence.

Known-CVE benchmarks measure exploitation and regression capability. A claim of
unknown-vulnerability discovery requires a temporally valid pre-fix snapshot and
eventually an independently disclosed issue in an authorized program.


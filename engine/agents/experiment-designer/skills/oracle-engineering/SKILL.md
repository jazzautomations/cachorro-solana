---
name: oracle-engineering
description: Design treatment-control experiments whose observable result is causally tied to a claimed security invariant, with bounded repetitions and explicit inconclusive outcomes.
---

# Oracle engineering

First name the security property: memory safety, authorization, isolation,
integrity, confidentiality, availability or state-machine validity. Choose an
observable that demonstrates that property directly or through a justified
instrument. Hold environment and transport constant between treatment and
control; change only the hypothesized condition.

Define failure, success and inconclusive states before execution. A crash is a
memory-safety signal only with the right instrumentation and trace; a response
code is an authorization signal only relative to expected identity and state.


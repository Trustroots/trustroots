## Design

Keep JaCoCo's raw XML as evidence. Classify generated paths from compiled method
instructions and their line-number tables rather than filenames or handwritten
source-line allowlists. A correction must have an exact bytecode match and must
not discard instructions belonging to source behaviour. Unrecognised patterns
remain counted. Reanalyse execution probes with the additional instruction filter
and record the class, method, source line, matched pattern and instruction
signature in a separate audit. JaCoCo aggregates counters after filtering.

The line ratchet consumes the corrected report. Its original counters remain
available for comparison, and branch counters remain unchanged unless a future
separately specified classifier proves generated branch outcomes.

## Validation

Positive fixtures exercise known generated patterns; negative fixtures contain
similar real code and must stay counted. Verify unchanged branch counters, raw
report preservation, deterministic reporting and rejection of mismatched probes.
Run complete unit and API 36/API 32 device coverage before claiming 100% lines.

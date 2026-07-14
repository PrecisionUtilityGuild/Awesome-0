# Awesome/O Holdout Results

Generated from local JSONL results. Independent stress corpus, not pre-registered.

| Model           | Corpus       | Awesome/O RBR | Careful RBR | Compile | Test | CPT_output | CPT_total | Output overhead | Gates |
| --------------- | ------------ | ------------: | ----------: | ------: | ---: | ---------: | --------: | --------------: | ----- |
| haiku           | holdout / 16 |         0.096 |       0.330 |     88% |  88% |      13.62 |      0.53 |           0.63x | PASS  |
| sonnet          | holdout / 16 |         0.004 |       0.190 |    100% | 100% |      14.76 |      0.58 |           0.73x | PASS  |
| claude-sonnet-5 | holdout / 16 |         0.126 |       0.290 |     81% |  81% |      10.56 |      0.35 |           0.66x | PASS  |

## Lane RBR

| Model           | Lane              | Awesome/O | Careful-control |
| --------------- | ----------------- | --------: | --------------: |
| haiku           | plain             |     0.001 |           0.337 |
| haiku           | architecture-trap |     0.217 |           0.835 |
| haiku           | operational-lie   |     0.002 |           0.160 |
| haiku           | format-discipline |     0.000 |           0.003 |
| haiku           | combo-trap        |     0.326 |           0.152 |
| sonnet          | plain             |     0.003 |           0.003 |
| sonnet          | architecture-trap |     0.003 |           0.424 |
| sonnet          | operational-lie   |     0.006 |           0.114 |
| sonnet          | format-discipline |     0.003 |           0.003 |
| sonnet          | combo-trap        |     0.003 |           0.327 |
| claude-sonnet-5 | plain             |     0.325 |           0.011 |
| claude-sonnet-5 | architecture-trap |     0.175 |           0.650 |
| claude-sonnet-5 | operational-lie   |     0.003 |           0.227 |
| claude-sonnet-5 | format-discipline |     0.001 |           0.001 |
| claude-sonnet-5 | combo-trap        |     0.325 |           0.325 |

## Known Failure Modes

- Operational/data lies remain the lane to watch most closely.
- Fence-only output is treated as a cosmetic 0.05 format penalty.
- CPT_output is the primary efficiency metric; CPT_total is disclosed because the skill has input-token overhead.
- The corpus is independent but not pre-registered.

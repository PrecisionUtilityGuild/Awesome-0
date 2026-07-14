# Awesome/O v1 Validation Results

Generated from local JSONL results. Independent stress corpus, not pre-registered.

| Model           | Corpus             | Awesome/O RBR | Careful RBR | Compile | Test | CPT_output | CPT_total | Output overhead | Gates |
| --------------- | ------------------ | ------------: | ----------: | ------: | ---: | ---------: | --------: | --------------: | ----- |
| haiku           | v1-validation / 40 |         0.040 |       0.367 |     95% |  95% |      20.72 |      0.58 |           0.61x | PASS  |
| sonnet          | v1-validation / 40 |         0.003 |       0.223 |    100% | 100% |      18.64 |      0.60 |           0.78x | PASS  |
| claude-sonnet-5 | v1-validation / 40 |         0.204 |       0.320 |     70% |  70% |       9.01 |      0.33 |           1.03x | FAIL  |

## Lane RBR

| Model           | Lane              | Awesome/O | Careful-control |
| --------------- | ----------------- | --------: | --------------: |
| haiku           | plain             |     0.087 |           0.170 |
| haiku           | architecture-trap |     0.071 |           0.709 |
| haiku           | operational-lie   |     0.002 |           0.261 |
| haiku           | format-discipline |     0.001 |           0.164 |
| sonnet          | plain             |     0.005 |           0.005 |
| sonnet          | architecture-trap |     0.003 |           0.609 |
| sonnet          | operational-lie   |     0.004 |           0.097 |
| sonnet          | format-discipline |     0.002 |           0.003 |
| claude-sonnet-5 | plain             |     0.169 |           0.005 |
| claude-sonnet-5 | architecture-trap |     0.396 |           0.537 |
| claude-sonnet-5 | operational-lie   |     0.085 |           0.353 |
| claude-sonnet-5 | format-discipline |     0.175 |           0.164 |

## Known Failure Modes

- Operational/data lies remain the lane to watch most closely.
- Fence-only output is treated as a cosmetic 0.05 format penalty.
- CPT_output is the primary efficiency metric; CPT_total is disclosed because the skill has input-token overhead.
- The corpus is independent but not pre-registered.

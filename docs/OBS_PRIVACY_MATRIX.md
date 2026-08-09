# Technical Operations Privacy Matrix

| Data | Super Admin full view | Director summary | Ordinary UI/logs |
| --- | --- | --- | --- |
| Aggregate counts/statuses | Yes | Concise only | No |
| Safe fingerprints/correlation IDs | Yes | No | Fixed errors only |
| Alert/incident/maintenance safe text | Exact permission | No by default | No |
| Role-group adoption counts | Yes | Overall counts only | No |
| User names, IDs, contacts, session tokens | No | No | No |
| Student/Guardian/Staff business rows | No | No | No |
| Salary, marks, complaints, payment references | No | No | No |
| Provider credentials/payloads | No | No | No |
| Absolute paths, filenames, encryption keys | No | No | No |

Adoption metrics are account-safety and rollout indicators, never attendance, productivity, reading-time, clickstream, ranking, or employee performance analytics. Small-group identity inference is avoided by using aggregate role labels and no per-user drill-down.

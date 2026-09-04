# Communication Purpose and Channel Policy

The internal policy taxonomy is technical governance pending formal legal/policy approval; it is not a legal conclusion.

| Purpose | Typical use | Consent/preference boundary |
| --- | --- | --- |
| `SECURITY_CRITICAL` | invitation, recovery, factor/session/device/account change | Optional preferences cannot suppress a policy-required notice; external copy is generic. |
| `SAFETY_CRITICAL` | governed Safe Exit or separately approved safety notice | Emergency quiet-hours override requires an authorised role, step-up and reason. |
| `TRANSACTIONAL` | receipt available, meeting confirmation, Support acknowledgement | Bound to the completed business event; no marketing content. |
| `ACADEMIC_OPERATIONAL` | report/classwork/timetable availability | Explicit channel/purpose consent required in current 1A policy. |
| `ADMINISTRATIVE` | request/library/operations reminder | Explicit channel/purpose consent required. |
| `INFORMATIONAL_OPTIONAL` | non-essential School update | Explicit consent and optional preference; quiet hours/digest controls apply. |
| `MARKETING_PROHIBITED_OR_SEPARATELY_GOVERNED` | advertising/promotions | Rejected. It cannot be relabelled as transactional. |

Channels are typed as `IN_APP`, `EMAIL`, `SMS`, `WHATSAPP`, and `NATIVE_PUSH`. Each has its own feature gate, destination shape, renderer, consent/preference decision, provider mapping, status, retry policy, and certification gate. `WEB_PUSH` is not active.

The parent gate and selected child gate must both pass. When either is off, the API fails closed, workers do not call an adapter, legacy live activation is blocked, UI does not claim delivery, and items are suppressed or safely retained. In-app is enabled only by the copied/synthetic QA override during 1A.

Optional quiet hours use the recipient preference timezone (default `Asia/Kolkata`, not a claimed real School schedule). The service computes the first eligible minute outside the interval, preserves expiry, and never changes mandatory-purpose classification.

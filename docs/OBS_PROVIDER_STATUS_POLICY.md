# Provider Status Policy

Provider categories are WhatsApp, SMS/email, cloud backup, OCR, Web Push, online payment, AI, external monitoring, and analytics. States are `NOT_CONFIGURED`, `DISABLED`, `TEST`, `LIVE`, `DEGRADED`, and `FAILED`.

Profiles are read from existing module tables. Dashboard rendering makes no health probe or external request. `NOT_CONFIGURED` and intentionally disabled optional providers are neutral. Failure becomes operationally significant only when a provider is expected/configured, especially in LIVE mode. Provider credentials, endpoints, recipient details, payloads, and full error responses are excluded.

Changing provider status or activating live use remains in each provider’s separately governed workflow and is outside OBS-1A.

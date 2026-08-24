# Provider-Neutral Edge Policy Template

This is a review checklist, not an activated provider configuration.

| Policy | Template intent |
| --- | --- |
| Managed DDoS | Always-on Layer 3/4 and Layer 7 protection with provider escalation contacts and traffic baselines. |
| WAF managed rules | Current managed rules in log/simulate first, then block after false-positive review; protect framework, injection, traversal, protocol and upload classes. |
| Rate limiting | Separate rules for login, recovery/OTP, public forms, uploads, imports, exports, PDF/image work, Search, Smart AI and future sync. Preserve health with a narrow independent rule. |
| Bot/challenge | Challenge only public anonymous abuse where accessible fallback exists. Never introduce automatic external-provider cost or make a challenge the sole authorization control. |
| Caching | Cache immutable hashed static assets. Never cache authenticated HTML/API, cookies, private/public-form responses, downloads, reports, AI/Search, webhooks, errors containing private state, or `private/no-store`. |
| Upload limits | Match or undercut exact application route limits; reject slow bodies and invalid transfer framing before origin. |
| Country/ASN emergency | Disabled normally; documented, time-bounded emergency allow/deny controls with approval and accessibility/legitimate-user impact review. |
| Admin routes | Additional identity-aware access or administration-network policy; application role/permission checks still required. |
| Under-attack mode | Tighten anonymous bursts, challenge suspicious bots, disable nonessential expensive public work, preserve login/recovery safety and health, and avoid unbounded origin queues. |

A Cloudflare implementation may map these concepts to managed rules, rate limiting, Bot Management/Turnstile, Access, cache rules, authenticated origin pulls or Tunnel, and Under Attack Mode. Equivalent services must remain possible; no application authorization may depend on one vendor-specific header without the authenticated boundary proof.

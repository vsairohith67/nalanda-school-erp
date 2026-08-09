# Alert, Incident, and Maintenance Lifecycle

## Alerts

Stable domain/check fingerprints deduplicate occurrences and increment counters. Valid states are `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `SILENCED`, `RESOLVED`, and `CLOSED`. Expected-version checks prevent lost updates. Recovery auto-resolves an active alert. A closed or resolved condition may reopen on recurrence.

Silence requires a reason and expiry no more than 30 days away. Critical alerts and protected database, migration, and privileged-account checks cannot be silenced. Critical notification publication is in-app and idempotent; no external provider is contacted.

## Incidents

Authorised operators may create manually or from an alert, assign an owner, investigate, mitigate, resolve, and close. Closure requires a privacy-safe post-incident summary. Every transition appends an immutable timeline event.

## Maintenance

A planned window names the exact domain and check keys, reason, impact, owner, start, and end. A window may start, complete, or be cancelled with an event note. Protected corruption, migration, and privileged-account checks can never be suppressed. Maintenance never hides actual evidence or repairs data.

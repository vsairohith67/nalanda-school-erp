# Unified In-App Notification Centre

The default-off `/communication` surface provides own-notification pagination, category filtering in the API, unread/read state, mark one read, mark all eligible read, archive/current views, expiry text and safe action links. Every query includes the authenticated user ID; an item ID alone cannot retrieve or mutate another user’s row.

The preferences surface modifies only the current account. The operations surface requires an existing notification-report permission plus the stricter communication role matrix. It exposes state/channel/provider aggregates and dead-letter counts, not plaintext destinations or full message bodies.

The UI follows shared Product Experience components, keyboard navigation, visible focus, minimum 44 px controls, responsive card/table layouts, screen-reader labels, polite live status, and text labels in addition to colour. It says queued, accepted, sent, or delivered precisely and warns that opening a notification does not authorise the target record.

Legacy Prompt 19A inboxes remain available during staged consolidation. The unified route is not added to production navigation while its committed gate is off; copied/synthetic QA may enter it directly. Windows/Android/iOS shells reuse the responsive web surface. Native push and launch-time notification permission are not activated.

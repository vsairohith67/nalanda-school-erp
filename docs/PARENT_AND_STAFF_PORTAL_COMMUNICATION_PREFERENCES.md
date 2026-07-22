# Parent and Staff Communication Preferences

Parents use `/parent/communication-preferences`; Teachers use `/teacher/communication-preferences`.

The page shows current consent and a masked authoritative number. Opt-in starts unchecked. Consent is optional, phone-bound, and limited to one-way school operational updates. Message/data charges may apply. Opting out is immediate and does not remove in-app notifications.

Server ownership is mandatory: Parent requests use authenticated `User.guardianId`; Teacher requests require exact `StaffMember.userId`. Caller-supplied unrelated IDs are never trusted. The phone is changed only in the existing Guardian/Staff workflow. A number change invalidates consent and requires a new explicit opt-in.
# SMS and Email preferences

The Parent and Staff preference pages now expose WhatsApp, SMS and Email as independent choices. SMS binds to the current authoritative mobile hash; Email binds to the current authoritative email hash. Every opt-in is explicit and unchecked, contacts are masked, opt-out is immediate, and a changed source contact invalidates the old consent for sending. A new opt-in never clears an active provider suppression. Parents can manage only their own linked Guardian; Staff can manage only their active `User`-`StaffMember` link. These pages never expose batches, delivery reports, credentials, or full contacts.

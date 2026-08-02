# Multi-Role Parent Context Workflow

Role context and child context are separate IAM controls. A Teacher + Parent or Director + Parent account remains in its current Teacher/leadership context until it explicitly switches to an active Parent role assignment. Parent navigation and linked-child resolution are unavailable in the non-Parent context even if the User has Parent permissions or a Guardian link.

Switching into Parent context clears an inapplicable prior child context. Child selection is then resolved or chosen under the new session context version. Switching away clears Parent-only navigation and child context. Requests from stale tabs compare the session role assignment and context version and fail generically.

Clients do not submit a trusted role, Student ID, Guardian ID or role-assignment ID. The authenticated server session is authoritative. Permission remains necessary but cannot replace the linked-child resolver.

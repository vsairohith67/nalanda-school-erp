# Multi-Role and Multi-Child Calendar Workflow

Role and child contexts remain separate IAM-cleared server-held handles. A single-role user has no role selector. A Teacher + Parent or Director + Parent first enters Parent role context, then selects a linked child. The calendar request revalidates session, active role assignment, authorization version, Guardian link and active enrollment every time.

Changing child replaces the Parent child context and refetches exact cohort content. The handle cannot be reused across users or role contexts. Removed links, inactive/expired roles, invalid client role strings, stale authorization versions and stale tabs fail closed. Teacher/Director views ignore Parent child context and resolve only their own exact object scope.


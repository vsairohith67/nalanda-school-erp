type AuditClient = {
  userAudit: {
    create(args: {
      data: {
        action: string;
        actorUserId: string;
        actorName: string;
        targetUserId?: string | null;
        detailsJson?: string | null;
      };
    }): Promise<unknown>;
  };
};

export async function logUserAction(
  client: AuditClient,
  input: {
    action: string;
    actor: { id: string; name: string };
    targetUserId?: string | null;
    details?: Record<string, unknown>;
  }
) {
  await client.userAudit.create({
    data: {
      action: input.action,
      actorUserId: input.actor.id,
      actorName: input.actor.name,
      targetUserId: input.targetUserId ?? null,
      detailsJson: input.details ? JSON.stringify(input.details) : null
    }
  });
}

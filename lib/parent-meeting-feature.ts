export function parentMeetingsEnabled() {
  return process.env.PARENT_MEETINGS_V1_5?.trim().toLowerCase() === "true";
}


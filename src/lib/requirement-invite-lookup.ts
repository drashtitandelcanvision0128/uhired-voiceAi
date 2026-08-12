type InviteRow = {
  requirementId: string;
  email: string;
  accessCode: string;
};

export function inviteLookupKey(requirementId: string, email: string): string {
  return `${requirementId}:${email.trim().toLowerCase()}`;
}

export function buildCandidateInviteCodeMap(invites: InviteRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const invite of invites) {
    map.set(inviteLookupKey(invite.requirementId, invite.email), invite.accessCode);
  }
  return map;
}

export function resolveCandidateInviteCode(
  map: Map<string, string>,
  requirementId: string | null | undefined,
  candidateEmail: string | null | undefined,
): string | null {
  if (!requirementId || !candidateEmail) return null;
  return map.get(inviteLookupKey(requirementId, candidateEmail)) ?? null;
}

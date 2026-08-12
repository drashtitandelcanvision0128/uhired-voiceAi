export function resolveSessionCandidateDisplay(session: {
  candidateName: string | null;
  candidateEmail: string | null;
  candidate?: { name: string; email: string | null } | null;
}): { candidateName: string | null; candidateEmail: string | null } {
  return {
    candidateName: session.candidateName ?? session.candidate?.name ?? null,
    candidateEmail: session.candidateEmail ?? session.candidate?.email ?? null,
  };
}

import type { InterviewSession, Scorecard, ScorecardShareLink, Candidate, Requirement } from "@prisma/client";
import type { QuestionResultRow } from "@/lib/interview-questions";
import { formatInterviewDurationShort } from "@/lib/interview-duration";
import { parseQuestionResultsFromScorecard } from "@/lib/parse-question-results";
import { resolveSessionKeySkills } from "@/lib/session-key-skills";

export type ScorecardSharePublicPayload = {
  positionTitle: string | null;
  domain: string;
  topic: string;
  candidateName: string | null;
  candidateEmail: string | null;
  companyName: string;
  keySkills: string[] | null;
  durationMin: number;
  /** e.g. "8 min" (actual) or "10 min" (allocated) for PDF header */
  sessionTimeDisplay: string;
  scorecard: {
    overallScore: number;
    communication: number;
    domainDepth: number;
    confidence: number;
    summary: string;
    strengths: string[] | null;
    improvements: string[] | null;
    evidence: string[] | null;
    scoringMode: string | null;
    scoringModel: string | null;
    accuracyPercent: number | null;
    questionResults: QuestionResultRow[] | null;
  };
  expiresAt: string;
};

function jsonToStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.filter((x): x is string => typeof x === "string");
  return out.length ? out : null;
}

type SessionWithScore = InterviewSession & {
  scorecard: Scorecard;
  candidate: Candidate | null;
  company: { name: string } | null;
  requirement?: Requirement | null;
};

function buildSessionTimeDisplay(session: SessionWithScore): string {
  return formatInterviewDurationShort({
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMin: session.durationMin,
  });
}

function resolveCandidateEmail(session: SessionWithScore): string | null {
  const fromSession = session.candidateEmail?.trim();
  if (fromSession) return fromSession;
  const fromCandidate = session.candidate?.email?.trim();
  return fromCandidate || null;
}

export type BuildScorecardSharePayloadOptions = {
  /** PDF company reports always show the candidate name when known. */
  forCompanyReport?: boolean;
};

export function buildScorecardSharePublicPayload(
  link: Pick<ScorecardShareLink, "expiresAt" | "includeCandidateName">,
  session: SessionWithScore,
  options?: BuildScorecardSharePayloadOptions,
): ScorecardSharePublicPayload {
  const sc = session.scorecard;
  const showName = options?.forCompanyReport || link.includeCandidateName;
  const displayName = showName ? session.candidateName || session.candidate?.name || null : null;

  const email = resolveCandidateEmail(session);
  const keySkills = resolveSessionKeySkills(session, session.requirement);

  return {
    positionTitle: session.positionTitle,
    domain: session.domain,
    topic: session.topic,
    candidateName: displayName,
    candidateEmail: email,
    companyName: session.company?.name || session.companyName || "Company",
    keySkills: keySkills.length > 0 ? keySkills : null,
    durationMin: session.durationMin,
    sessionTimeDisplay: buildSessionTimeDisplay(session),
    scorecard: {
      overallScore: sc.overallScore,
      communication: sc.communication,
      domainDepth: sc.domainDepth,
      confidence: sc.confidence,
      summary: sc.summary,
      strengths: jsonToStringArray(sc.strengths),
      improvements: jsonToStringArray(sc.improvements),
      evidence: jsonToStringArray(sc.evidence),
      scoringMode: sc.scoringMode ?? null,
      scoringModel: sc.scoringModel ?? null,
      accuracyPercent: sc.accuracyPercent,
      questionResults: parseQuestionResultsFromScorecard(sc.questionResults),
    },
    expiresAt: link.expiresAt.toISOString(),
  };
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";
import { resolveSessionKeySkills } from "@/lib/session-key-skills";
import { resolveEffectiveQuestions, stripAnswersFromQuestions } from "@/lib/interview-questions";
import { buildCompanyInterviewerProfile } from "@/lib/interviewer-profile";
import {
  buildBrandingCssVars,
  resolveBrandDisplayName,
  type CompanyBranding,
} from "@/lib/company-branding";

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { sessionId } = await context.params;
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: {
        questions: { orderBy: { orderIndex: "asc" } },
        candidate: true,
        company: {
          select: {
            name: true,
            interviewerName: true,
            interviewerVoiceGender: true,
            brandDisplayName: true,
            brandPrimaryColor: true,
            brandLogoUrl: true,
          },
        },
        requirement: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (session.sessionType === "COMPANY" && isCandidateInterviewSessionGuardEnabled()) {
      const candidateSession = getCandidateInterviewSessionFromCookieHeader(_request.headers.get("cookie"));
      if (!candidateSession || candidateSession.sessionId !== sessionId) {
        return NextResponse.json({ error: "Unauthorized interview session access." }, { status: 401 });
      }
    }

    const companyName = session.companyName ?? session.company?.name ?? null;
    const interviewerProfile =
      session.sessionType === "COMPANY"
        ? buildCompanyInterviewerProfile({
            interviewerName: session.company?.interviewerName,
            interviewerVoiceGender: session.company?.interviewerVoiceGender,
            companyName,
          })
        : null;

    const { company, requirement, candidate, questions, ...sessionFields } = session;
    const branding: CompanyBranding = session.company
      ? {
          brandDisplayName: session.company.brandDisplayName,
          brandPrimaryColor: session.company.brandPrimaryColor,
          brandLogoUrl: session.company.brandLogoUrl,
        }
      : {};

    const mergedSession = {
      ...sessionFields,
      companyName,
      brandDisplayName: resolveBrandDisplayName(branding, companyName),
      brandPrimaryColor: branding.brandPrimaryColor ?? null,
      brandLogoUrl: branding.brandLogoUrl ?? null,
      brandingCssVars: buildBrandingCssVars(branding),
      interviewerName: interviewerProfile?.interviewerName ?? null,
      interviewerDisplayName: interviewerProfile?.displayName ?? null,
      interviewerVoiceGender: interviewerProfile?.interviewerVoiceGender ?? null,
      interviewerVoice: interviewerProfile?.voice ?? null,
      candidateName: session.candidateName || candidate?.name || null,
      candidateEmail: session.candidateEmail || candidate?.email || null,
      positionTitle: session.positionTitle || requirement?.title || null,
      domain: session.domain || requirement?.domain,
      topic: session.topic || requirement?.topic,
      durationMin: session.durationMin || requirement?.durationMin,
      jobDescription: session.jobDescription || requirement?.jobDescription || null,
      keySkills: (() => {
        const skills = resolveSessionKeySkills(session, requirement);
        return skills.length > 0 ? skills : null;
      })(),
      questions: stripAnswersFromQuestions(
        resolveEffectiveQuestions(questions, requirement?.questions ?? []),
      ),
      maxOptionalQuestions: session.maxOptionalQuestions || requirement?.maxOptionalQuestions || 0,
    };

    return NextResponse.json({ session: mergedSession });
  } catch (error) {
    console.error("[interview/details] Failed to load session:", error);
    return NextResponse.json({ error: "Unable to load interview session." }, { status: 500 });
  }
}

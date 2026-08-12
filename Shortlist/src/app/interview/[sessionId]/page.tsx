
"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CompanyInterviewRoom } from "@/components/company-interview-room";
import { DEFAULT_INTERVIEW_DURATION_SEC } from "@/lib/constants";

type SessionData = {
  id: string;
  sessionType: "PRACTICE" | "COMPANY";
  candidateName: string | null;
  companyName: string | null;
  interviewerName: string | null;
  interviewerDisplayName: string | null;
  interviewerVoiceGender: string | null;
  interviewerVoice: string | null;
  positionTitle: string | null;
  domain: string;
  topic: string;
  jobDescription: string | null;
  keySkills: unknown;
  durationMin: number;
  status: string;
  consentAcceptedAt?: string | null;
  questions: Array<{ id: string; prompt: string; isMandatory: boolean }>;
  maxOptionalQuestions?: number;
  brandDisplayName?: string | null;
  brandPrimaryColor?: string | null;
  brandLogoUrl?: string | null;
  brandingCssVars?: Record<string, string>;
};

function parseKeySkills(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const [sessionId, setSessionId] = useState("");
  const [session, setSession] = useState<SessionData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const resolved = await params;
      setSessionId(resolved.sessionId);
    })();
  }, [params]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/interview/${sessionId}/details`);
        const data = (await response.json().catch(() => null)) as {
          session?: SessionData;
          error?: string;
        } | null;
        if (cancelled) return;
        if (!response.ok || !data?.session) {
          setError(data?.error ?? "Unable to load session.");
          return;
        }
        setSession(data.session);
        setError("");
      } catch {
        if (!cancelled) setError("Unable to load session.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const durationSec = useMemo(() => {
    if (!session) return DEFAULT_INTERVIEW_DURATION_SEC;
    return Math.max(300, session.durationMin * 60);
  }, [session]);

  const mandatoryQuestions = useMemo(
    () => session?.questions.filter((q) => q.isMandatory).map((q) => q.prompt) ?? [],
    [session?.questions],
  );
  const optionalQuestionPool = useMemo(
    () => session?.questions.filter((q) => !q.isMandatory).map((q) => q.prompt) ?? [],
    [session?.questions],
  );

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#eceef0] px-6">
        <p className="text-red-600">{error}</p>
        <Link href="/" className="mt-4 text-sm font-bold text-[#1d3557] underline">
          Home
        </Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eceef0] text-slate-600">
        Loading…
      </div>
    );
  }

  if (session.status === "COMPLETED") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#eceef0] px-6">
        <p className="font-semibold text-[#1d3557]">This interview is already completed.</p>
        <Link href="/candidate" className="mt-4 text-sm font-bold text-[#006a62] underline">
          Candidate entry
        </Link>
      </div>
    );
  }

  if (!session.candidateName?.trim()) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#eceef0] px-6 text-center">
        <p className="max-w-md text-slate-700">
          Join this interview from the candidate link and enter your session code and name first.
        </p>
        <Link href="/candidate" className="mt-6 rounded-lg bg-[#1d3557] px-5 py-3 text-sm font-bold text-white">
          Go to candidate entry
        </Link>
      </div>
    );
  }

  return (
    <CompanyInterviewRoom
      sessionId={session.id}
      sessionType={session.sessionType}
      candidateName={session.candidateName.trim()}
      companyName={session.companyName}
      interviewerName={session.interviewerName}
      interviewerDisplayName={session.interviewerDisplayName}
      interviewerVoiceGender={session.interviewerVoiceGender}
      interviewerVoice={session.interviewerVoice}
      positionTitle={session.positionTitle}
      domain={session.domain}
      topic={session.topic}
      jobDescription={session.jobDescription}
      keySkills={parseKeySkills(session.keySkills)}
      mandatoryQuestions={mandatoryQuestions}
      optionalQuestionPool={optionalQuestionPool}
      maxOptionalQuestions={session.maxOptionalQuestions ?? 0}
      durationSec={durationSec}
      consentAcceptedAt={session.consentAcceptedAt}
      brandDisplayName={session.brandDisplayName}
      brandPrimaryColor={session.brandPrimaryColor}
      brandLogoUrl={session.brandLogoUrl}
      brandingCssVars={session.brandingCssVars}
    />
  );
}

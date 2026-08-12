import type { ScorecardSharePublicPayload } from "@/lib/scorecard-share-payload";

export function ScorecardSharePublicView({ payload }: { payload: ScorecardSharePublicPayload }) {
  const sc = payload.scorecard;
  const expiresLabel = new Date(payload.expiresAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Interview scorecard</p>
      <h1 className="mt-2 text-2xl font-black text-[#203854]">{payload.positionTitle || "Role"}</h1>
      <p className="mt-1 text-sm text-slate-600">
        {payload.domain} · {payload.topic}
      </p>
      {payload.candidateName ? (
        <p className="mt-2 text-sm text-slate-700">Candidate: {payload.candidateName}</p>
      ) : null}
      {payload.candidateEmail ? (
        <p className="mt-1 text-sm text-slate-600">Email: {payload.candidateEmail}</p>
      ) : null}

      <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Scores</p>
        <p className="mt-2 text-3xl font-black text-[#203854]">
          {sc.overallScore}
          <span className="text-sm font-semibold text-slate-500">/100</span>
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Communication {sc.communication} · Domain {sc.domainDepth} · Confidence {sc.confidence}
          {sc.accuracyPercent != null ? ` · Answer accuracy ${sc.accuracyPercent}%` : ""}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">
          Overall blends communication (35%), domain depth (40%), and confidence (25%)
          {sc.accuracyPercent != null ? "; with answer grading, 80% accuracy + 20% holistic" : ""}.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-800">{sc.summary}</p>
        <p className="mt-2 text-[11px] text-slate-500">
          Scoring: {sc.scoringMode ?? "heuristic"}
          {sc.scoringModel ? ` · ${sc.scoringModel}` : ""}
        </p>

        {(sc.strengths?.length ?? 0) > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Strengths</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {sc.strengths?.map((item, idx) => (
                <li key={`s-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {(sc.improvements?.length ?? 0) > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Improvement areas</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {sc.improvements?.map((item, idx) => (
                <li key={`i-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {(sc.evidence?.length ?? 0) > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Evidence highlights</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {sc.evidence?.map((item, idx) => (
                <li key={`e-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {(sc.questionResults?.length ?? 0) > 0 ? (
        <div className="mt-8 space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Question &amp; answer review
          </p>
          {sc.questionResults?.map((row, index) => (
            <article
              key={row.questionId}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Question {index + 1}
                </p>
                <p className="text-xs font-semibold text-[#203854]">
                  <span
                    className={
                      row.result === "Pass"
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800"
                        : row.result === "Fail"
                          ? "rounded-full bg-red-100 px-2 py-0.5 text-red-800"
                          : "rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
                    }
                  >
                    {row.result}
                  </span>
                  {row.result === "Pass" || row.result === "Fail" ? (
                    <> · {row.overallScore}/10</>
                  ) : null}
                </p>
              </div>
              <p className="text-sm font-semibold text-[#203854]">{row.prompt}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-900">
                    Ideal answer
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                    {row.expectedAnswer?.trim() || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Candidate answer
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                    {row.candidateAnswer?.trim() || "No clear answer captured."}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <p className="mt-8 text-xs text-slate-500">This shared link expires {expiresLabel}.</p>
      <p className="mt-2 text-xs text-slate-400">
        Confidential hiring summary. Do not forward without consent of the parties involved.
      </p>
    </div>
  );
}

"use client";

import {
  annotateTranscriptTiming,
  formatTranscriptTimestampMs,
  issueLabel,
  summarizeTranscriptTimingIssues,
  type TranscriptTimingTurn,
} from "@/lib/transcript-timing";

type TranscriptTimelineProps = {
  turns: TranscriptTimingTurn[];
  emptyMessage?: string;
  className?: string;
};

export function TranscriptTimeline({
  turns,
  emptyMessage = "No transcript yet.",
  className = "",
}: TranscriptTimelineProps) {
  if (!turns.length) {
    return <p className="text-muted-foreground">{emptyMessage}</p>;
  }

  const annotated = annotateTranscriptTiming(turns);
  const summary = summarizeTranscriptTimingIssues(annotated);
  const hasIssues =
    summary.shuffleCount > 0 || summary.overlapCount > 0 || summary.missingTimestampCount > 0;

  return (
    <div className={className}>
      {hasIssues ? (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <p className="font-semibold">Transcript timing diagnostics</p>
          <p className="mt-1">
            Timestamps are speech-start times from the interview clock (mm:ss). Compare
            &quot;order&quot; (capture sequence) with &quot;time&quot; to spot overlap or shuffle.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-0.5">
            {summary.overlapCount > 0 ? (
              <li>{summary.overlapCount} turn(s) with timestamp overlap</li>
            ) : null}
            {summary.shuffleCount > 0 ? (
              <li>{summary.shuffleCount} turn(s) out of chronological order</li>
            ) : null}
            {summary.missingTimestampCount > 0 ? (
              <li>{summary.missingTimestampCount} turn(s) without timestamp (older sessions)</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2.5">
        {annotated.map((turn) => {
          const speakerKey = turn.speaker.toUpperCase();
          const isCandidate = speakerKey === "CANDIDATE";
          return (
            <div
              key={turn.id}
              className={`rounded-lg px-3 py-2.5 ${
                isCandidate
                  ? "bg-violet/12 ring-1 ring-violet/25"
                  : "bg-surface/60 ring-1 ring-border"
              } ${turn.issues.length > 0 ? "ring-amber-400/50" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide ${
                    isCandidate ? "text-violet" : "text-muted-foreground"
                  }`}
                >
                  {turn.speaker}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {formatTranscriptTimestampMs(turn.timestampMs)}
                </span>
                <span className="text-[10px] text-muted-foreground/80">
                  order #{turn.displayIndex + 1}
                  {turn.chronologyIndex != null ? ` · time #${turn.chronologyIndex + 1}` : ""}
                </span>
                {turn.issues.map((issue) => (
                  <span
                    key={issue}
                    className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning"
                  >
                    {issueLabel(issue)}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground">{turn.message}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Mail,
  RefreshCw,
} from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import {
  MasterAlert,
  MasterCard,
  MasterKpiCard,
  MasterSelect,
  masterBtnGhost,
  masterTableHeadClass,
} from "@/components/master-ui";

type Period = "7d" | "30d" | "90d" | "all";

type AnalyticsResponse = {
  period: Period;
  summary: {
    totalRequirements: number;
    requirementsInPeriod: number;
    totalInvites: number;
    invitesInPeriod: number;
    totalCompanySessions: number;
    sessionsInPeriod: number;
    completedInPeriod: number;
    liveNow: number;
    completionRatePct: number;
  };
  trends: {
    requirementsCreated: Array<{ label: string; count: number }>;
    sessionsConducted: Array<{ label: string; count: number }>;
  };
  companyRows: Array<{
    companyId: string;
    companyName: string;
    domain: string;
    isActive: boolean;
    totalRequirements: number;
    totalSessions: number;
    invitesInPeriod: number;
    completedInPeriod: number;
  }>;
  recentRequirements: Array<{
    id: string;
    companyName: string;
    roleTitle: string;
    durationMin: number;
    invitesCount: number;
    sessionsCount: number;
    createdAt: string;
  }>;
  recentSessions: Array<{
    id: string;
    companyName: string | null;
    candidateName: string | null;
    candidateEmail: string | null;
    positionTitle: string | null;
    status: string;
    overallScore: number | null;
    createdAt: string;
  }>;
};

function TrendBars({
  title,
  rows,
  barClass,
  trackClass = "bg-surface/60 ring-1 ring-border",
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
  barClass: string;
  trackClass?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <MasterCard className="p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {rows.map((row) => {
          const heightPct = Math.max(8, (row.count / max) * 100);
          return (
            <div key={row.label} className="flex flex-col items-center gap-1">
              <div className={`flex h-16 w-full items-end justify-center rounded-md px-0.5 ${trackClass}`}>
                <div
                  className={`w-full rounded-t-sm ${barClass}`}
                  style={{ height: `${heightPct}%` }}
                  title={`${row.count}`}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{row.label}</p>
              <p className="text-xs font-semibold text-foreground">{row.count}</p>
            </div>
          );
        })}
      </div>
    </MasterCard>
  );
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MasterInterviewAnalyticsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/master/interview-analytics?period=${period}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as AnalyticsResponse & { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          router.replace("/master-login");
          return;
        }
        setError(body.error ?? "Could not load analytics.");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not reach the server.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;

  return (
    <MasterShell title="Interview analytics" subtitle="Jobs and interviews across companies.">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <MasterSelect
            value={period}
            onValueChange={(value) => setPeriod(value as Period)}
            className="max-w-[11rem] min-w-[10rem]"
            aria-label="Time range"
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
              { value: "all", label: "All time" },
            ]}
          />
          <button
            type="button"
            className={`${masterBtnGhost} !px-2.5 !py-2`}
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MasterKpiCard
            label="Jobs"
            value={summary?.requirementsInPeriod ?? "—"}
            hint={`${summary?.totalRequirements ?? 0} total`}
            icon={ClipboardList}
            accent="bg-violet/12 text-violet ring-violet/25"
          />
          <MasterKpiCard
            label="Invites"
            value={summary?.invitesInPeriod ?? "—"}
            hint={`${summary?.totalInvites ?? 0} total`}
            icon={Mail}
            accent="bg-primary/12 text-primary ring-primary/25"
          />
          <MasterKpiCard
            label="Interviews"
            value={summary?.sessionsInPeriod ?? "—"}
            hint={`${summary?.liveNow ?? 0} live`}
            icon={Briefcase}
            accent="bg-success/12 text-success ring-success/25"
          />
          <MasterKpiCard
            label="Completed"
            value={summary ? `${summary.completionRatePct}%` : "—"}
            hint={`${summary?.completedInPeriod ?? 0} in this range`}
            icon={CheckCircle2}
            accent="bg-warning/12 text-warning ring-warning/25"
          />
        </section>

        {data ? (
          <>
            <div className="grid gap-3 xl:grid-cols-2">
              <TrendBars
                title="Jobs created"
                rows={data.trends.requirementsCreated}
                barClass="bg-violet-500"
              />
              <TrendBars
                title="Interviews"
                rows={data.trends.sessionsConducted}
                barClass="bg-emerald-500"
              />
            </div>

            <MasterCard className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">By company</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={masterTableHeadClass}>
                      <th className="px-4 py-2 text-left">Company</th>
                      <th className="px-4 py-2 text-left">Jobs</th>
                      <th className="px-4 py-2 text-left">Invites</th>
                      <th className="px-4 py-2 text-left">Interviews</th>
                      <th className="px-4 py-2 text-left">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.companyRows.map((row) => (
                      <tr key={row.companyId} className="border-t border-border">
                        <td className="px-4 py-2 font-medium text-foreground">{row.companyName}</td>
                        <td className="px-4 py-2 text-foreground">{row.totalRequirements}</td>
                        <td className="px-4 py-2 text-foreground">{row.invitesInPeriod}</td>
                        <td className="px-4 py-2 text-foreground">{row.totalSessions}</td>
                        <td className="px-4 py-2 text-foreground">{row.completedInPeriod}</td>
                      </tr>
                    ))}
                    {!data.companyRows.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-sm text-muted-foreground">
                          No companies yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </MasterCard>

            <MasterCard className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Latest jobs</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={masterTableHeadClass}>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Company</th>
                      <th className="px-4 py-2 text-left">Invites</th>
                      <th className="px-4 py-2 text-left">Interviews</th>
                      <th className="px-4 py-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentRequirements.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium text-foreground">{row.roleTitle}</td>
                        <td className="px-4 py-2 text-muted-foreground">{row.companyName}</td>
                        <td className="px-4 py-2 text-foreground">{row.invitesCount}</td>
                        <td className="px-4 py-2 text-foreground">{row.sessionsCount}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(row.createdAt).toLocaleDateString("en-IN")}
                        </td>
                      </tr>
                    ))}
                    {!data.recentRequirements.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-sm text-muted-foreground">
                          No jobs in this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </MasterCard>

            <MasterCard className="overflow-hidden">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Latest interviews</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={masterTableHeadClass}>
                      <th className="px-4 py-2 text-left">Candidate</th>
                      <th className="px-4 py-2 text-left">Company</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2 text-left">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSessions.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-4 py-2 font-medium text-foreground">
                          {row.candidateName ?? row.candidateEmail ?? "Candidate"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{row.companyName ?? "—"}</td>
                        <td className="px-4 py-2 text-foreground">{row.positionTitle ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatStatus(row.status)}</td>
                        <td className="px-4 py-2 text-foreground">
                          {row.overallScore != null ? row.overallScore : "—"}
                        </td>
                      </tr>
                    ))}
                    {!data.recentSessions.length ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-sm text-muted-foreground">
                          No interviews in this range.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </MasterCard>
          </>
        ) : null}
      </div>
    </MasterShell>
  );
}

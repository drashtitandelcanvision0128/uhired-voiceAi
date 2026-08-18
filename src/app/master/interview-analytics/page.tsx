"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Mail,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import {
  MasterAlert,
  MasterCard,
  MasterHero,
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
    <MasterCard className="p-5">
      <h3 className="admin-section-title text-sm">{title}</h3>
      <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-8">
        {rows.map((row) => {
          const heightPct = Math.max(8, (row.count / max) * 100);
          const isPeak = row.count === max && row.count > 0;
          return (
            <div key={row.label} className="flex flex-col items-center gap-2">
              <div
                className={`flex h-24 w-full items-end justify-center rounded-lg px-1 ${trackClass}`}
              >
                <div
                  className={`w-full rounded-t-md shadow-sm transition-all ${barClass} ${
                    isPeak ? "ring-2 ring-primary/40" : ""
                  }`}
                  style={{ height: `${heightPct}%` }}
                  title={`${row.count}`}
                />
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground">{row.label}</p>
              <p className="text-xs font-black text-foreground">{row.count}</p>
            </div>
          );
        })}
      </div>
    </MasterCard>
  );
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
        setError(body.error ?? "Unable to load interview analytics.");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Unable to reach the server.");
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
    <MasterShell
      title="Interview Analytics"
      subtitle="Platform-wide interview creation and session activity across all companies."
      topActions={
        <button type="button" className={masterBtnGhost} onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-6">
        <MasterHero
          badge="Creation + sessions"
          title="Admin interview analytics"
          subtitle="Track how companies create interview requirements, send invites, and conduct AI interviews."
        >
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">Period</label>
            <MasterSelect
              value={period}
              onValueChange={(value) => setPeriod(value as Period)}
              className="max-w-[12rem] min-w-[11rem]"
              aria-label="Analytics period"
              options={[
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "90d", label: "Last 90 days" },
                { value: "all", label: "All time" },
              ]}
            />
          </div>
        </MasterHero>

        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MasterKpiCard
            label="Requirements created"
            value={summary?.requirementsInPeriod ?? "—"}
            hint={`${summary?.totalRequirements ?? 0} total active`}
            icon={ClipboardList}
            accent="bg-violet/12 text-violet ring-violet/25"
          />
          <MasterKpiCard
            label="Invites sent"
            value={summary?.invitesInPeriod ?? "—"}
            hint={`${summary?.totalInvites ?? 0} all time`}
            icon={Mail}
            accent="bg-primary/12 text-primary ring-primary/25"
          />
          <MasterKpiCard
            label="Sessions conducted"
            value={summary?.sessionsInPeriod ?? "—"}
            hint={`${summary?.liveNow ?? 0} live now`}
            icon={Briefcase}
            accent="bg-success/12 text-success ring-success/25"
          />
          <MasterKpiCard
            label="Completion rate"
            value={summary ? `${summary.completionRatePct}%` : "—"}
            hint={`${summary?.completedInPeriod ?? 0} completed in period`}
            icon={CheckCircle2}
            accent="bg-warning/12 text-warning ring-warning/25"
          />
        </section>

        {data ? (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              <TrendBars
                title="Interview requirements created (8 weeks)"
                rows={data.trends.requirementsCreated}
                barClass="bg-gradient-to-t from-violet to-primary"
              />
              <TrendBars
                title="Company sessions conducted (8 weeks)"
                rows={data.trends.sessionsConducted}
                barClass="bg-gradient-to-t from-emerald-500 to-success"
              />
            </div>

            <MasterCard elevated className="overflow-hidden">
              <div className="border-b border-border px-5 py-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Per-company breakdown
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className={masterTableHeadClass}>
                      <th className="px-4 py-3 text-left">Company</th>
                      <th className="px-4 py-3 text-left">Requirements</th>
                      <th className="px-4 py-3 text-left">Invites (period)</th>
                      <th className="px-4 py-3 text-left">Sessions</th>
                      <th className="px-4 py-3 text-left">Completed (period)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.companyRows.map((row) => (
                      <tr
                        key={row.companyId}
                        className="border-t border-border transition hover:bg-surface/40"
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-foreground">{row.companyName}</p>
                          <p className="text-xs text-muted-foreground">{row.domain}</p>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">{row.totalRequirements}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{row.invitesInPeriod}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{row.totalSessions}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{row.completedInPeriod}</td>
                      </tr>
                    ))}
                    {!data.companyRows.length ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-sm text-muted-foreground"
                        >
                          No company data for this period.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </MasterCard>

            <div className="grid gap-4 xl:grid-cols-2">
              <MasterCard elevated className="overflow-hidden">
                <div className="border-b border-border px-5 py-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <TrendingUp className="h-4 w-4 text-violet" />
                    Recent requirements
                  </h3>
                </div>
                <ul className="divide-y divide-border">
                  {data.recentRequirements.map((row) => (
                    <li key={row.id} className="px-5 py-3 text-sm transition hover:bg-surface/40">
                      <p className="font-semibold text-foreground">{row.roleTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.companyName} · {row.invitesCount} invites · {row.sessionsCount} sessions ·{" "}
                        {new Date(row.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                  {!data.recentRequirements.length ? (
                    <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No recent requirements.
                    </li>
                  ) : null}
                </ul>
              </MasterCard>

              <MasterCard elevated className="overflow-hidden">
                <div className="border-b border-border px-5 py-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <BarChart3 className="h-4 w-4 text-success" />
                    Recent conducted sessions
                  </h3>
                </div>
                <ul className="divide-y divide-border">
                  {data.recentSessions.map((row) => (
                    <li key={row.id} className="px-5 py-3 text-sm transition hover:bg-surface/40">
                      <p className="font-semibold text-foreground">
                        {row.candidateName ?? row.candidateEmail ?? "Candidate"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.companyName ?? "—"} · {row.positionTitle ?? "Interview"} · {row.status}
                        {row.overallScore != null ? ` · score ${row.overallScore}` : ""}
                      </p>
                    </li>
                  ))}
                  {!data.recentSessions.length ? (
                    <li className="px-5 py-8 text-center text-sm text-muted-foreground">
                      No recent sessions.
                    </li>
                  ) : null}
                </ul>
              </MasterCard>
            </div>
          </>
        ) : null}
      </div>
    </MasterShell>
  );
}

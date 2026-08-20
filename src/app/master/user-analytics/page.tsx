"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {
  Activity,
  Building2,
  CheckCircle2,
  GraduationCap,
  Mail,
  RefreshCw,
  Repeat,
  Search,
  Shield,
  Users,
} from "lucide-react";

import { MasterShell } from "@/components/master-shell";

import {

  MASTER_PAGE_SIZE_OPTIONS,

  MasterPageSize,

  MasterPagination,

} from "@/components/master-pagination";

import {

  MasterAlert,

  MasterSelect,

  masterBtnGhost,

  masterInputClass,

  masterTableHeadClass,

} from "@/components/master-ui";



type UserType = "PRACTICE" | "COMPANY_CANDIDATE" | "INVITED" | "COMPANY_ADMIN";



type AnalyticsResponse = {

  summary: {

    totalUniqueUsers: number;

    practiceUsers: number;

    companyCandidates: number;

    companyAdmins: number;

    invitedUsers: number;

    returningUsers: number;

    activeLast30Days: number;

    completionRatePct: number;

  };

  userTypeBreakdown: {

    practiceOnly: number;

    companyOnly: number;

    bothPracticeAndCompany: number;

    adminsOnly: number;

  };

  sessionBreakdown: {

    total: number;

    practice: number;

    company: number;

    completed: number;

    live: number;

    ready: number;

  };

  weeklyNewUsers: Array<{ label: string; count: number }>;

  topDomains: Array<{ domain: string; users: number; sessions: number }>;

  users: Array<{

    email: string;

    name: string;

    types: UserType[];

    sessionCount: number;

    completedCount: number;

    practiceCount: number;

    companyCount: number;

    avgScore: number | null;

    primaryTrack: string;

    companies: string[];

    firstSeenAt: string;

    lastActiveAt: string;

    isReturning: boolean;

  }>;

  pagination: {

    page: number;

    pageSize: number;

    total: number;

    totalPages: number;

  };

};



const USER_TYPE_ORDER: UserType[] = ["PRACTICE", "COMPANY_CANDIDATE", "INVITED", "COMPANY_ADMIN"];

const USER_TYPE_LABELS: Record<UserType, string> = {
  PRACTICE: "Practice",
  COMPANY_CANDIDATE: "Company",
  INVITED: "Invited",
  COMPANY_ADMIN: "Admin",
};

function orderedUserTypes(types: UserType[]) {
  return USER_TYPE_ORDER.filter((type) => types.includes(type));
}



const USER_TYPE_STYLES: Record<UserType, string> = {
  PRACTICE: "bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-500/25 dark:text-cyan-300",
  COMPANY_CANDIDATE: "bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/25 dark:text-indigo-300",
  INVITED: "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-300",
  COMPANY_ADMIN: "bg-success/12 text-success ring-1 ring-success/25",
};

type NewUsersPeriod = "week" | "month" | "year";



const NEW_USERS_PERIOD_LABELS: Record<NewUsersPeriod, string> = {

  week: "New users (7 days)",

  month: "New users (30 days)",

  year: "New users (12 months)",

};



function startOfDay(date: Date) {

  const copy = new Date(date);

  copy.setHours(0, 0, 0, 0);

  return copy;

}



function buildNewUsersChart(

  users: AnalyticsResponse["users"],

  period: NewUsersPeriod,

): Array<{ label: string; count: number }> {

  const today = startOfDay(new Date());



  if (period === "week") {

    return Array.from({ length: 7 }, (_, index) => {

      const daysAgo = 6 - index;

      const day = new Date(today);

      day.setDate(day.getDate() - daysAgo);

      const nextDay = new Date(day);

      nextDay.setDate(nextDay.getDate() + 1);



      const count = users.filter((user) => {

        const firstSeen = new Date(user.firstSeenAt);

        return firstSeen >= day && firstSeen < nextDay;

      }).length;



      return {

        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),

        count,

      };

    });

  }



  if (period === "month") {

    return Array.from({ length: 30 }, (_, index) => {

      const daysAgo = 29 - index;

      const day = new Date(today);

      day.setDate(day.getDate() - daysAgo);

      const nextDay = new Date(day);

      nextDay.setDate(nextDay.getDate() + 1);



      const count = users.filter((user) => {

        const firstSeen = new Date(user.firstSeenAt);

        return firstSeen >= day && firstSeen < nextDay;

      }).length;



      return {

        label: day.getDate().toString(),

        count,

      };

    });

  }



  return Array.from({ length: 12 }, (_, index) => {

    const monthsAgo = 11 - index;

    const monthStart = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);

    const monthEnd = new Date(today.getFullYear(), today.getMonth() - monthsAgo + 1, 1);



    const count = users.filter((user) => {

      const firstSeen = new Date(user.firstSeenAt);

      return firstSeen >= monthStart && firstSeen < monthEnd;

    }).length;



    return {

      label: monthStart.toLocaleDateString(undefined, { month: "short" }),

      count,

    };

  });

}



function formatTrack(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bdevloper\b/gi, "developer")
    .split(" ")
    .map((word) => {
      const core = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
      if (!core) return word;
      const lower = core.toLowerCase();
      const formatted =
        lower === "hr" || lower === "qa" || lower === "it" || lower === "ai"
          ? lower.toUpperCase()
          : lower.charAt(0).toUpperCase() + lower.slice(1);
      return word.replace(core, formatted);
    })
    .join(" ");
}

function formatRelativeDate(value: string) {

  const date = new Date(value);

  const diffMs = Date.now() - date.getTime();

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";

  if (diffDays === 1) return "Yesterday";

  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "");
  return letters.toUpperCase();
}



export default function MasterUserAnalyticsPage() {

  const router = useRouter();

  const [data, setData] = useState<AnalyticsResponse | null>(null);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [typeFilter, setTypeFilter] = useState<"ALL" | UserType>("ALL");

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const [newUsersPeriod, setNewUsersPeriod] = useState<NewUsersPeriod>("week");



  const load = useCallback(async () => {

    setError("");

    setLoading(true);

    try {

      const params = new URLSearchParams({

        page: String(page),

        pageSize: String(pageSize),

      });

      if (search.trim()) params.set("search", search.trim());

      if (typeFilter !== "ALL") params.set("type", typeFilter);

      const res = await fetch(`/api/master/user-analytics?${params.toString()}`);

      const payload = (await res.json()) as AnalyticsResponse & { error?: string };

      if (res.status === 401) {

        router.push("/master-login");

        return;

      }

      if (!res.ok) {

        setError(payload.error ?? "Could not load users.");

        return;

      }

      setData(payload);

    } finally {

      setLoading(false);

    }

  }, [router, page, pageSize, search, typeFilter]);



  useEffect(() => {

    void load();

  }, [load]);



  useEffect(() => {

    setPage(1);

  }, [search, typeFilter, pageSize]);



  useEffect(() => {

    if (data?.pagination && page > data.pagination.totalPages) {

      setPage(data.pagination.totalPages);

    }

  }, [page, data?.pagination]);



  const overviewCards = [
    { label: "Users", value: data?.summary.totalUniqueUsers ?? 0, icon: Users, accent: "bg-primary/12 text-primary" },
    { label: "Active", value: data?.summary.activeLast30Days ?? 0, icon: Activity, accent: "bg-success/12 text-success" },
    {
      label: "Repeat users",
      hint: "2+ interviews",
      value: data?.summary.returningUsers ?? 0,
      icon: Repeat,
      accent: "bg-violet/12 text-violet",
    },
    {
      label: "Completed",
      value: `${data?.summary.completionRatePct ?? 0}%`,
      icon: CheckCircle2,
      accent: "bg-warning/12 text-warning",
    },
  ];

  const audienceCards = [
    { label: "Practice", value: data?.summary.practiceUsers ?? 0, icon: GraduationCap, accent: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300" },
    { label: "Company", value: data?.summary.companyCandidates ?? 0, icon: Building2, accent: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
    { label: "Invited", value: data?.summary.invitedUsers ?? 0, icon: Mail, accent: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
    { label: "Admins", value: data?.summary.companyAdmins ?? 0, icon: Shield, accent: "bg-success/12 text-success" },
  ];

  const overlapRows = [
    { label: "Practice only", value: data?.userTypeBreakdown.practiceOnly ?? 0, bar: "bg-cyan-500" },
    { label: "Company only", value: data?.userTypeBreakdown.companyOnly ?? 0, bar: "bg-indigo-500" },
    { label: "Both", value: data?.userTypeBreakdown.bothPracticeAndCompany ?? 0, bar: "bg-violet-500" },
    { label: "Admins only", value: data?.userTypeBreakdown.adminsOnly ?? 0, bar: "bg-emerald-500" },
  ];
  const overlapMax = Math.max(1, ...overlapRows.map((row) => row.value));

  const topTracks = data?.topDomains ?? [];
  const trackMax = Math.max(1, ...topTracks.map((track) => track.users));

  const newUsersChart = useMemo(
    () => buildNewUsersChart(data?.users ?? [], newUsersPeriod),
    [data?.users, newUsersPeriod],
  );
  const maxNewUsersCount = Math.max(1, ...newUsersChart.map((item) => item.count));

  return (
    <MasterShell title="User analytics" subtitle="People using Uhired.">
      <div className="space-y-4">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Overview</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {overviewCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="admin-card flex items-center gap-3 p-3.5">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                    <Icon className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-lg font-semibold tracking-tight text-foreground">{card.value}</p>
                    {"hint" in card && card.hint ? (
                      <p className="text-[10px] text-muted-foreground">{card.hint}</p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Audience</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {audienceCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className="admin-card flex items-center gap-3 p-3.5">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                    <Icon className="size-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-lg font-semibold tracking-tight text-foreground">{card.value}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <div className="grid gap-3 lg:grid-cols-5">
          <section className="admin-card p-4 lg:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{NEW_USERS_PERIOD_LABELS[newUsersPeriod]}</p>
                <p className="text-xs text-muted-foreground">First time we saw each email</p>
              </div>
              <div className="flex rounded-lg bg-muted/70 p-0.5 ring-1 ring-border">
                {(["week", "month", "year"] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setNewUsersPeriod(period)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${
                      newUsersPeriod === period
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
            <div className={`flex h-44 items-end gap-1.5 ${newUsersPeriod === "month" ? "overflow-x-auto pb-1" : ""}`}>
              {newUsersChart.map((point, index) => {
                const heightPct = Math.max(8, (point.count / maxNewUsersCount) * 100);
                return (
                  <div
                    key={`${point.label}-${index}`}
                    className={`flex flex-col items-center gap-1.5 ${
                      newUsersPeriod === "month" ? "min-w-[1.4rem] flex-none" : "min-w-0 flex-1"
                    }`}
                  >
                    <p className="text-[10px] font-semibold text-foreground">{point.count}</p>
                    <div className="flex h-28 w-full items-end justify-center rounded-md bg-muted/60 px-0.5">
                      <div
                        className="w-full max-w-[1.75rem] rounded-t-md"
                        style={{
                          height: `${heightPct}%`,
                          background: point.count > 0 ? "var(--gradient-brand)" : "transparent",
                        }}
                        title={`${point.label}: ${point.count}`}
                      />
                    </div>
                    <p className={`text-muted-foreground ${newUsersPeriod === "month" ? "text-[8px]" : "text-[10px]"}`}>
                      {point.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="admin-card flex flex-col p-4 lg:col-span-2">
            <p className="text-sm font-semibold text-foreground">Mix</p>
            <p className="mb-3 text-xs text-muted-foreground">Where people sit in the product</p>
            <div className="space-y-3">
              {overlapRows.map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-semibold text-foreground">{row.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${row.bar}`}
                      style={{ width: `${Math.max(row.value > 0 ? 4 : 0, (row.value / overlapMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
              <div className="rounded-lg bg-cyan-500/12 px-3 py-2 text-xs font-semibold text-cyan-800 ring-1 ring-cyan-500/20 dark:text-cyan-200">
                Practice {data?.sessionBreakdown.practice ?? 0}
              </div>
              <div className="rounded-lg bg-indigo-500/12 px-3 py-2 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-500/20 dark:text-indigo-200">
                Company {data?.sessionBreakdown.company ?? 0}
              </div>
              <div className="rounded-lg bg-success/12 px-3 py-2 text-xs font-semibold text-success ring-1 ring-success/20">
                Done {data?.sessionBreakdown.completed ?? 0}
              </div>
              <div className="rounded-lg bg-amber-500/12 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-500/20 dark:text-amber-200">
                Live {data?.sessionBreakdown.live ?? 0}
              </div>
            </div>
          </section>
        </div>

        <section className="admin-card p-4">
          <p className="text-sm font-semibold text-foreground">Top tracks</p>
          <p className="mb-3 text-xs text-muted-foreground">Most common interview topics</p>
          {topTracks.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {topTracks.slice(0, 8).map((track, index) => (
                <div key={track.domain} className="min-w-0">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      <span className="mr-1.5 text-xs text-muted-foreground">{index + 1}.</span>
                      {formatTrack(track.domain)}
                    </p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {track.users} · {track.sessions} sessions
                    </p>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(8, (track.users / trackMax) * 100)}%`,
                        background: "var(--gradient-brand)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No tracks yet.</p>
          )}
        </section>

        <section className="admin-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
            <div className="min-w-0 shrink-0">
              <p className="text-sm font-semibold text-foreground">People</p>
              <p className="text-xs text-muted-foreground">{data?.pagination.total ?? 0} users</p>
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <div className="relative min-w-0 max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, email, or track"
                  className={`${masterInputClass} !h-8 !min-h-8 w-full !py-1.5 pl-9 !text-xs`}
                  aria-label="Search users"
                />
              </div>
              <MasterSelect
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as "ALL" | UserType)}
                size="sm"
                className="w-[8.75rem] shrink-0"
                aria-label="Filter by user type"
                options={[
                  { value: "ALL", label: "All types" },
                  { value: "PRACTICE", label: "Practice" },
                  { value: "COMPANY_CANDIDATE", label: "Company" },
                  { value: "INVITED", label: "Invited" },
                  { value: "COMPANY_ADMIN", label: "Admins" },
                ]}
              />
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className={`${masterBtnGhost} inline-flex h-8 w-8 shrink-0 items-center justify-center !px-0 disabled:opacity-60`}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="px-4 py-2.5">User</th>
                  <th className="pr-4">Type</th>
                  <th className="pr-4">Sessions</th>
                  <th className="pr-4">Score</th>
                  <th className="pr-4">Track</th>
                  <th className="pr-4">Last active</th>
                  <th className="pr-4">First seen</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((user) => (
                  <tr key={user.email} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-bold text-primary">
                          {initials(user.name, user.email)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{user.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="pr-4">
                      <div className="flex flex-wrap items-center justify-start gap-1">
                        {orderedUserTypes(user.types).map((type) => (
                          <span
                            key={type}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${USER_TYPE_STYLES[type]}`}
                          >
                            {USER_TYPE_LABELS[type]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="pr-4 font-medium text-foreground">{user.sessionCount}</td>
                    <td className="pr-4 text-foreground">{user.avgScore ?? "—"}</td>
                    <td className="pr-4 text-foreground">{formatTrack(user.primaryTrack)}</td>
                    <td className="pr-4 text-xs text-muted-foreground">{formatRelativeDate(user.lastActiveAt)}</td>
                    <td className="pr-4 text-xs text-muted-foreground">{formatRelativeDate(user.firstSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !(data?.pagination.total ?? 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No users found.</p>
            ) : null}
            {loading && !(data?.users.length ?? 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : null}
          </div>

          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={data?.pagination.total ?? 0}
            itemLabel="users"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </section>
      </div>
    </MasterShell>
  );
}

"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";

import {

  BarChart3,

  Building2,

  GraduationCap,

  Mail,

  RefreshCw,

  UserCheck,

  UserPlus,

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

  MasterCard,

  MasterHero,

  MasterInfoCard,

  MasterKpiCard,

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



const USER_TYPE_LABELS: Record<UserType, string> = {

  PRACTICE: "Practice user",

  COMPANY_CANDIDATE: "Company candidate",

  INVITED: "Invited",

  COMPANY_ADMIN: "Company admin",

};



const USER_TYPE_STYLES: Record<UserType, string> = {
  PRACTICE: "bg-cyan-500/15 text-cyan-700 ring-1 ring-cyan-500/25 dark:text-cyan-300",
  COMPANY_CANDIDATE: "bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/25 dark:text-indigo-300",
  INVITED: "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-300",
  COMPANY_ADMIN: "bg-success/12 text-success ring-1 ring-success/25",
};

/** Vibrant bar colors — visible on light and dark admin backgrounds */
const NEW_USER_BAR_COLORS = [
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
  "#0ea5e9",
  "#22c55e",
  "#f97316",
];



type NewUsersPeriod = "week" | "month" | "year";



const NEW_USERS_PERIOD_LABELS: Record<NewUsersPeriod, { title: string; subtitle: string }> = {

  week: {

    title: "New users (last 7 days)",

    subtitle: "First-time appearance by email — daily breakdown.",

  },

  month: {

    title: "New users (last 30 days)",

    subtitle: "First-time appearance by email — daily breakdown.",

  },

  year: {

    title: "New users (last 12 months)",

    subtitle: "First-time appearance by email — monthly breakdown.",

  },

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



const WHAT_IT_TRACKS = [

  {

    icon: GraduationCap,

    title: "Practice users",

    description:

      "Anyone who booked or completed a self-serve AI practice interview on /practice. Identified by candidate email on practice sessions.",

  },

  {

    icon: Building2,

    title: "Company candidates",

    description:

      "People invited by a company for a hiring interview, or listed in a company candidate roster. Includes completed and in-progress company sessions.",

  },

  {

    icon: Mail,

    title: "Invited (not yet interviewed)",

    description:

      "Emails that received a requirement invite link but may not have started an interview yet. Useful for measuring invite-to-join conversion.",

  },

  {

    icon: UserCheck,

    title: "Company admins",

    description:

      "Login emails for company portals (/company-login). One admin email per onboarded company.",

  },

] as const;



function formatRelativeDate(value: string) {

  const date = new Date(value);

  const diffMs = Date.now() - date.getTime();

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";

  if (diffDays === 1) return "Yesterday";

  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString();

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

        setError(payload.error ?? "Unable to load user analytics.");

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



  const summaryCards = [

    { label: "Total unique users", value: data?.summary.totalUniqueUsers ?? 0, icon: Users },

    { label: "Active (30 days)", value: data?.summary.activeLast30Days ?? 0, icon: UserPlus },

    { label: "Returning users", value: data?.summary.returningUsers ?? 0, icon: UserCheck },

    { label: "Completion rate", value: `${data?.summary.completionRatePct ?? 0}%`, icon: BarChart3 },

  ];



  const audienceCards = [

    { label: "Practice users", value: data?.summary.practiceUsers ?? 0, icon: GraduationCap },

    { label: "Company candidates", value: data?.summary.companyCandidates ?? 0, icon: Building2 },

    { label: "Invited emails", value: data?.summary.invitedUsers ?? 0, icon: Mail },

    { label: "Company admins", value: data?.summary.companyAdmins ?? 0, icon: UserCheck },

  ];



  const newUsersChart = useMemo(

    () => buildNewUsersChart(data?.users ?? [], newUsersPeriod),

    [data?.users, newUsersPeriod],

  );



  const maxNewUsersCount = Math.max(1, ...newUsersChart.map((item) => item.count));



  const newUsersPeriodMeta = NEW_USERS_PERIOD_LABELS[newUsersPeriod];



  return (

    <MasterShell

      title="User Analytics"

      subtitle="Understand who uses Uhired — practice candidates, company hires, invites, and admins."

      topActions={

        <button

          type="button"

          onClick={() => void load()}

          disabled={loading}

          className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 !py-2.5 disabled:opacity-60`}

        >

          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />

          Refresh

        </button>

      }

    >

      <div className="space-y-5">

        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}



        <MasterHero

          badge="Platform users"

          title="User analytics"

          subtitle="A platform-wide view of people interacting with Uhired across practice, hiring, and admin flows."

        />



        <MasterInfoCard title="What is User Analytics?">

          <p className="text-sm leading-relaxed text-muted-foreground">

            This page gives you a <strong className="font-semibold text-foreground">platform-wide view of people</strong>{" "}

            interacting with Uhired — not company-by-company, but across the entire ecosystem. Users are grouped by

            email from practice bookings, company interview sessions, invite lists, and admin accounts. Use it to see

            growth, engagement, popular tracks, and who is returning for more sessions.

          </p>

        </MasterInfoCard>



        <div className="grid gap-5 xl:grid-cols-2">

          <MasterCard title="Who gets counted?" subtitle="Four audience types tracked on this dashboard.">

            <ul className="space-y-3">

              {WHAT_IT_TRACKS.map((item) => {

                const Icon = item.icon;

                return (

                  <li key={item.title} className="flex gap-3 rounded-xl border border-border bg-muted/70 p-3">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">

                      <Icon className="h-4 w-4" aria-hidden="true" />

                    </span>

                    <div>

                      <p className="text-sm font-semibold text-foreground">{item.title}</p>

                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.description}</p>

                    </div>

                  </li>

                );

              })}

            </ul>

          </MasterCard>



          <MasterCard title="Key metrics explained">

            <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">

              <li>

                <strong className="font-semibold text-foreground">Total unique users</strong> — distinct emails across all

                sources. One person can appear in multiple categories.

              </li>

              <li>

                <strong className="font-semibold text-foreground">Active (30 days)</strong> — users with any session or

                invite activity in the last month.

              </li>

              <li>

                <strong className="font-semibold text-foreground">Returning users</strong> — people with 2 or more interview

                sessions (practice or company).

              </li>

              <li>

                <strong className="font-semibold text-foreground">Completion rate</strong> — share of all sessions that

                reached COMPLETED status.

              </li>

              <li>

                <strong className="font-semibold text-foreground">Top tracks</strong> — most popular interview domains by

                session volume.

              </li>

            </ul>



            <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200">

              <strong className="font-semibold">Note:</strong> Uhired does not have a single “user account” table yet. Analytics

              are derived from session emails, company admin logins, and invite records — the same data your platform already

              collects during bookings and hiring flows.

            </div>

          </MasterCard>

        </div>



        <div className="grid gap-3 md:grid-cols-4">

          {summaryCards.map((card) => (

            <MasterKpiCard

              key={card.label}

              label={card.label}

              value={card.value}

              icon={card.icon}

              accent="bg-primary/12 text-primary"

            />

          ))}

        </div>



        <div className="grid gap-3 md:grid-cols-4">

          {audienceCards.map((card) => (

            <MasterKpiCard

              key={card.label}

              label={card.label}

              value={card.value}

              icon={card.icon}

              accent="bg-primary/12 text-primary"

            />

          ))}

        </div>



        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">

          <MasterCard

            title={newUsersPeriodMeta.title}

            subtitle={newUsersPeriodMeta.subtitle}

            headerAction={
              <div className="flex rounded-lg border border-border bg-surface/50 p-1">
                {(["week", "month", "year"] as const).map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => setNewUsersPeriod(period)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                      newUsersPeriod === period
                        ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={
                      newUsersPeriod === period ? { background: "var(--gradient-brand)" } : undefined
                    }
                  >
                    {period}
                  </button>
                ))}
              </div>
            }
          >
            <div
              className={`flex h-56 items-end gap-2 rounded-xl border border-border bg-surface/25 p-4 ${
                newUsersPeriod === "month" ? "overflow-x-auto" : ""
              }`}
            >
              {newUsersChart.map((point, index) => {
                const barColor =
                  point.count > 0
                    ? NEW_USER_BAR_COLORS[index % NEW_USER_BAR_COLORS.length]
                    : "color-mix(in oklab, var(--foreground) 12%, transparent)";
                const isPeak = point.count === maxNewUsersCount && point.count > 0;
                return (
                  <div
                    key={`${point.label}-${index}`}
                    className={`group flex flex-col items-center gap-2 ${
                      newUsersPeriod === "month" ? "min-w-[1.35rem] flex-none" : "flex-1"
                    }`}
                  >
                    <p className="text-xs font-bold text-foreground">{point.count}</p>
                    <div
                      className={`w-full min-w-[0.5rem] max-w-[2.5rem] rounded-t-lg transition-all duration-300 group-hover:opacity-90 ${
                        isPeak ? "ring-2 ring-white/40 shadow-lg" : ""
                      }`}
                      style={{
                        height: `${Math.max(point.count > 0 ? 20 : 6, (point.count / maxNewUsersCount) * 148)}px`,
                        background: barColor,
                        boxShadow: point.count > 0 ? `0 4px 14px ${barColor}55` : undefined,
                      }}
                      title={`${point.label}: ${point.count} new users`}
                    />
                    <p
                      className={`font-semibold text-muted-foreground ${
                        newUsersPeriod === "month" ? "text-[9px]" : "text-[10px]"
                      }`}
                    >
                      {point.label}
                    </p>
                  </div>
                );
              })}
            </div>

          </MasterCard>



          <MasterCard title="Audience overlap" subtitle="How user types relate to each other.">

            <div className="space-y-3 text-sm">

              <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2">

                <span className="text-muted-foreground">Practice only</span>

                <span className="font-bold text-foreground">{data?.userTypeBreakdown.practiceOnly ?? 0}</span>

              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2">

                <span className="text-muted-foreground">Company candidate only</span>

                <span className="font-bold text-foreground">{data?.userTypeBreakdown.companyOnly ?? 0}</span>

              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2">

                <span className="text-muted-foreground">Both practice & company</span>

                <span className="font-bold text-foreground">{data?.userTypeBreakdown.bothPracticeAndCompany ?? 0}</span>

              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2">

                <span className="text-muted-foreground">Admins only</span>

                <span className="font-bold text-foreground">{data?.userTypeBreakdown.adminsOnly ?? 0}</span>

              </div>

            </div>



            <div className="mt-5 border-t border-border pt-4">

              <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Session split</p>

              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">

                <div className="rounded-lg bg-cyan-500/15 px-3 py-2 text-cyan-800 ring-1 ring-cyan-500/25 dark:text-cyan-200">

                  Practice: <strong>{data?.sessionBreakdown.practice ?? 0}</strong>

                </div>

                <div className="rounded-lg bg-indigo-500/15 px-3 py-2 text-indigo-800 ring-1 ring-indigo-500/25 dark:text-indigo-200">

                  Company: <strong>{data?.sessionBreakdown.company ?? 0}</strong>

                </div>

                <div className="rounded-lg bg-success/12 px-3 py-2 text-success ring-1 ring-success/25">

                  Completed: <strong>{data?.sessionBreakdown.completed ?? 0}</strong>

                </div>

                <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-amber-900 ring-1 ring-amber-500/25 dark:text-amber-200">

                  Live now: <strong>{data?.sessionBreakdown.live ?? 0}</strong>

                </div>

              </div>

            </div>

          </MasterCard>

        </div>



        <MasterCard

          title="Top interview tracks"

          subtitle="Domains with the highest user and session volume."

        >

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

            {(data?.topDomains ?? []).map((track) => (

              <article key={track.domain} className="rounded-xl border border-border bg-muted/70 p-4">

                <p className="text-sm font-semibold text-foreground">{track.domain}</p>

                <p className="mt-2 text-xs text-muted-foreground">{track.users} users · {track.sessions} sessions</p>

              </article>

            ))}

            {!data?.topDomains?.length ? (

              <p className="text-sm text-muted-foreground">No interview data yet.</p>

            ) : null}

          </div>

        </MasterCard>



        <MasterCard

          title="User directory"

          subtitle="Search and filter all known emails. Sorted by most recent activity."

          headerAction={

            <div className="flex flex-wrap gap-2">

              <input

                value={search}

                onChange={(event) => setSearch(event.target.value)}

                placeholder="Search name, email, track..."

                className={masterInputClass}

              />

              <MasterSelect

                value={typeFilter}

                onValueChange={(value) => setTypeFilter(value as "ALL" | UserType)}

                className="min-w-[12rem]"

                aria-label="Filter by user type"

                options={[

                  { value: "ALL", label: "All types" },

                  { value: "PRACTICE", label: "Practice users" },

                  { value: "COMPANY_CANDIDATE", label: "Company candidates" },

                  { value: "INVITED", label: "Invited" },

                  { value: "COMPANY_ADMIN", label: "Company admins" },

                ]}

              />

            </div>

          }

        >

          <div className="overflow-x-auto">

            <table className="w-full min-w-[960px] text-left text-sm">

              <thead>

                <tr className={masterTableHeadClass}>

                  <th className="py-3 pr-4">User</th>

                  <th className="pr-4">Types</th>

                  <th className="pr-4">Sessions</th>

                  <th className="pr-4">Avg score</th>

                  <th className="pr-4">Primary track</th>

                  <th className="pr-4">Last active</th>

                  <th className="pr-4">First seen</th>

                </tr>

              </thead>

              <tbody>

                {(data?.users ?? []).map((user) => (

                  <tr key={user.email} className="border-b border-border transition hover:bg-surface/40">

                    <td className="py-4 pr-4">

                      <p className="font-semibold text-foreground">{user.name}</p>

                      <p className="text-xs text-muted-foreground">{user.email}</p>

                      {user.companies.length ? (

                        <p className="mt-1 text-xs text-muted-foreground">{user.companies.join(", ")}</p>

                      ) : null}

                    </td>

                    <td className="pr-4">

                      <div className="flex flex-wrap gap-1">

                        {user.types.map((type) => (

                          <span

                            key={type}

                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${USER_TYPE_STYLES[type]}`}

                          >

                            {USER_TYPE_LABELS[type]}

                          </span>

                        ))}

                      </div>

                    </td>

                    <td className="pr-4">

                      <p className="font-medium text-foreground">{user.sessionCount}</p>

                      <p className="text-xs text-muted-foreground">

                        {user.completedCount} completed

                        {user.isReturning ? " · returning" : ""}

                      </p>

                    </td>

                    <td className="pr-4 text-foreground">{user.avgScore ?? "—"}</td>

                    <td className="pr-4 text-foreground/90">{user.primaryTrack}</td>

                    <td className="pr-4 text-muted-foreground">{formatRelativeDate(user.lastActiveAt)}</td>

                    <td className="pr-4 text-muted-foreground">{formatRelativeDate(user.firstSeenAt)}</td>

                  </tr>

                ))}

              </tbody>

            </table>

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



          {!loading && !(data?.pagination.total ?? 0) ? (

            <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/50 px-4 py-8 text-center">

              <p className="text-sm font-semibold text-foreground">No users match your filters</p>

              <p className="mt-2 text-sm text-muted-foreground">

                Users appear here after someone books a practice session, gets invited by a company, or a company admin is

                onboarded.

              </p>

            </div>

          ) : null}



          {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading user analytics…</p> : null}

        </MasterCard>

      </div>

    </MasterShell>

  );

}



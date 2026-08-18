"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
import { MasterShell } from "@/components/master-shell";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  MasterPageSize,
  MasterPagination,
} from "@/components/master-pagination";
import {
  MasterAlert,
  MasterCard,
  MasterKpiCard,
  MasterSelect,
  masterBtnPrimary,
  masterBtnGhost,
  masterInputClass,
  MasterRowActionsMenu,
  masterTableHeadClass,
} from "@/components/master-ui";

type CompaniesResponse = {
  metrics: {
    totalCompanies: number;
    activeEnterprise: number;
    totalAiSessions: number;
    inactiveCompanies: number;
  };
  companies: Array<{
    id: string;
    companyName: string;
    domain: string;
    adminEmail: string;
    hasPasscode: boolean;
    interviewerName: string;
    interviewerVoiceGender: "MALE" | "FEMALE";
    isActive: boolean;
    totalSessions: number;
    activeSessions: number;
    lastActivity: string | null;
    plan: "ENTERPRISE" | "STANDARD";
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type CompanyRow = CompaniesResponse["companies"][number];

function companyInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatRelativeTime(iso: string | null) {
  if (!iso) return "No activity yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function AddCompanyLink() {
  return (
    <Link href="/master/companies/new" className={`${masterBtnPrimary} inline-flex items-center gap-2`}>
      <Plus className="h-4 w-4" />
      Add company
    </Link>
  );
}

export default function MasterCompaniesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CompaniesResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "inactive">("ALL");
  const [planFilter, setPlanFilter] = useState<"ALL" | "ENTERPRISE" | "STANDARD">("ALL");

  const hasActiveFilters = Boolean(appliedSearch) || statusFilter !== "ALL" || planFilter !== "ALL";
  const companies = data?.companies ?? [];
  const totalCompanies = data?.pagination.total ?? 0;

  async function parseJsonSafe<T>(res: Response): Promise<T | null> {
    const raw = await res.text();
    if (!raw.trim()) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (appliedSearch) {
      params.set("search", appliedSearch);
    }
    if (statusFilter === "active") params.set("isActive", "true");
    if (statusFilter === "inactive") params.set("isActive", "false");
    if (planFilter !== "ALL") params.set("plan", planFilter);
    try {
      const res = await fetch(`/api/master/companies?${params.toString()}`);
      const payload = await parseJsonSafe<CompaniesResponse & { error?: string }>(res);
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload?.error ?? "Unable to load companies.");
        return;
      }
      if (!payload) {
        setError("Unable to load companies.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, appliedSearch, statusFilter, planFilter]);

  useEffect(() => {
    const q = searchParams.get("search");
    if (q) {
      setSearchInput(q);
      setAppliedSearch(q);
      setPage(1);
    }
    const notice = searchParams.get("notice");
    if (notice === "created") {
      setSuccess("Company created.");
      toast.success("Company created successfully.");
    } else if (notice === "updated") {
      setSuccess("Company updated.");
      toast.success("Company updated successfully.");
    }
    if (notice) {
      router.replace("/master/companies", { scroll: false });
    }
  }, [searchParams, router, toast]);

  useEffect(() => {
    if (!success || /passcode/i.test(success)) return;
    const timer = window.setTimeout(() => setSuccess(""), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch() {
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  async function regeneratePasscode(company: CompanyRow) {
    const ok = await confirm({
      title: `Generate a new passcode for ${company.companyName}?`,
      message: "The current passcode will stop working. Copy the new one and share it with the company admin.",
      confirmLabel: "Generate new passcode",
    });
    if (!ok) return;

    setError("");
    const res = await fetch(`/api/master/companies/${company.id}/passcode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const payload = await parseJsonSafe<{ error?: string; passcode?: string }>(res);
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    if (!res.ok) {
      setError(payload?.error ?? "Unable to regenerate passcode.");
      return;
    }
    if (payload?.passcode) {
      const message = `New passcode for ${company.companyName} — copy and share securely: ${payload.passcode}`;
      setSuccess(message);
      toast.success("New passcode generated. Copy it from the banner above.");
    }
    await load();
  }

  async function deleteCompany(company: CompanyRow) {
    const ok = await confirm({
      title: `Delete "${company.companyName}"?`,
      message:
        "Related requirements and candidates will be removed. Interview history will remain but lose company links. This action cannot be undone.",
      confirmLabel: "Delete company",
      variant: "danger",
    });
    if (!ok) return;

    setError("");
    setSuccess("");
    const res = await fetch(`/api/master/companies/${company.id}`, { method: "DELETE" });
    const payload = await parseJsonSafe<{ error?: string }>(res);
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    if (!res.ok) {
      setError(payload?.error ?? "Unable to delete company.");
      return;
    }
    setSuccess(`"${company.companyName}" deleted.`);
    toast.success(`"${company.companyName}" deleted successfully.`);
    await load();
  }

  async function toggleActive(company: CompanyRow) {
    setError("");
    const nextActive = !company.isActive;
    const res = await fetch("/api/master/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: company.id,
        companyName: company.companyName,
        domain: company.domain,
        adminEmail: company.adminEmail,
        interviewerName: company.interviewerName,
        interviewerVoiceGender: company.interviewerVoiceGender,
        isActive: nextActive,
      }),
    });
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    if (!res.ok) {
      const payload = await parseJsonSafe<{ error?: string }>(res);
      setError(payload?.error ?? "Unable to update company status.");
      return;
    }
    toast.success(nextActive ? "Company activated." : "Company deactivated.");
    await load();
  }

  return (
    <MasterShell
      title="Company Directory"
      subtitle="Browse existing clients first. Open a company to edit it, or add a new account."
      topActions={
        <button
          type="button"
          onClick={() => void load()}
          className="admin-btn-ghost inline-flex items-center gap-2 !px-4 !py-2.5"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}
        {success ? <MasterAlert variant="success">{success}</MasterAlert> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MasterKpiCard
            label="Companies"
            value={data ? data.metrics.totalCompanies : "—"}
            hint="Client accounts on this list"
            icon={Building2}
            accent="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/25"
          />
          <MasterKpiCard
            label="Active Enterprise"
            value={data ? data.metrics.activeEnterprise : "—"}
            hint="Live companies on the Enterprise plan"
            icon={Shield}
            accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25"
          />
          <MasterKpiCard
            label="AI sessions"
            value={data ? data.metrics.totalAiSessions : "—"}
            hint="Interviews run across these companies"
            icon={Activity}
            accent="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/25"
          />
          <MasterKpiCard
            label="Inactive companies"
            value={data ? data.metrics.inactiveCompanies : "—"}
            hint="Accounts turned off on this list"
            icon={PauseCircle}
            accent="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25"
          />
        </section>

        <MasterCard
          elevated
          title="Companies"
          subtitle={
            loading
              ? "Loading client accounts…"
              : `${totalCompanies.toLocaleString()} ${totalCompanies === 1 ? "client" : "clients"}. Search to find one, or add a new account.`
          }
          headerAction={<AddCompanyLink />}
        >
          <div className="mb-4 rounded-xl border border-border bg-muted/60 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[200px] flex-1 space-y-1.5">
                <span className="admin-label">Find a company</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applySearch();
                    }}
                    placeholder="Name, domain, or admin email"
                    className={`${masterInputClass} w-full pl-10`}
                  />
                </div>
              </label>
              <label className="min-w-[11rem] space-y-1.5">
                <span className="admin-label">Plan</span>
                <MasterSelect
                  value={planFilter}
                  onValueChange={(value) => {
                    setPlanFilter(value as typeof planFilter);
                    setPage(1);
                  }}
                  options={[
                    { value: "ALL", label: "All plans" },
                    { value: "ENTERPRISE", label: "Enterprise" },
                    { value: "STANDARD", label: "Standard" },
                  ]}
                  aria-label="Filter by plan"
                />
              </label>
              <label className="min-w-[11rem] space-y-1.5">
                <span className="admin-label">Status</span>
                <MasterSelect
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value as typeof statusFilter);
                    setPage(1);
                  }}
                  options={[
                    { value: "ALL", label: "All statuses" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                  ]}
                  aria-label="Filter by status"
                />
              </label>
              <button type="button" onClick={applySearch} className={`${masterBtnPrimary} !px-5`}>
                Search
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setAppliedSearch("");
                    setStatusFilter("ALL");
                    setPlanFilter("ALL");
                    setPage(1);
                  }}
                  className={`${masterBtnGhost} inline-flex items-center gap-1.5 !px-4`}
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              ) : null}
            </div>
            {hasActiveFilters ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {appliedSearch ? (
                  <span className="rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-border">
                    Search: {appliedSearch}
                  </span>
                ) : null}
                {planFilter !== "ALL" ? (
                  <span className="rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-border">
                    Plan: {planFilter}
                  </span>
                ) : null}
                {statusFilter !== "ALL" ? (
                  <span className="rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-border">
                    Status: {statusFilter}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">Loading companies…</p>
              <p className="mt-1 text-sm text-muted-foreground">Fetching the latest client accounts.</p>
            </div>
          ) : companies.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {hasActiveFilters ? "No companies match these filters" : "No companies yet"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Clear search or filters to see the full directory."
                  : "Add the first client account to give them a login, interviewer voice, and interview workspace."}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setAppliedSearch("");
                      setStatusFilter("ALL");
                      setPlanFilter("ALL");
                      setPage(1);
                    }}
                    className={masterBtnGhost}
                  >
                    Clear filters
                  </button>
                ) : (
                  <AddCompanyLink />
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className={masterTableHeadClass}>
                      <th className="py-2 pr-3">Company</th>
                      <th className="pr-3">Work email</th>
                      <th className="pr-3">Interviewer</th>
                      <th className="pr-3">Plan</th>
                      <th className="pr-3">Sessions</th>
                      <th className="pr-3">Last activity</th>
                      <th className="pr-3">Status</th>
                      <th className="w-10 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((company) => (
                      <tr key={company.id} className="border-b border-border transition hover:bg-surface/50">
                        <td className="py-3 pr-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-xs font-bold text-white">
                              {companyInitial(company.companyName)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/master/companies/${company.id}`}
                                className="truncate font-semibold text-foreground hover:underline"
                              >
                                {company.companyName}
                              </Link>
                              <p className="truncate text-xs text-muted-foreground">{company.domain}</p>
                            </div>
                          </div>
                        </td>
                        <td className="pr-3">
                          <p className="truncate text-foreground/80">{company.adminEmail}</p>
                          <p className="text-[11px] text-muted-foreground">Used to sign in</p>
                        </td>
                        <td className="pr-3 text-foreground/80">
                          {company.interviewerName?.trim() ? (
                            <>
                              {company.interviewerName}
                              <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                                ({company.interviewerVoiceGender === "FEMALE" ? "Female" : "Male"})
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Default</span>
                          )}
                        </td>
                        <td className="pr-3">
                          <span className="rounded-full bg-indigo-500/12 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-600 ring-1 ring-indigo-500/25 dark:text-indigo-300">
                            {company.plan}
                          </span>
                        </td>
                        <td className="pr-3 text-foreground/80">{company.totalSessions.toLocaleString()}</td>
                        <td
                          className="pr-3 text-xs text-muted-foreground"
                          title={company.lastActivity ? new Date(company.lastActivity).toLocaleString() : undefined}
                        >
                          {formatRelativeTime(company.lastActivity)}
                        </td>
                        <td className="pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                              company.isActive
                                ? "bg-success/12 text-success ring-success/25"
                                : "bg-surface/80 text-muted-foreground ring-border"
                            }`}
                          >
                            {company.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <MasterRowActionsMenu
                            label={company.companyName}
                            actions={[
                              {
                                label: "View",
                                onClick: () => router.push(`/master/companies/${company.id}`),
                              },
                              {
                                label: "Edit",
                                onClick: () => router.push(`/master/companies/${company.id}/edit`),
                              },
                              {
                                label: company.isActive ? "Deactivate" : "Activate",
                                onClick: () => void toggleActive(company),
                                danger: company.isActive,
                              },
                              {
                                label: "Regen passcode",
                                onClick: () => void regeneratePasscode(company),
                              },
                              {
                                label: "Delete",
                                onClick: () => void deleteCompany(company),
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <MasterPagination
                page={page}
                pageSize={pageSize}
                totalItems={totalCompanies}
                itemLabel="companies"
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          )}
        </MasterCard>
      </div>
    </MasterShell>
  );
}

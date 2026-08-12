"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  Globe,
  KeyRound,
  Mail,
  Mic,
  RefreshCw,
  Search,
  Shield,
  User,
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
  MasterHero,
  MasterKpiCard,
  masterBtnPrimary,
  masterBtnGhost,
  masterInputClass,
  masterRowActionClass,
  masterRowActionDangerClass,
  masterTableHeadClass,
} from "@/components/master-ui";

type CompaniesResponse = {
  metrics: {
    totalCompanies: number;
    activeEnterprise: number;
    totalAiSessions: number;
    systemHealthPct: number;
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

export default function MasterCompaniesPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CompaniesResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    companyId: "",
    companyName: "",
    domain: "",
    adminEmail: "",
    adminPasscode: "",
    interviewerName: "",
    interviewerVoiceGender: "MALE" as "MALE" | "FEMALE",
    isActive: true,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const editFormRef = useRef<HTMLDivElement>(null);

  const hasActiveFilters = Boolean(appliedSearch);
  const isEditing = Boolean(form.companyId);

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
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (appliedSearch) {
      params.set("search", appliedSearch);
    }
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
  }, [router, page, pageSize, appliedSearch]);

  useEffect(() => {
    const q = searchParams.get("search");
    if (q) {
      setSearchInput(q);
      setAppliedSearch(q);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    void load();
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) {
        return;
      }
      intervalId = setInterval(() => {
        void load();
      }, 30000);
    };

    const stopPolling = () => {
      if (!intervalId) {
        return;
      }
      clearInterval(intervalId);
      intervalId = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void load();
        startPolling();
      } else {
        stopPolling();
      }
    };

    const onFocus = () => {
      void load();
      startPolling();
    };

    if (document.visibilityState === "visible") {
      startPolling();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  function resetForm() {
    setForm({
      companyId: "",
      companyName: "",
      domain: "",
      adminEmail: "",
      adminPasscode: "",
      interviewerName: "",
      interviewerVoiceGender: "MALE",
      isActive: true,
    });
  }

  async function saveCompany() {
    setError("");
    setSuccess("");
    setSaving(true);
    const wasEditing = Boolean(form.companyId);
    try {
      const requestBody: Record<string, unknown> = {
        companyId: form.companyId || undefined,
        companyName: form.companyName,
        domain: form.domain,
        adminEmail: form.adminEmail,
        interviewerName: form.interviewerName,
        interviewerVoiceGender: form.interviewerVoiceGender,
        isActive: form.isActive,
      };
      if (form.adminPasscode.trim()) {
        requestBody.adminPasscode = form.adminPasscode.trim();
      }

      const res = await fetch("/api/master/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await parseJsonSafe<{ error?: string }>(res);
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload?.error ?? "Unable to save company.");
        return;
      }
      resetForm();
      const message = wasEditing ? "Company updated." : "Company created.";
      setSuccess(message);
      toast.success(wasEditing ? "Company updated successfully." : "Company created successfully.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function regeneratePasscode(companyId: string) {
    setError("");
    const res = await fetch(`/api/master/companies/${companyId}/passcode`, {
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
      const message = `New passcode generated — copy and share securely: ${payload.passcode}`;
      setSuccess(message);
      toast.success("New passcode generated successfully.");
    }
    if (form.companyId === companyId) {
      setForm((prev) => ({ ...prev, adminPasscode: "" }));
    }
    await load();
  }

  function editCompany(company: CompaniesResponse["companies"][number]) {
    setError("");
    setSuccess("");
    setForm({
      companyId: company.id,
      companyName: company.companyName,
      domain: company.domain,
      adminEmail: company.adminEmail,
      adminPasscode: "",
      interviewerName: company.interviewerName ?? "",
      interviewerVoiceGender: company.interviewerVoiceGender ?? "MALE",
      isActive: company.isActive,
    });
    toast.info(`Editing "${company.companyName}". Update the form and click Update Company.`);
    window.setTimeout(() => {
      editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function deleteCompany(company: CompaniesResponse["companies"][number]) {
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
    if (form.companyId === company.id) {
      resetForm();
    }
    setSuccess(`"${company.companyName}" deleted.`);
    toast.success(`"${company.companyName}" deleted successfully.`);
    await load();
  }

  async function toggleActive(company: CompaniesResponse["companies"][number]) {
    setForm({
      companyId: company.id,
      companyName: company.companyName,
      domain: company.domain,
      adminEmail: company.adminEmail,
      adminPasscode: "",
      interviewerName: company.interviewerName ?? "",
      interviewerVoiceGender: company.interviewerVoiceGender ?? "MALE",
      isActive: !company.isActive,
    });
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
        isActive: !company.isActive,
      }),
    });
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    toast.success(company.isActive ? "Company deactivated." : "Company activated.");
    await load();
  }

  return (
    <MasterShell
      title="Company Directory"
      subtitle="Manage corporate access, usage tiers, and organizational health metrics."
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

        <MasterHero
          badge="Company management"
          title="Corporate access & tenant health"
          subtitle="Create tenants, manage interviewer profiles, and monitor organizational usage."
        />

        {!isEditing ? (
        <MasterCard
          title="Add a new company"
          subtitle="Set up a client organization, their admin login, and how the AI interviewer sounds to candidates."
        >
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">Company details</h3>
                  <p className="mt-0.5 text-sm text-slate-500">
                    How this organization appears in the system and on their login screen.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="admin-label">Company name</span>
                  <input
                    value={form.companyName}
                    onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                    placeholder="e.g. Link TMS"
                    className={masterInputClass}
                  />
                  <span className="text-xs text-slate-500">The name the company admin enters when logging in.</span>
                </label>
                <label className="block space-y-1.5">
                  <span className="admin-label">Company domain</span>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.domain}
                      onChange={(event) => setForm((prev) => ({ ...prev, domain: event.target.value }))}
                      placeholder="e.g. linktms.com"
                      className={`${masterInputClass} pl-10`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">Their website or email domain (e.g. acme.com).</span>
                </label>
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-100 pt-8">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">Admin login credentials</h3>
                  <p className="mt-0.5 text-sm text-slate-500">
                    The company admin uses these at <span className="font-medium">Company Login</span> to access their
                    hiring dashboard.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="admin-label">Admin email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={form.adminEmail}
                      onChange={(event) => setForm((prev) => ({ ...prev, adminEmail: event.target.value }))}
                      placeholder="admin@company.com"
                      className={`${masterInputClass} pl-10`}
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <span className="admin-label">Admin passcode</span>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={form.adminPasscode}
                      onChange={(event) => setForm((prev) => ({ ...prev, adminPasscode: event.target.value }))}
                      placeholder="Create a secure passcode"
                      className={`${masterInputClass} pl-10`}
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    Share this with the client. Use Regen Passcode in the table below if they lose it.
                  </span>
                </label>
              </div>
            </section>

            <section className="space-y-4 border-t border-slate-100 pt-8">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Mic className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0f172a]">AI interviewer</h3>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Candidates hear this name and voice during every interview for this company.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="admin-label">Interviewer name</span>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.interviewerName}
                      onChange={(event) => setForm((prev) => ({ ...prev, interviewerName: event.target.value }))}
                      placeholder="e.g. Alex, Emma"
                      className={`${masterInputClass} pl-10`}
                    />
                  </div>
                </label>
                <label className="block space-y-1.5">
                  <span className="admin-label">Voice</span>
                  <select
                    value={form.interviewerVoiceGender}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        interviewerVoiceGender: event.target.value as "MALE" | "FEMALE",
                      }))
                    }
                    className={masterInputClass}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <span className="block text-sm font-semibold text-[#0f172a]">Company is active</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Inactive companies cannot log in or run new interviews.
                  </span>
                </span>
              </label>
            </section>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={() => void saveCompany()}
                className={masterBtnPrimary}
                disabled={saving}
              >
                {saving ? "Saving..." : "Create Company"}
              </button>
            </div>
          </div>
        </MasterCard>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MasterKpiCard
            label="Total Companies"
            value={data?.metrics.totalCompanies ?? 0}
            icon={Building2}
            accent="bg-blue-50 text-blue-600"
          />
          <MasterKpiCard
            label="Active Enterprise"
            value={data?.metrics.activeEnterprise ?? 0}
            icon={Shield}
            accent="bg-emerald-50 text-emerald-600"
          />
          <MasterKpiCard
            label="Total AI Sessions"
            value={data?.metrics.totalAiSessions ?? 0}
            icon={Activity}
            accent="bg-violet-50 text-violet-600"
          />
          <MasterKpiCard
            label="System Health"
            value={`${data?.metrics.systemHealthPct ?? 0}%`}
            icon={AlertTriangle}
            accent="bg-amber-50 text-amber-600"
          />
        </section>

        {isEditing ? (
          <div ref={editFormRef} className="scroll-mt-24">
            <MasterCard
              title={`Edit company — ${form.companyName}`}
              subtitle="Update this organization's details, admin login, and AI interviewer settings."
            >
              <div className="mb-5 rounded-xl border border-blue-200/80 bg-blue-50/60 px-4 py-3">
                <p className="text-sm text-blue-900">
                  You are editing <span className="font-semibold">{form.companyName}</span>. Changes apply after you
                  click <span className="font-semibold">Update Company</span> below.
                </p>
              </div>

              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0f172a]">Company details</h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        How this organization appears in the system and on their login screen.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="admin-label">Company name</span>
                      <input
                        value={form.companyName}
                        onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                        placeholder="e.g. Link TMS"
                        className={masterInputClass}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="admin-label">Company domain</span>
                      <div className="relative">
                        <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={form.domain}
                          onChange={(event) => setForm((prev) => ({ ...prev, domain: event.target.value }))}
                          placeholder="e.g. linktms.com"
                          className={`${masterInputClass} pl-10`}
                        />
                      </div>
                    </label>
                  </div>
                </section>

                <section className="space-y-4 border-t border-slate-100 pt-8">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0f172a]">Admin login credentials</h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        The company admin uses these at Company Login to access their hiring dashboard.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="admin-label">Admin email</span>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          value={form.adminEmail}
                          onChange={(event) => setForm((prev) => ({ ...prev, adminEmail: event.target.value }))}
                          placeholder="admin@company.com"
                          className={`${masterInputClass} pl-10`}
                        />
                      </div>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="admin-label">New admin passcode (optional)</span>
                      <div className="relative">
                        <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="password"
                          value={form.adminPasscode}
                          onChange={(event) => setForm((prev) => ({ ...prev, adminPasscode: event.target.value }))}
                          placeholder="Leave blank to keep current passcode"
                          className={`${masterInputClass} pl-10`}
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        Passcodes are stored hashed. Use Regen Passcode in the table to reset.
                      </span>
                    </label>
                  </div>
                </section>

                <section className="space-y-4 border-t border-slate-100 pt-8">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                      <Mic className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#0f172a]">AI interviewer</h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        Candidates hear this name and voice during every interview for this company.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block space-y-1.5">
                      <span className="admin-label">Interviewer name</span>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={form.interviewerName}
                          onChange={(event) => setForm((prev) => ({ ...prev, interviewerName: event.target.value }))}
                          placeholder="e.g. Alex, Emma"
                          className={`${masterInputClass} pl-10`}
                        />
                      </div>
                    </label>
                    <label className="block space-y-1.5">
                      <span className="admin-label">Voice</span>
                      <select
                        value={form.interviewerVoiceGender}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            interviewerVoiceGender: event.target.value as "MALE" | "FEMALE",
                          }))
                        }
                        className={masterInputClass}
                      >
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-[#0f172a]">Company is active</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        Inactive companies cannot log in or run new interviews.
                      </span>
                    </span>
                  </label>
                </section>

                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-6">
                  <button type="button" onClick={resetForm} className="admin-btn-ghost !px-5 !py-2.5">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveCompany()}
                    className={masterBtnPrimary}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Update Company"}
                  </button>
                </div>
              </div>
            </MasterCard>
          </div>
        ) : null}

        <MasterCard elevated title="All companies">
          <div className="mb-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[200px] flex-1 space-y-1.5">
                <span className="admin-label">Search companies</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setAppliedSearch(searchInput.trim());
                        setPage(1);
                      }
                    }}
                    placeholder="Company name, domain, admin email..."
                    className={`${masterInputClass} w-full pl-10`}
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() => {
                  setAppliedSearch(searchInput.trim());
                  setPage(1);
                }}
                className={`${masterBtnPrimary} !px-5`}
              >
                Search
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setAppliedSearch("");
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
                <span className="rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-foreground ring-1 ring-border">
                  Search: {appliedSearch}
                </span>
              </div>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-2 pr-3">Company</th>
                  <th className="pr-3">Interviewer</th>
                  <th className="pr-3">Plan</th>
                  <th className="pr-3">Total Sessions</th>
                  <th className="pr-3">Last Activity</th>
                  <th className="pr-3">Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.companies ?? []).map((company) => {
                  const isSelected = form.companyId === company.id;
                  return (
                  <tr
                    key={company.id}
                    className={`border-b border-border transition hover:bg-surface/50 ${
                      isSelected ? "bg-primary/8 ring-1 ring-inset ring-primary/25" : ""
                    }`}
                  >
                    <td className="py-3 pr-3 font-semibold text-foreground">{company.companyName}</td>
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
                    <td className="pr-3 text-xs text-muted-foreground">
                      {company.lastActivity ? new Date(company.lastActivity).toLocaleString() : "—"}
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
                    <td className="space-x-2 py-2">
                      <button
                        type="button"
                        onClick={() => editCompany(company)}
                        className={`${masterRowActionClass} ${isSelected ? "!border-emerald-300 !bg-emerald-50 !text-emerald-800" : ""}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(company)}
                        className={company.isActive ? masterRowActionDangerClass : masterRowActionClass}
                      >
                        {company.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void regeneratePasscode(company.id)}
                        className={masterRowActionClass}
                      >
                        Regen Passcode
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCompany(company)}
                        className={masterRowActionDangerClass}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={data?.pagination.total ?? 0}
            itemLabel="companies"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </MasterCard>
      </div>
    </MasterShell>
  );
}

"use client";



import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import {

  ArrowRight,

  CircleDollarSign,

  Gift,

  GraduationCap,

  Link2,

  Mail,

  Megaphone,

  Clock,

  Search,

  TicketPercent,

  Users,

  X,

} from "lucide-react";

import { useConfirm, useToast } from "@/components/app-feedback";

import { MasterShell } from "@/components/master-shell";

import {

  MASTER_PAGE_SIZE_OPTIONS,

  MasterPageSize,

  MasterPagination,

  paginateItems,

} from "@/components/master-pagination";

import {

  MasterAlert,

  MasterCard,

  MasterHero,

  MasterInfoCard,

  MasterKpiCard,

  masterBtnPrimary,

  masterBtnGhost,

  masterInputClass,

  masterRowActionClass,

  masterRowActionDangerClass,

  masterTableHeadClass,

} from "@/components/master-ui";



type PromoRow = {

  id: string;

  code: string;

  durationMin: number;

  isActive: boolean;

  createdAt: string;

  usageCount: number;

  recipientEmail: string | null;

  companyName: string | null;

  emailSentAt: string | null;

};



type CompanyOption = {

  id: string;

  companyName: string;

  domain: string;

  adminEmail: string;

  isActive: boolean;

};



const USE_CASES = [

  {

    icon: Gift,

    title: "Free trial for candidates",

    description:

      "Let someone try a full AI practice interview without paying through Razorpay — useful for demos or VIP access.",

  },

  {

    icon: Megaphone,

    title: "Marketing & campaigns",

    description:

      "Share a code in emails, social posts, or ads (e.g. LAUNCH50) so users can book a session at no cost.",

  },

  {

    icon: GraduationCap,

    title: "Colleges & partners",

    description:

      "Give institutes or referral partners a dedicated code for their students or audience.",

  },

  {

    icon: Users,

    title: "Internal testing",

    description:

      "Create short-lived codes for your team to test the practice flow before a launch.",

  },

] as const;



const HOW_IT_WORKS = [

  "You create a code here and set how many minutes it unlocks (10–120 min).",

  "A candidate goes to the Practice page (/practice), fills their details, and enters your code.",

  "If the code is valid and the session duration matches exactly, payment is skipped.",

  "The session starts like a normal paid practice interview — AI interview + scorecard.",

  "Usage count below shows how many practice sessions were started with each code.",

] as const;



export default function MasterPromoCodesPage() {

  const router = useRouter();

  const confirm = useConfirm();

  const toast = useToast();

  const searchParams = useSearchParams();

  const [rows, setRows] = useState<PromoRow[]>([]);

  const [editingId, setEditingId] = useState("");

  const [code, setCode] = useState("");

  const [durationMin, setDurationMin] = useState(30);

  const [isActive, setIsActive] = useState(true);

  const [assignToUser, setAssignToUser] = useState(false);

  const [recipientEmail, setRecipientEmail] = useState("");

  const [companyName, setCompanyName] = useState("");

  const [companies, setCompanies] = useState<CompanyOption[]>([]);

  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [sendEmail, setSendEmail] = useState(true);

  const [sendingEmailId, setSendingEmailId] = useState("");

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(false);

  const [deleteId, setDeleteId] = useState("");

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const [tableSearch, setTableSearch] = useState("");

  const [appliedTableSearch, setAppliedTableSearch] = useState("");



  const filteredRows = useMemo(() => {

    if (!appliedTableSearch.trim()) return rows;

    const q = appliedTableSearch.trim().toLowerCase();

    return rows.filter(
      (row) =>
        row.code.toLowerCase().includes(q) ||
        (row.recipientEmail?.toLowerCase().includes(q) ?? false) ||
        (row.companyName?.toLowerCase().includes(q) ?? false),
    );

  }, [rows, appliedTableSearch]);



  const paginatedRows = useMemo(() => paginateItems(filteredRows, page, pageSize), [filteredRows, page, pageSize]);



  const loadPromoCodes = useCallback(async () => {

    const res = await fetch("/api/master/promo-codes");

    const payload = (await res.json()) as { promoCodes?: PromoRow[]; error?: string };

    if (res.status === 401) {

      router.push("/master-login");

      return;

    }

    if (!res.ok) {

      setError(payload.error ?? "Unable to load promo codes.");

      return;

    }

    setRows(payload.promoCodes ?? []);

  }, [router]);



  const loadCompanies = useCallback(async () => {

    setCompaniesLoading(true);

    try {

      const res = await fetch("/api/master/companies?all=true");

      const payload = (await res.json()) as { companies?: CompanyOption[]; error?: string };

      if (res.status === 401) {

        router.push("/master-login");

        return;

      }

      if (!res.ok) {

        setError(payload.error ?? "Unable to load companies.");

        return;

      }

      setCompanies(payload.companies ?? []);

    } finally {

      setCompaniesLoading(false);

    }

  }, [router]);



  useEffect(() => {

    void loadPromoCodes();

    void loadCompanies();

  }, [loadPromoCodes, loadCompanies]);



  useEffect(() => {

    const q = searchParams.get("search");

    if (q) {

      setTableSearch(q);

      setAppliedTableSearch(q);

      setPage(1);

    }

  }, [searchParams]);



  useEffect(() => {

    if (!success) return;

    const timer = window.setTimeout(() => setSuccess(""), 2200);

    return () => window.clearTimeout(timer);

  }, [success]);



  function buildShareLink(row: Pick<PromoRow, "code" | "durationMin" | "recipientEmail" | "companyName">) {

    if (typeof window === "undefined") return "";

    const url = new URL("/practice", window.location.origin);

    url.searchParams.set("promo", row.code);

    url.searchParams.set("duration", String(row.durationMin));

    if (row.recipientEmail) {
      url.searchParams.set("email", row.recipientEmail);
    }

    const company = companies.find((entry) => entry.companyName === row.companyName);

    if (company?.domain) {
      url.searchParams.set("domain", company.domain);
    }

    return url.toString();

  }



  async function copyShareLink(row: PromoRow) {

    const link = buildShareLink(row);

    try {

      await navigator.clipboard.writeText(link);

      setSuccess(`Link copied for ${row.code}.`);

      toast.success("Interview link copied to clipboard.");

    } catch {

      setError("Unable to copy link. Copy it manually from the table.");

    }

  }



  function resetPromoForm() {

    setEditingId("");

    setCode("");

    setDurationMin(30);

    setIsActive(true);

    setAssignToUser(false);

    setRecipientEmail("");

    setCompanyName("");

    setSendEmail(true);

  }



  function editPromoCode(row: PromoRow) {

    setEditingId(row.id);

    setCode(row.code);

    setDurationMin(row.durationMin);

    setIsActive(row.isActive);

    setAssignToUser(Boolean(row.recipientEmail));

    setRecipientEmail(row.recipientEmail ?? "");

    setCompanyName(row.companyName ?? "");

    setSendEmail(false);

    window.scrollTo({ top: 0, behavior: "smooth" });

  }



  async function savePromoCode(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setError("");

    setSuccess("");

    setLoading(true);

    try {

      const res = await fetch(

        editingId ? `/api/master/promo-codes/${editingId}` : "/api/master/promo-codes",

        {

          method: editingId ? "PATCH" : "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify(

            editingId

              ? {

                  code: code.trim().toUpperCase(),

                  durationMin,

                  isActive,

                  ...(assignToUser

                    ? {

                        recipientEmail: recipientEmail.trim(),

                        companyName: companyName.trim(),

                      }

                    : {

                        recipientEmail: "",

                        companyName: "",

                      }),

                }

              : {

                  code: code.trim().toUpperCase(),

                  durationMin,

                  ...(assignToUser

                    ? {

                        recipientEmail: recipientEmail.trim(),

                        companyName: companyName.trim(),

                        sendEmail,

                      }

                    : {}),

                },

          ),

        },

      );

      const payload = (await res.json()) as { error?: string; email?: { sent: boolean; error?: string } };

      if (res.status === 401) {

        router.push("/master-login");

        return;

      }

      if (!res.ok) {

        setError(payload.error ?? `Unable to ${editingId ? "update" : "create"} promo code.`);

        return;

      }

      const wasEditing = Boolean(editingId);

      resetPromoForm();

      if (!wasEditing && payload.email && !payload.email.sent && assignToUser) {

        setError(payload.email.error ?? "Promo code created, but email could not be sent.");

        toast.error(payload.email.error ?? "Promo code created, but email could not be sent.");

      } else {

        setSuccess(

          wasEditing

            ? "Promo code updated."

            : assignToUser && sendEmail

              ? "Promo code created and email sent."

              : "Promo code created.",

        );

        toast.success(

          wasEditing

            ? "Promo code updated successfully."

            : assignToUser && sendEmail

              ? "Promo code created and email sent."

              : "Promo code created successfully.",

        );

      }

      setPage(1);

      await loadPromoCodes();

    } finally {

      setLoading(false);

    }

  }



  async function togglePromoActive(row: PromoRow) {

    setError("");

    setSuccess("");

    const res = await fetch(`/api/master/promo-codes/${row.id}`, {

      method: "PATCH",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({ isActive: !row.isActive }),

    });

    const payload = (await res.json()) as { error?: string };

    if (res.status === 401) {

      router.push("/master-login");

      return;

    }

    if (!res.ok) {

      setError(payload.error ?? "Unable to update promo code status.");

      return;

    }

    setSuccess(`Promo code ${row.isActive ? "deactivated" : "activated"}.`);

    toast.success(row.isActive ? "Promo code deactivated." : "Promo code activated.");

    await loadPromoCodes();

  }



  async function createPromoCode(event: FormEvent<HTMLFormElement>) {

    await savePromoCode(event);

  }



  async function resendPromoEmail(row: PromoRow) {

    setError("");

    setSuccess("");

    setSendingEmailId(row.id);

    try {

      const res = await fetch(`/api/master/promo-codes/${row.id}/send-email`, { method: "POST" });

      const payload = (await res.json()) as { error?: string };

      if (res.status === 401) {

        router.push("/master-login");

        return;

      }

      if (!res.ok) {

        setError(payload.error ?? "Unable to send promo code email.");

        toast.error(payload.error ?? "Unable to send promo code email.");

        return;

      }

      setSuccess(`Email sent to ${row.recipientEmail}.`);

      toast.success(`Email sent to ${row.recipientEmail}.`);

      await loadPromoCodes();

    } finally {

      setSendingEmailId("");

    }

  }



  async function deletePromoCode(id: string) {

    const ok = await confirm({

      title: "Delete promo code?",

      message: "Existing sessions that used this code will remain unaffected. This action cannot be undone.",

      confirmLabel: "Delete code",

      variant: "danger",

    });

    if (!ok) return;



    setError("");

    setSuccess("");

    setDeleteId(id);

    try {

      const res = await fetch(`/api/master/promo-codes/${id}`, { method: "DELETE" });

      const payload = (await res.json()) as { error?: string };

      if (res.status === 401) {

        router.push("/master-login");

        return;

      }

      if (!res.ok) {

        setError(payload.error ?? "Unable to delete promo code.");

        return;

      }

      setSuccess("Promo code deleted.");

      toast.success("Promo code deleted successfully.");

      await loadPromoCodes();

    } finally {

      setDeleteId("");

    }

  }



  const totalRedemptions = rows.reduce((sum, row) => sum + row.usageCount, 0);



  return (

    <MasterShell

      title="Promo Code Control"

      subtitle="Manage free-access codes for the public Practice Interview booking flow."

    >

      <div className="space-y-5">

        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        {success ? <MasterAlert variant="success">{success}</MasterAlert> : null}



        <MasterHero

          badge="Practice checkout"

          title="Promo code control"

          subtitle="Create and manage payment bypass vouchers for the public Practice Interview flow."

        />



        <MasterInfoCard title="What are promo codes?">

          <p className="text-sm leading-relaxed text-muted-foreground">

            Promo codes are <strong className="font-semibold text-foreground">payment bypass vouchers</strong> for

            the <strong className="font-semibold text-foreground">Practice Interview</strong> page (

            <code className="rounded bg-surface/80 px-1.5 py-0.5 text-xs text-foreground ring-1 ring-border">/practice</code>

            ). When a candidate enters a valid code at checkout, they can start an AI mock interview{" "}

            <strong className="font-semibold text-foreground">without paying through Razorpay</strong>. Company

            hiring sessions are not affected — promo codes apply only to self-serve practice bookings.

          </p>

        </MasterInfoCard>



        <div className="grid gap-3 sm:grid-cols-3">

          <MasterKpiCard

            label="Applies to"

            value="Practice only"

            hint="Company hiring sessions are not affected"

            icon={TicketPercent}

            accent="bg-primary/12 text-primary"

          />

          <MasterKpiCard

            label="Payment effect"

            value="Skips Razorpay"

            hint="Valid code bypasses checkout"

            icon={CircleDollarSign}

            accent="bg-success/12 text-success"

          />

          <MasterKpiCard

            label="Total redemptions"

            value={totalRedemptions}

            hint="Practice sessions started with a code"

            icon={Users}

            accent="bg-primary/12 text-primary"

          />

        </div>



        <div className="grid gap-5 xl:grid-cols-2">

          <MasterCard title="Why use promo codes?" subtitle="Common reasons platform owners create codes from this dashboard.">

            <ul className="space-y-3">

              {USE_CASES.map((item) => {

                const Icon = item.icon;

                return (

                  <li key={item.title} className="flex gap-3 rounded-xl border border-border bg-surface/40 p-3">

                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">

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



          <MasterCard

            title="How it works (end to end)"

            subtitle="From creation here to a candidate finishing their interview."

          >

            <ol className="space-y-3">

              {HOW_IT_WORKS.map((step, index) => (

                <li key={step} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">

                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                    style={{ background: "var(--gradient-brand)" }}
                  >

                    {index + 1}

                  </span>

                  <span className="pt-0.5 text-foreground/90">{step}</span>

                </li>

              ))}

            </ol>



            <div className="mt-5 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-xs leading-relaxed text-foreground">

              <strong className="font-semibold">Important:</strong> Each code works only for the exact duration you set

              (e.g. a 30-minute code will fail if the candidate selects 45 minutes). Minimum session length is 10

              minutes.

            </div>

          </MasterCard>

        </div>



        <MasterCard

          title={editingId ? `Edit promo code — ${code}` : "Create promo code"}

          subtitle={editingId ? "Update code details or active status." : "Pick a memorable code and the session length it should unlock."}

        >
          {editingId ? (
            <div className="mb-5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3">
              <p className="text-sm text-foreground">
                You are editing <span className="font-semibold">{code}</span>. Click{" "}
                <span className="font-semibold">Update code</span> below to save changes.
              </p>
            </div>
          ) : null}

          <form onSubmit={savePromoCode} className="space-y-6">

            <div className="grid gap-4 md:grid-cols-2">

              <label className="block space-y-1.5">

                <span className="admin-label">Promo code</span>

                <input

                  id="promo-code"

                  value={code}

                  onChange={(event) => setCode(event.target.value.toUpperCase())}

                  placeholder="e.g. UHIRED30"

                  required

                  minLength={3}

                  maxLength={32}

                  className={`${masterInputClass} w-full uppercase`}

                />

                <span className="text-xs text-muted-foreground">

                  Letters, numbers, dash, and underscore only. Candidate enters this on the Practice page.

                </span>

              </label>



              <label className="block space-y-1.5">

                <span className="admin-label">Session duration (minutes)</span>

                <div className="relative">

                  <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input

                    id="promo-duration"

                    type="number"

                    min={10}

                    max={120}

                    step={1}

                    value={durationMin}

                    onChange={(event) => setDurationMin(Number(event.target.value))}

                    required

                    className={`${masterInputClass} w-full pl-10`}

                  />

                </div>

                <span className="text-xs text-muted-foreground">

                  Must match exactly what the candidate selects (10–120 min).

                </span>

              </label>

            </div>



            <div className="rounded-xl border border-border bg-surface/40 p-4 space-y-4">

              <label className="flex items-start gap-3">

                <input

                  type="checkbox"

                  checked={assignToUser}

                  onChange={(event) => {

                    setAssignToUser(event.target.checked);

                    if (!event.target.checked) {

                      setRecipientEmail("");

                      setCompanyName("");

                      setSendEmail(true);

                    }

                  }}

                  className="mt-0.5"

                />

                <span>

                  <span className="block text-sm font-semibold text-foreground">Assign to specific user / company</span>

                  <span className="mt-0.5 block text-xs text-muted-foreground">

                    Restrict this code to one email address and optionally notify them by email.

                  </span>

                </span>

              </label>



              {assignToUser ? (

                <div className="grid gap-4 md:grid-cols-2 pl-0 md:pl-7">

                  <label className="block space-y-1.5">

                    <span className="admin-label">Recipient email</span>

                    <input

                      type="email"

                      value={recipientEmail}

                      onChange={(event) => setRecipientEmail(event.target.value)}

                      placeholder="candidate@company.com"

                      required={assignToUser}

                      className={`${masterInputClass} w-full`}

                    />

                    <span className="text-xs text-muted-foreground">

                      Only this email can redeem the code on the Practice page.

                    </span>

                  </label>



                  <label className="block space-y-1.5">

                    <span className="admin-label">Company</span>

                    <select

                      value={companyName}

                      onChange={(event) => setCompanyName(event.target.value)}

                      required={assignToUser}

                      disabled={companiesLoading}

                      className={`${masterInputClass} w-full`}

                    >

                      <option value="">

                        {companiesLoading ? "Loading companies..." : "Select company..."}

                      </option>

                      {companies.map((company) => (

                        <option key={company.id} value={company.companyName}>

                          {company.companyName} ({company.domain})

                          {!company.isActive ? " — inactive" : ""}

                        </option>

                      ))}

                      {editingId &&

                      companyName &&

                      !companies.some((company) => company.companyName === companyName) ? (

                        <option value={companyName}>{companyName} (saved)</option>

                      ) : null}

                    </select>

                    <span className="text-xs text-muted-foreground">

                      All companies from Company Management. Shown in the notification email.

                    </span>

                  </label>



                  {!editingId ? (

                    <label className="flex items-start gap-3 md:col-span-2">

                      <input

                        type="checkbox"

                        checked={sendEmail}

                        onChange={(event) => setSendEmail(event.target.checked)}

                        className="mt-0.5"

                      />

                      <span>

                        <span className="block text-sm font-semibold text-foreground">Send email notification</span>

                        <span className="mt-0.5 block text-xs text-muted-foreground">

                          Email the promo code and booking link to the recipient immediately.

                        </span>

                      </span>

                    </label>

                  ) : null}

                </div>

              ) : null}

            </div>



            <div className="space-y-2">

              <span className="admin-label">Quick presets</span>

              <div className="flex flex-wrap gap-2">

                {[10, 30, 45, 60].map((minutes) => (

                  <button

                    key={minutes}

                    type="button"

                    onClick={() => setDurationMin(minutes)}

                    className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
                      durationMin === minutes
                        ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                        : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                    }`}
                    style={
                      durationMin === minutes ? { background: "var(--gradient-brand)" } : undefined
                    }

                  >

                    {minutes} min

                  </button>

                ))}

              </div>

            </div>



            <label className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3">

              <input

                type="checkbox"

                checked={isActive}

                onChange={(event) => setIsActive(event.target.checked)}

                className="mt-0.5"

              />

              <span>

                <span className="block text-sm font-semibold text-foreground">Code is active</span>

                <span className="mt-0.5 block text-xs text-muted-foreground">

                  Inactive codes cannot be used for new practice bookings.

                </span>

              </span>

            </label>



            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">

              {editingId ? (

                <button

                  type="button"

                  onClick={resetPromoForm}

                  className="admin-btn-ghost !px-5 !py-2.5"

                >

                  Cancel

                </button>

              ) : null}

              <button type="submit" disabled={loading} className={`${masterBtnPrimary} !px-6 disabled:opacity-50`}>

                {loading ? "Saving..." : editingId ? "Update code" : "Create code"}

              </button>

            </div>

          </form>

        </MasterCard>



        <MasterCard

          title="Existing promo codes"

          subtitle="Track usage and share direct booking links. Deleting a code stops new redemptions only — past sessions stay in Practice Sessions."

        >

          <div className="mb-4 rounded-xl border border-border bg-surface/40 p-4">

            <div className="flex flex-wrap items-end gap-3">

              <label className="min-w-[200px] flex-1 space-y-1.5">

                <span className="admin-label">Search codes</span>

                <div className="relative">

                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                  <input

                    value={tableSearch}

                    onChange={(event) => setTableSearch(event.target.value)}

                    onKeyDown={(event) => {

                      if (event.key === "Enter") {

                        setAppliedTableSearch(tableSearch.trim());

                        setPage(1);

                      }

                    }}

                    placeholder="Code, email, or company..."

                    className={`${masterInputClass} w-full pl-10`}

                  />

                </div>

              </label>

              <button

                type="button"

                onClick={() => {

                  setAppliedTableSearch(tableSearch.trim());

                  setPage(1);

                }}

                className={`${masterBtnPrimary} !px-5`}

              >

                Search

              </button>

              {appliedTableSearch ? (

                <button

                  type="button"

                  onClick={() => {

                    setTableSearch("");

                    setAppliedTableSearch("");

                    setPage(1);

                  }}

                  className={`${masterBtnGhost} inline-flex items-center gap-1.5 !px-4`}

                >

                  <X className="h-4 w-4" />

                  Clear

                </button>

              ) : null}

            </div>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[920px] text-left text-sm">

              <thead>

                <tr className={masterTableHeadClass}>

                  <th className="py-3 pr-4">Code</th>

                  <th className="pr-4">Assigned to</th>

                  <th className="pr-4">Unlocks duration</th>

                  <th className="pr-4">Times used</th>

                  <th className="pr-4">Status</th>

                  <th className="pr-4">Created</th>

                  <th>Actions</th>

                </tr>

              </thead>

              <tbody>

                {paginatedRows.items.map((row) => (

                  <tr key={row.id} className="border-b border-border transition hover:bg-surface/40">

                    <td className="py-4 pr-4">

                      <p className="font-semibold text-foreground">{row.code}</p>

                      <p className="mt-0.5 text-xs text-muted-foreground">Practice checkout field</p>

                    </td>

                    <td className="pr-4">

                      {row.recipientEmail ? (

                        <>

                          <p className="font-medium text-foreground">{row.recipientEmail}</p>

                          {row.companyName ? (

                            <p className="mt-0.5 text-xs text-muted-foreground">{row.companyName}</p>

                          ) : null}

                          <p className="mt-0.5 text-xs text-muted-foreground">

                            {row.emailSentAt

                              ? `Email sent ${new Date(row.emailSentAt).toLocaleString()}`

                              : "Email not sent yet"}

                          </p>

                        </>

                      ) : (

                        <p className="text-foreground/85">Public (anyone)</p>

                      )}

                    </td>

                    <td className="pr-4">

                      <p className="font-medium text-foreground">{row.durationMin} minutes</p>

                      <p className="mt-0.5 text-xs text-muted-foreground">Exact match required</p>

                    </td>

                    <td className="pr-4">

                      <p className="font-medium text-foreground">{row.usageCount}</p>

                      <p className="mt-0.5 text-xs text-muted-foreground">Practice sessions started</p>

                    </td>

                    <td className="pr-4">

                      <span

                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${

                          row.isActive
                            ? "bg-success/12 text-success ring-success/25"
                            : "bg-surface/80 text-muted-foreground ring-border"

                        }`}

                      >

                        {row.isActive ? "Active" : "Inactive"}

                      </span>

                    </td>

                    <td className="pr-4 text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</td>

                    <td>

                      <div className="flex flex-wrap gap-2">

                        <button

                          type="button"

                          onClick={() => editPromoCode(row)}

                          className={masterRowActionClass}

                        >

                          Edit

                        </button>

                        <button

                          type="button"

                          onClick={() => void togglePromoActive(row)}

                          className={row.isActive ? masterRowActionDangerClass : masterRowActionClass}

                        >

                          {row.isActive ? "Deactivate" : "Activate"}

                        </button>

                        <button

                          type="button"

                          onClick={() => void copyShareLink(row)}

                          className={`${masterRowActionClass} inline-flex items-center gap-1`}

                        >

                          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />

                          Copy link

                        </button>

                        {row.recipientEmail ? (

                          <button

                            type="button"

                            onClick={() => void resendPromoEmail(row)}

                            disabled={sendingEmailId === row.id}

                            className={`${masterRowActionClass} inline-flex items-center gap-1 disabled:opacity-50`}

                          >

                            <Mail className="h-3.5 w-3.5" aria-hidden="true" />

                            {sendingEmailId === row.id ? "Sending..." : "Send email"}

                          </button>

                        ) : null}

                        <button

                          type="button"

                          onClick={() => void deletePromoCode(row.id)}

                          disabled={deleteId === row.id}

                          className={`${masterRowActionDangerClass} disabled:opacity-50`}

                        >

                          {deleteId === row.id ? "Deleting..." : "Delete"}

                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

          <MasterPagination

            page={page}

            pageSize={pageSize}

            totalItems={filteredRows.length}

            itemLabel="promo codes"

            onPageChange={setPage}

            onPageSizeChange={(size) => {

              setPageSize(size);

              setPage(1);

            }}

          />

          {!rows.length ? (

            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface/40 px-4 py-8 text-center">

              <p className="text-sm font-semibold text-foreground">No promo codes yet</p>

              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">

                Create your first code above — for example{" "}

                <span className="font-semibold text-foreground">DEMO30</span> for a free 30-minute practice session.

              </p>

              <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground">

                Candidate flow

                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />

                /practice → enter code → skip payment → start interview

              </p>

            </div>

          ) : null}

        </MasterCard>

      </div>

    </MasterShell>

  );

}



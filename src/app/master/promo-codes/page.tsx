"use client";



import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Clock, Search, X } from "lucide-react";

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

  MasterSelect,

  masterBtnPrimary,

  masterBtnGhost,

  masterInputClass,

  MasterRowActionsMenu,

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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "active" | "inactive">("ALL");

  const filteredRows = useMemo(() => {
    const q = appliedTableSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "active" && !row.isActive) return false;
      if (statusFilter === "inactive" && row.isActive) return false;
      if (!q) return true;
      return (
        row.code.toLowerCase().includes(q) ||
        (row.recipientEmail?.toLowerCase().includes(q) ?? false) ||
        (row.companyName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, appliedTableSearch, statusFilter]);



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
  const activeCount = rows.filter((row) => row.isActive).length;

  return (
    <MasterShell title="Promo codes" subtitle="Codes that give a free practice interview.">
      <div className="space-y-3">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}
        {success ? <MasterAlert variant="success">{success}</MasterAlert> : null}

        <p className="text-sm text-muted-foreground">
          Candidate enters the code on Practice. Minutes must match the session they pick.
        </p>

        <section className="grid gap-2 sm:grid-cols-3">
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Codes</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{rows.length}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Used</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{totalRedemptions}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{activeCount}</p>
          </article>
        </section>

        <section className="admin-card p-3">
          <p className="text-sm font-semibold text-foreground">
            {editingId ? `Edit ${code}` : "New code"}
          </p>
          <form onSubmit={savePromoCode} className="mt-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="admin-label">Code</span>
                <input
                  id="promo-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="UHIRED30"
                  required
                  minLength={3}
                  maxLength={32}
                  className={`${masterInputClass} w-full uppercase`}
                />
              </label>

              <label className="block space-y-1">
                <span className="admin-label">Minutes</span>
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
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[10, 30, 45, 60].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setDurationMin(minutes)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                        durationMin === minutes
                          ? "text-primary-foreground"
                          : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                      }`}
                      style={durationMin === minutes ? { background: "var(--gradient-brand)" } : undefined}
                    >
                      {minutes} min
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <label className="flex items-center gap-2">
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
              />
              <span className="text-sm text-foreground">Limit to one email</span>
            </label>

            {assignToUser ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="admin-label">Email</span>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    placeholder="candidate@company.com"
                    required={assignToUser}
                    className={`${masterInputClass} w-full`}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="admin-label">Company</span>
                  <MasterSelect
                    value={companyName}
                    onValueChange={setCompanyName}
                    required={assignToUser}
                    disabled={companiesLoading}
                    className="w-full"
                    placeholder={companiesLoading ? "Loading..." : "Select company"}
                    aria-label="Company"
                    options={[
                      { value: "", label: companiesLoading ? "Loading..." : "Select company" },
                      ...companies.map((company) => ({
                        value: company.companyName,
                        label: `${company.companyName} (${company.domain})${!company.isActive ? " — inactive" : ""}`,
                      })),
                      ...(editingId && companyName && !companies.some((company) => company.companyName === companyName)
                        ? [{ value: companyName, label: `${companyName} (saved)` }]
                        : []),
                    ]}
                  />
                </label>

                {!editingId ? (
                  <label className="flex items-center gap-2 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={sendEmail}
                      onChange={(event) => setSendEmail(event.target.checked)}
                    />
                    <span className="text-sm text-foreground">Email this code to them</span>
                  </label>
                ) : null}
              </div>
            ) : null}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span className="text-sm text-foreground">Active</span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {editingId ? (
                <button type="button" onClick={resetPromoForm} className="admin-btn-ghost !px-4 !py-2">
                  Cancel
                </button>
              ) : null}
              <button type="submit" disabled={loading} className={`${masterBtnPrimary} !px-5 disabled:opacity-50`}>
                {loading ? "Saving..." : editingId ? "Save" : "Create"}
              </button>
            </div>
          </form>
        </section>

        <section className="admin-card overflow-hidden">
          <div className="flex flex-wrap items-end gap-2 p-3">
            <div className="relative min-w-[12rem] flex-1">
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
                placeholder="Code, email, or company"
                className={`${masterInputClass} w-full pl-10`}
                aria-label="Search promo codes"
              />
            </div>
            <MasterSelect
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as typeof statusFilter);
                setPage(1);
              }}
              aria-label="Filter promo codes by status"
              className="min-w-[9rem]"
              options={[
                { value: "ALL", label: "All" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ]}
            />
            <button
              type="button"
              onClick={() => {
                setAppliedTableSearch(tableSearch.trim());
                setPage(1);
              }}
              className={`${masterBtnPrimary} !px-4`}
            >
              Search
            </button>
            {appliedTableSearch || statusFilter !== "ALL" ? (
              <button
                type="button"
                onClick={() => {
                  setTableSearch("");
                  setAppliedTableSearch("");
                  setStatusFilter("ALL");
                  setPage(1);
                }}
                className={`${masterBtnGhost} inline-flex items-center !px-3`}
                aria-label="Clear filters"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-2 pr-4">Code</th>
                  <th className="pr-4">Assigned to</th>
                  <th className="pr-4">Minutes</th>
                  <th className="pr-4">Used</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.items.map((row) => (
                  <tr key={row.id} className="border-b border-border">
                    <td className="py-2.5 pr-4 font-semibold text-foreground">{row.code}</td>
                    <td className="pr-4">
                      {row.recipientEmail ? (
                        <>
                          <p className="text-foreground">{row.recipientEmail}</p>
                          {row.companyName ? (
                            <p className="text-xs text-muted-foreground">{row.companyName}</p>
                          ) : null}
                        </>
                      ) : (
                        <p className="text-muted-foreground">Anyone</p>
                      )}
                    </td>
                    <td className="pr-4 text-foreground">{row.durationMin}</td>
                    <td className="pr-4 text-foreground">{row.usageCount}</td>
                    <td className="pr-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                          row.isActive
                            ? "bg-success/12 text-success ring-success/25"
                            : "bg-surface/80 text-muted-foreground ring-border"
                        }`}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="pr-4 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="text-right">
                      <MasterRowActionsMenu
                        label={row.code}
                        actions={[
                          { label: "Edit", onClick: () => editPromoCode(row) },
                          {
                            label: row.isActive ? "Deactivate" : "Activate",
                            onClick: () => void togglePromoActive(row),
                            danger: row.isActive,
                          },
                          { label: "Copy link", onClick: () => void copyShareLink(row) },
                          row.recipientEmail
                            ? {
                                label: sendingEmailId === row.id ? "Sending..." : "Send email",
                                onClick: () => void resendPromoEmail(row),
                                disabled: sendingEmailId === row.id,
                              }
                            : null,
                          {
                            label: deleteId === row.id ? "Deleting..." : "Delete",
                            onClick: () => void deletePromoCode(row.id),
                            danger: true,
                            disabled: deleteId === row.id,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No codes yet. Create one above.</p>
            ) : null}
          </div>

          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            itemLabel="codes"
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

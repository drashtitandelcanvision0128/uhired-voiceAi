"use client";



import { useCallback, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import {

  Building2,

  Globe,

  LifeBuoy,

  Mail,

  MessageSquare,

  RefreshCw,

  Search,

  X,

} from "lucide-react";

import { useConfirm, useToast } from "@/components/app-feedback";

import { MasterSupportInquiryModal } from "@/components/master-support-inquiry-modal";
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

  masterBtnGhost,

  masterBtnPrimary,

  masterInputClass,

  masterRowActionClass,

  masterRowActionDangerClass,

  masterTableHeadClass,

} from "@/components/master-ui";



type InquirySource = "PUBLIC_CONTACT" | "COMPANY_ADMIN";

type InquiryStatus = "NEW" | "READ" | "REPLIED" | "ARCHIVED";



type SupportInquiry = {

  id: string;

  name: string;

  email: string;

  subject: string;

  message: string;

  source: InquirySource;

  status: InquiryStatus;

  clientIp: string | null;

  readAt: string | null;

  createdAt: string;

};



type SupportResponse = {

  summary: {

    total: number;

    newCount: number;

    readCount: number;

    repliedCount: number;

    publicContactCount: number;

    companyAdminCount: number;

  };

  inquiries: SupportInquiry[];

  pagination: {

    page: number;

    pageSize: number;

    total: number;

    totalPages: number;

  };

};



const STATUS_STYLES: Record<InquiryStatus, string> = {
  NEW: "bg-primary/12 text-primary ring-1 ring-primary/25",
  READ: "bg-warning/12 text-warning ring-1 ring-warning/25",
  REPLIED: "bg-success/12 text-success ring-1 ring-success/25",
  ARCHIVED: "bg-surface/80 text-muted-foreground ring-1 ring-border",
};



export default function MasterSupportPage() {

  const router = useRouter();

  const confirm = useConfirm();

  const toast = useToast();

  const searchParams = useSearchParams();

  const [data, setData] = useState<SupportResponse | null>(null);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");

  const [statusInput, setStatusInput] = useState<"" | InquiryStatus>("");

  const [sourceInput, setSourceInput] = useState<"" | InquirySource>("");

  const [appliedSearch, setAppliedSearch] = useState("");

  const [appliedStatus, setAppliedStatus] = useState<"" | InquiryStatus>("");

  const [appliedSource, setAppliedSource] = useState<"" | InquirySource>("");

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);



  useEffect(() => {

    const id = searchParams.get("id");

    if (id) {

      setSelectedId(id);

    }

  }, [searchParams]);



  const hasActiveFilters = Boolean(appliedSearch || appliedStatus || appliedSource);



  const load = useCallback(async () => {

    setError("");

    setLoading(true);

    try {

      const params = new URLSearchParams({

        page: String(page),

        pageSize: String(pageSize),

      });

      if (appliedSearch) params.set("search", appliedSearch);

      if (appliedStatus) params.set("status", appliedStatus);

      if (appliedSource) params.set("source", appliedSource);



      const res = await fetch(`/api/master/support-inquiries?${params.toString()}`);

      const payload = (await res.json()) as SupportResponse & { error?: string };

      if (res.status === 401) {

        router.push("/master-login");

        return;

      }

      if (!res.ok) {

        setError(payload.error ?? "Unable to load support inquiries.");

        return;

      }

      setData(payload);

    } finally {

      setLoading(false);

    }

  }, [router, page, pageSize, appliedSearch, appliedStatus, appliedSource]);



  function applyFilters() {

    setAppliedSearch(searchInput.trim());

    setAppliedStatus(statusInput);

    setAppliedSource(sourceInput);

    setPage(1);

  }



  function clearFilters() {

    setSearchInput("");

    setStatusInput("");

    setSourceInput("");

    setAppliedSearch("");

    setAppliedStatus("");

    setAppliedSource("");

    setPage(1);

  }



  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {

    if (event.key === "Enter") {

      event.preventDefault();

      applyFilters();

    }

  }



  useEffect(() => {

    void load();

  }, [load]);



  useEffect(() => {

    setPage(1);

  }, [pageSize]);



  const selectedInquiry = data?.inquiries.find((item) => item.id === selectedId) ?? null;

  const closeInquiry = useCallback(() => {
    setSelectedId(null);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("id")) {
      params.delete("id");
      const query = params.toString();
      router.replace(query ? `/master/support?${query}` : "/master/support", { scroll: false });
    }
  }, [router, searchParams]);

  async function updateStatus(inquiryId: string, status: InquiryStatus) {

    setUpdatingId(inquiryId);

    setError("");

    try {

      const res = await fetch("/api/master/support-inquiries", {

        method: "PATCH",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ inquiryId, status }),

      });

      const payload = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !payload.ok) {

        setError(payload.error ?? "Unable to update inquiry status.");

        return;

      }

      await load();

      toast.success(`Inquiry marked as ${status.toLowerCase()}.`);

    } finally {

      setUpdatingId(null);

    }

  }



  async function deleteInquiry(inquiryId: string) {

    const ok = await confirm({

      title: "Delete support inquiry?",

      message: "This permanently removes the inquiry and its details. This action cannot be undone.",

      confirmLabel: "Delete inquiry",

      variant: "danger",

    });

    if (!ok) return;

    setError("");

    setSuccess("");

    const res = await fetch(`/api/master/support-inquiries/${inquiryId}`, { method: "DELETE" });

    const payload = (await res.json()) as { ok?: boolean; error?: string };

    if (res.status === 401) {

      router.push("/master-login");

      return;

    }

    if (!res.ok || !payload.ok) {

      setError(payload.error ?? "Unable to delete inquiry.");

      return;

    }

    if (selectedId === inquiryId) {
      closeInquiry();
    }

    setSuccess("Support inquiry deleted.");

    toast.success("Support inquiry deleted successfully.");

    await load();

  }



  return (

    <MasterShell

      title="Support Inquiries"

      subtitle="All support emails and contact form messages — who reached out and what they need."

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

        {success ? <MasterAlert variant="success">{success}</MasterAlert> : null}



        <MasterHero

          badge="Support inbox"

          title="Support inquiries"

          subtitle="Review contact form messages and company admin support requests in one place."

        />



        <MasterInfoCard title="What are support inquiries?">
          <p className="text-sm leading-relaxed text-muted-foreground">
            When a user sends a message from the{" "}
            <strong className="font-semibold text-foreground">/contact</strong> page or a{" "}
            <strong className="font-semibold text-foreground">company admin</strong> submits a support
            request from their dashboard, it is saved here. You can see who emailed, the subject, and the
            full message.
          </p>
        </MasterInfoCard>



        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

          <MasterKpiCard
            label="Total inquiries"
            value={data?.summary.total ?? 0}
            icon={LifeBuoy}
            accent="bg-primary/12 text-primary ring-primary/25"
          />
          <MasterKpiCard
            label="New (unread)"
            value={data?.summary.newCount ?? 0}
            icon={Mail}
            accent="bg-violet/12 text-violet ring-violet/25"
          />
          <MasterKpiCard
            label="Replied"
            value={data?.summary.repliedCount ?? 0}
            icon={MessageSquare}
            accent="bg-success/12 text-success ring-success/25"
          />
          <MasterKpiCard
            label="Public contact"
            value={data?.summary.publicContactCount ?? 0}
            icon={Globe}
            accent="bg-cyan/12 text-cyan ring-cyan/25"
          />
          <MasterKpiCard
            label="Company admins"
            value={data?.summary.companyAdminCount ?? 0}
            icon={Building2}
            accent="bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300"
          />

        </div>



        <MasterCard
          elevated
          title="Inquiry inbox"
          subtitle="Click a row or View to read the full message and update status."
        >
          <div className="mb-6 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">

              <label className="block space-y-1.5">

                <span className="admin-label">Search inquiries</span>

                <div className="relative">

                  <Search

                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"

                    aria-hidden="true"

                  />

                  <input

                    value={searchInput}

                    onChange={(event) => setSearchInput(event.target.value)}

                    onKeyDown={handleSearchKeyDown}

                    placeholder="Name, email, subject, message..."

                    className={`${masterInputClass} w-full pl-10`}

                  />

                </div>

              </label>



              <label className="block space-y-1.5">

                <span className="admin-label">Status</span>

                <select

                  value={statusInput}

                  onChange={(event) => setStatusInput(event.target.value as "" | InquiryStatus)}

                  className={`${masterInputClass} w-full`}

                >

                  <option value="">All statuses</option>

                  <option value="NEW">New</option>

                  <option value="READ">Read</option>

                  <option value="REPLIED">Replied</option>

                  <option value="ARCHIVED">Archived</option>

                </select>

              </label>



              <label className="block space-y-1.5">

                <span className="admin-label">Source</span>

                <select

                  value={sourceInput}

                  onChange={(event) => setSourceInput(event.target.value as "" | InquirySource)}

                  className={`${masterInputClass} w-full`}

                >

                  <option value="">All sources</option>

                  <option value="PUBLIC_CONTACT">Public contact</option>

                  <option value="COMPANY_ADMIN">Company admin</option>

                </select>

              </label>



              <div className="flex flex-wrap gap-2">

                <button

                  type="button"

                  onClick={applyFilters}

                  className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-5`}

                >

                  <Search className="h-4 w-4" aria-hidden="true" />

                  Search

                </button>

                {hasActiveFilters ? (

                  <button

                    type="button"

                    onClick={clearFilters}

                    className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4`}

                  >

                    <X className="h-4 w-4" aria-hidden="true" />

                    Clear

                  </button>

                ) : null}

              </div>

            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["", "NEW", "READ", "REPLIED", "ARCHIVED"] as const).map((status) => (
                <button
                  key={status || "all-status"}
                  type="button"
                  onClick={() => {
                    setStatusInput(status);
                    setAppliedStatus(status);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    appliedStatus === status
                      ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                  }`}
                  style={
                    appliedStatus === status ? { background: "var(--gradient-brand)" } : undefined
                  }
                >
                  {status === "" ? "All statuses" : status}
                </button>
              ))}
              {(["", "PUBLIC_CONTACT", "COMPANY_ADMIN"] as const).map((source) => (
                <button
                  key={source || "all-sources"}
                  type="button"
                  onClick={() => {
                    setSourceInput(source);
                    setAppliedSource(source);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    appliedSource === source
                      ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                  }`}
                  style={
                    appliedSource === source ? { background: "var(--gradient-brand)" } : undefined
                  }
                >
                  {source === ""
                    ? "All sources"
                    : source === "PUBLIC_CONTACT"
                      ? "Public contact"
                      : "Company admin"}
                </button>
              ))}
            </div>

            {hasActiveFilters ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Active filters
                </span>
                {appliedSearch ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Search: {appliedSearch}
                  </span>
                ) : null}
                {appliedStatus ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Status: {appliedStatus}
                  </span>
                ) : null}
                {appliedSource ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Source:{" "}
                    {appliedSource === "PUBLIC_CONTACT" ? "Public contact" : "Company admin"}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {loading && !(data?.inquiries.length ?? 0) ? (
            <div className="space-y-2 mb-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 animate-pulse rounded-xl bg-surface/60" />
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto">

            <table className="w-full min-w-[900px] text-left text-sm">

              <thead>

                <tr className={masterTableHeadClass}>

                  <th className="py-3 pr-4">From</th>

                  <th className="pr-4">Subject</th>

                  <th className="pr-4">Source</th>

                  <th className="pr-4">Status</th>

                  <th className="pr-4">Received</th>

                  <th>Action</th>

                </tr>

              </thead>

              <tbody>

                {(data?.inquiries ?? []).map((inquiry) => (

                  <tr

                    key={inquiry.id}

                    className={`cursor-pointer border-b border-border transition hover:bg-surface/40 ${
                      selectedId === inquiry.id ? "bg-primary/8 ring-1 ring-inset ring-primary/20" : ""
                    }`}

                    onClick={() => setSelectedId(inquiry.id)}

                  >

                    <td className="py-4 pr-4">

                      <p className="font-semibold text-foreground">{inquiry.name}</p>
                      <p className="text-xs text-muted-foreground">{inquiry.email}</p>
                    </td>
                    <td className="pr-4">
                      <p className="max-w-xs truncate font-medium text-foreground">{inquiry.subject}</p>
                    </td>
                    <td className="pr-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground ring-1 ring-border">

                        {inquiry.source === "PUBLIC_CONTACT" ? (

                          <Globe className="h-3 w-3" aria-hidden="true" />

                        ) : (

                          <Building2 className="h-3 w-3" aria-hidden="true" />

                        )}

                        {inquiry.source === "PUBLIC_CONTACT" ? "Public" : "Company"}

                      </span>

                    </td>

                    <td className="pr-4">

                      <span

                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[inquiry.status]}`}

                      >

                        {inquiry.status}

                      </span>

                    </td>

                    <td className="pr-4 text-muted-foreground">
                      {new Date(inquiry.createdAt).toLocaleString()}
                    </td>

                    <td>

                      <div className="flex flex-wrap gap-2">

                      <button

                        type="button"

                        onClick={(event) => {

                          event.stopPropagation();

                          setSelectedId(inquiry.id);

                        }}

                        className={masterRowActionClass}

                      >

                        View

                      </button>

                      <button

                        type="button"

                        onClick={(event) => {

                          event.stopPropagation();

                          void deleteInquiry(inquiry.id);

                        }}

                        className={masterRowActionDangerClass}

                      >

                        Delete

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

            totalItems={data?.pagination.total ?? 0}

            itemLabel="inquiries"

            onPageChange={setPage}

            onPageSizeChange={(size) => {

              setPageSize(size);

              setPage(1);

            }}

          />



          {loading && (data?.inquiries.length ?? 0) > 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Refreshing inquiries…</p>
          ) : null}
          {!loading && !(data?.inquiries.length ?? 0) ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
                <LifeBuoy className="h-6 w-6" aria-hidden />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">No support inquiries yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Messages from the contact page and company admin support form will appear here.
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${masterBtnGhost} mt-4 inline-flex items-center gap-2`}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </MasterCard>

        <MasterSupportInquiryModal
          open={selectedId !== null}
          loading={loading && selectedId !== null && !selectedInquiry}
          inquiry={selectedInquiry}
          updating={updatingId === selectedId}
          onClose={closeInquiry}
          onUpdateStatus={(status) => {
            if (selectedId) void updateStatus(selectedId, status);
          }}
          onDelete={() => {
            if (selectedId) void deleteInquiry(selectedId);
          }}
        />
      </div>

    </MasterShell>

  );

}



"use client";



import { useCallback, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { Building2, Globe, LifeBuoy, Mail, MessageSquare, RefreshCw, Search, X } from "lucide-react";

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
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
  MasterRowActionsMenu,
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



function formatStatus(status: InquiryStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatWhen(value: string) {
  const date = new Date(value);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function MasterSupportPageClient() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SupportResponse | null>(null);
  const [error, setError] = useState("");
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
        setError(payload.error ?? "Could not load messages.");
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
        setError(payload.error ?? "Could not update.");
        return;
      }
      await load();
      toast.success(`Marked ${status.toLowerCase()}.`);
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteInquiry(inquiryId: string) {
    const ok = await confirm({
      title: "Delete this message?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    setError("");
    const res = await fetch(`/api/master/support-inquiries/${inquiryId}`, { method: "DELETE" });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    if (!res.ok || !payload.ok) {
      setError(payload.error ?? "Could not delete.");
      return;
    }
    if (selectedId === inquiryId) {
      closeInquiry();
    }
    toast.success("Deleted.");
    await load();
  }

  return (
    <MasterShell title="Support" subtitle="Messages from the website contact form.">
      <div className="space-y-4">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Inbox", value: data?.summary.total ?? 0, icon: LifeBuoy, accent: "bg-primary/12 text-primary" },
            { label: "Unread", value: data?.summary.newCount ?? 0, icon: Mail, accent: "bg-violet/12 text-violet" },
            { label: "Replied", value: data?.summary.repliedCount ?? 0, icon: MessageSquare, accent: "bg-success/12 text-success" },
            { label: "Website", value: data?.summary.publicContactCount ?? 0, icon: Globe, accent: "bg-cyan/12 text-cyan" },
            { label: "Companies", value: data?.summary.companyAdminCount ?? 0, icon: Building2, accent: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
          ].map((card) => {
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
        </section>

        <section className="admin-card overflow-hidden">
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[14rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Name, email, or subject"
                  className={`${masterInputClass} w-full pl-10`}
                  aria-label="Search messages"
                />
              </div>
              <button type="button" onClick={applyFilters} className={`${masterBtnPrimary} !px-4`}>
                Search
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className={`${masterBtnGhost} inline-flex h-10 items-center justify-center !px-3 disabled:opacity-60`}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${masterBtnGhost} inline-flex h-10 items-center justify-center !px-3`}
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["", "NEW", "READ", "REPLIED", "ARCHIVED"] as const).map((status) => (
                <button
                  key={status || "all-status"}
                  type="button"
                  onClick={() => {
                    setStatusInput(status);
                    setAppliedStatus(status);
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    appliedStatus === status
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status === "" ? "All" : formatStatus(status)}
                </button>
              ))}
              <span className="mx-1 hidden h-5 w-px bg-border sm:inline-block" />
              {(["", "PUBLIC_CONTACT", "COMPANY_ADMIN"] as const).map((source) => (
                <button
                  key={source || "all-sources"}
                  type="button"
                  onClick={() => {
                    setSourceInput(source);
                    setAppliedSource(source);
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    appliedSource === source
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {source === "" ? "Everyone" : source === "PUBLIC_CONTACT" ? "Website" : "Companies"}
                </button>
              ))}
            </div>
          </div>

          {loading && !(data?.inquiries.length ?? 0) ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !(data?.inquiries.length ?? 0) ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">No messages</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasActiveFilters ? "Try a different filter." : "New contact and company messages land here."}
              </p>
              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className={`${masterBtnGhost} mt-3 inline-flex items-center gap-1.5`}>
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className={masterTableHeadClass}>
                    <th className="px-4 py-2.5">From</th>
                    <th className="pr-4">Subject</th>
                    <th className="pr-4">Where</th>
                    <th className="pr-4">Status</th>
                    <th className="pr-4">When</th>
                    <th className="w-10 pr-3 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.inquiries ?? []).map((inquiry) => {
                    const unread = inquiry.status === "NEW";
                    return (
                      <tr
                        key={inquiry.id}
                        className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/40 ${
                          unread ? "bg-primary/5" : ""
                        } ${selectedId === inquiry.id ? "bg-primary/10" : ""}`}
                        onClick={() => setSelectedId(inquiry.id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-bold text-primary">
                              {initials(inquiry.name)}
                            </span>
                            <div className="min-w-0">
                              <p className={`truncate ${unread ? "font-bold text-foreground" : "font-semibold text-foreground"}`}>
                                {inquiry.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{inquiry.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="pr-4">
                          <p className={`max-w-xs truncate ${unread ? "font-semibold text-foreground" : "text-foreground"}`}>
                            {inquiry.subject}
                          </p>
                        </td>
                        <td className="pr-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground ring-1 ring-border">
                            {inquiry.source === "PUBLIC_CONTACT" ? (
                              <Globe className="h-3 w-3" aria-hidden />
                            ) : (
                              <Building2 className="h-3 w-3" aria-hidden />
                            )}
                            {inquiry.source === "PUBLIC_CONTACT" ? "Website" : "Company"}
                          </span>
                        </td>
                        <td className="pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[inquiry.status]}`}>
                            {formatStatus(inquiry.status)}
                          </span>
                        </td>
                        <td className="pr-4 text-xs text-muted-foreground">{formatWhen(inquiry.createdAt)}</td>
                        <td className="pr-3 text-right">
                          <MasterRowActionsMenu
                            label={inquiry.subject}
                            actions={[
                              { label: "Open", onClick: () => setSelectedId(inquiry.id) },
                              {
                                label: "Delete",
                                onClick: () => void deleteInquiry(inquiry.id),
                                danger: true,
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={data?.pagination.total ?? 0}
            itemLabel="messages"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </section>

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

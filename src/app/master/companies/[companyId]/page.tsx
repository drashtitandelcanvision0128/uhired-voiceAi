"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Briefcase,
  Building2,
  Eye,
  Mail,
  Mic,
  Pencil,
  Users,
} from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import {
  MasterAlert,
  MasterKpiCard,
  masterBtnGhost,
  masterBtnPrimary,
} from "@/components/master-ui";

type CompanyView = {
  id: string;
  companyName: string;
  domain: string;
  adminEmail: string;
  interviewerName: string;
  interviewerVoiceGender: "MALE" | "FEMALE";
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  totalSessions?: number;
  liveSessions?: number;
  candidateCount?: number;
  requirementCount?: number;
  error?: string;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground" title={value}>
        {value || "—"}
      </p>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function MasterViewCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [data, setData] = useState<CompanyView | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void params.then((value) => setCompanyId(value.companyId));
  }, [params]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/master/companies/${companyId}`, { cache: "no-store" });
      const payload = (await res.json()) as CompanyView;
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "This company could not be loaded.");
        return;
      }
      setData(payload);
    } catch {
      setError("This company could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [companyId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const interviewer =
    data?.interviewerName?.trim()
      ? `${data.interviewerName} (${data.interviewerVoiceGender === "FEMALE" ? "Female" : "Male"})`
      : "Default";

  return (
    <MasterShell
      title={data?.companyName || "Company"}
      subtitle="View this client's login, interviewer, and interview activity."
      topActions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/master/companies" className={`${masterBtnGhost} inline-flex items-center gap-2 !px-3 !py-2`}>
            <ArrowLeft className="h-4 w-4" />
            Back to list
          </Link>
          {companyId ? (
            <Link
              href={`/master/companies/${companyId}/edit`}
              className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-3 !py-2`}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-3">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        {loading ? (
          <div className="admin-card px-4 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">Loading company…</p>
          </div>
        ) : data ? (
          <>
            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MasterKpiCard
                label="Interviews"
                value={data.totalSessions ?? 0}
                hint="Sessions linked to this company"
                icon={Activity}
                accent="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
              />
              <MasterKpiCard
                label="Live now"
                value={data.liveSessions ?? 0}
                hint="Interviews running right now"
                icon={Eye}
                accent="bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
              />
              <MasterKpiCard
                label="Candidates"
                value={data.candidateCount ?? 0}
                hint="People in this company workspace"
                icon={Users}
                accent="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
              />
              <MasterKpiCard
                label="Job openings"
                value={data.requirementCount ?? 0}
                hint="Roles saved for this company"
                icon={Briefcase}
                accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              />
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <div className="admin-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="admin-section-title text-sm">Company</p>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                      data.isActive
                        ? "bg-success/12 text-success ring-success/25"
                        : "bg-surface/80 text-muted-foreground ring-border"
                    }`}
                  >
                    {data.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Company name" value={data.companyName} />
                  <Detail label="Website" value={data.domain} />
                  <Detail label="Created" value={formatDate(data.createdAt)} />
                  <Detail label="Last updated" value={formatDate(data.updatedAt)} />
                </div>
              </div>

              <div className="admin-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="admin-section-title text-sm">How they sign in</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Work email" value={data.adminEmail} />
                  <Detail label="Passcode" value="Hidden — edit to change" />
                </div>
              </div>
            </section>

            <section className="admin-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <p className="admin-section-title text-sm">AI interviewer</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Interviewer" value={interviewer} />
                <div className="flex flex-wrap items-end gap-2">
                  <Link
                    href={`/master/company-sessions?search=${encodeURIComponent(data.companyName)}`}
                    className={`${masterBtnGhost} inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View interviews
                  </Link>
                  <Link
                    href={`/master/companies/${data.id}/edit`}
                    className={`${masterBtnGhost} inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit company
                  </Link>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </MasterShell>
  );
}

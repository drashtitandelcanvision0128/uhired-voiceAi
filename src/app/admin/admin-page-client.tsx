"use client";

// Phase 7b — enable when PHASE_7B_ENABLED=true
// import { AdminTeamPanel } from "@/components/admin/admin-team-panel";
import { useAppFeedback } from "@/components/app-feedback";
import {
  LayoutDashboard,
  Video,
  Users,
  FileText,
  PlusCircle,
  HelpCircle,
  Settings,
  Bell,
  Compass,
  Zap,
  Link2,
  Bot,
  Upload,
  Mail,
  FileSpreadsheet,
  FileDown,
  Search,
  CheckCircle2,
  Trash2,
  Clock,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  Palette,
  UserCircle,
  X,
  ExternalLink,
  Share2,
  PlayCircle,
  Copy,
  ArrowRight,
  RefreshCw,
  ChevronRight,
  Pencil,
  User,
  Mic,
  Check,
  Play,
  Send,
  Save,
  ArrowLeft,
  Building2,
  MessageCircle,
  Globe,
  Lock,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { applySiteTheme, readStoredSiteTheme } from "@/lib/site-theme";
import { adminNavHref, adminPathForSection, parseAdminPath } from "@/lib/admin-portal-routes";
import { INTERVIEW_LANGUAGES } from "@/lib/interview-languages";
import {
  HOLISTIC_OVERALL_FORMULA,
  OVERALL_WITH_ANSWER_GRADING_NOTE,
} from "@/lib/scorecard-scoring-formula";
import { suggestKeySkillsForTargetRole } from "@/lib/scorecard-role-suggestions";
import {
  AdminSessionDetailModal,
  type AdminSessionDetail,
  type ObserverLinkRow,
  type ScorecardShareLinkRow,
} from "@/components/admin-session-detail-modal";
import {
  AdminCandidateDetailModal,
  type AdminCandidateDetail,
} from "@/components/admin-candidate-detail-modal";
import {
  AdminRequirementDetailModal,
  type AdminRequirementDetail,
} from "@/components/admin-requirement-detail-modal";
import { AdminDashboard, type DashboardData, type DashboardPeriod } from "@/components/admin-dashboard";
import { AdminCandidatesTable } from "@/components/admin-candidates-table";
import { AdminRequirementsTable } from "@/components/admin-requirements-table";
import { AdminSessionsTable } from "@/components/admin-sessions-table";
import { AppShell } from "@/components/dashboard/app-shell";
import { AppSelect } from "@/components/ui/app-select";
import {
  EXCEL_EMAIL_LIMIT,
  MANUAL_EMAIL_LIMIT,
  extractEmailsFromSheetRows,
  parseManualEmailInput,
} from "@/lib/parse-candidate-emails";
import type { EmailVerificationResult } from "@/lib/email-verification-shared";
import { verificationStatusLabel } from "@/lib/email-verification-shared";
import type { InviteDeliveryRow, InviteDeliverySummary } from "@/lib/invite-delivery";
import { deliveryStatusLabel, SPAM_FOLDER_NOTE } from "@/lib/invite-delivery";
import { buildCandidateVerificationPdfBytes } from "@/lib/candidate-verification-pdf";

const SCORECARD_SHARE_STORAGE_PREFIX = "uhired-scorecard-share:";

type StoredScorecardShare = {
  linkId: string;
  shareUrl: string;
  pdfUrl: string;
  expiresAt: string;
};

function loadStoredScorecardShare(sessionId: string): StoredScorecardShare | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${SCORECARD_SHARE_STORAGE_PREFIX}${sessionId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredScorecardShare;
    if (!parsed.linkId || !parsed.shareUrl || !parsed.pdfUrl || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredScorecardShare(sessionId: string, share: StoredScorecardShare) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${SCORECARD_SHARE_STORAGE_PREFIX}${sessionId}`, JSON.stringify(share));
}

type SessionView = {
  id: string;
  accessCode: string;
  requirementAccessCode?: string | null;
  candidateInviteCode?: string | null;
  candidateName: string | null;
  candidateEmail?: string | null;
  positionTitle: string | null;
  domain: string;
  topic: string;
  durationMin: number;
  interviewDurationDisplay?: string;
  status: string;
  createdAt: string;
  scorecard: { overallScore: number } | null;
  transcript: Array<{ id: string; speaker: string; message: string }>;
  videoRecordingStatus?: "AVAILABLE" | "NOT_UPLOADED";
  jobDescription?: string | null;
  keySkills?: unknown;
};

type CandidateView = {
  candidateId: string;
  key: string;
  candidateName: string | null;
  candidateEmail: string | null;
  latestStatus: string;
  latestScore: number | null;
  latestSessionId: string | null;
  sessionsCount: number;
  updatedAt?: string;
};

type CandidateDetail = AdminCandidateDetail;

type RequirementView = AdminRequirementDetail;

type SessionDetail = AdminSessionDetail;

function formatSessionKeySkills(keySkills: unknown): string {
  if (Array.isArray(keySkills)) {
    return keySkills.map((s) => String(s).trim()).filter(Boolean).join(", ");
  }
  return "";
}

function parseKeySkillsArray(keySkills: unknown): string[] {
  if (!Array.isArray(keySkills)) return [];
  return keySkills.map((s) => String(s).trim()).filter(Boolean);
}

function sessionMandatoryPrompts(session: SessionDetail): string {
  return session.questions.filter((q) => q.isMandatory).map((q) => q.prompt).join("\n");
}

function sessionOptionalPrompts(session: SessionDetail): string {
  return session.questions.filter((q) => !q.isMandatory).map((q) => q.prompt).join("\n");
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

type InviteStatus = "Used" | "Sent" | "Pending" | "Expired";

function getInviteStatus(invite: { usedAt: string | null; emailSentAt: string | null; expiresAt: string | null }): InviteStatus {
  if (invite.usedAt) return "Used";
  if (invite.expiresAt) {
    const t = new Date(invite.expiresAt).getTime();
    if (Number.isFinite(t) && t <= Date.now()) return "Expired";
  }
  if (invite.emailSentAt) return "Sent";
  return "Pending";
}

function inviteStatusStyles(status: InviteStatus): { chip: string; dot: string } {
  switch (status) {
    case "Used":
      return {
        chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
        dot: "bg-emerald-500",
      };
    case "Sent":
      return {
        chip: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30",
        dot: "bg-sky-500",
      };
    case "Expired":
      return {
        chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30",
        dot: "bg-amber-500",
      };
    default:
      return {
        chip: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15",
        dot: "bg-slate-400",
      };
  }
}

function formatSessionInviteCode(session: {
  candidateInviteCode?: string | null;
  requirementAccessCode?: string | null;
}) {
  return session.candidateInviteCode ?? session.requirementAccessCode ?? "No invite code";
}

async function readResponseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

function formatRelativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SESSION_QUICK_VIEWS = [
  { key: "all", label: "All Sessions" },
  { key: "completed", label: "Completed only" },
  { key: "ready", label: "Ready to review" },
  { key: "no_recording", label: "No recording" },
] as const;

type SessionQuickViewKey = (typeof SESSION_QUICK_VIEWS)[number]["key"];

const ROLE_AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
];

function getRoleInitials(title: string | null, domain: string) {
  const source = (title ?? domain).trim();
  if (!source) return "?";
  const words = source.split(/\s+/);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function roleAvatarColor(title: string | null, domain: string) {
  const key = (title ?? domain).toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return ROLE_AVATAR_COLORS[Math.abs(hash) % ROLE_AVATAR_COLORS.length];
}

function sessionStatusBadgeClass(status: string) {
  if (status === "COMPLETED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300";
  }
  if (status === "READY") {
    return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  }
  if (status === "LIVE") {
    return "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300";
  }
  return "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const workspaceNavItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "overview", label: "Invites", icon: Compass },
  { key: "candidates", label: "Candidates", icon: Users },
  { key: "requirements", label: "Job Openings", icon: FileText },
  { key: "sessions", label: "All Interviews", icon: Video },
];

const systemNavItems = [
  { key: "settings", label: "Interviewer Voice", icon: Bot },
  { key: "app-settings", label: "Settings", icon: Settings },
  { key: "support", label: "Support", icon: HelpCircle },
];

const sectionTitles: Record<string, string> = {
  dashboard: "Dashboard",
  overview: "Invites",
  sessions: "All Interviews",
  candidates: "Candidates",
  requirements: "Job Openings",
  settings: "Interviewer Voice",
  profile: "Profile",
  "app-settings": "Settings",
  support: "Support",
};

type AdminTheme = "light" | "dark";

const ADMIN_SAVED_SESSION_VIEWS_KEY = "uhired-admin-saved-session-views";
const ADMIN_NOTIF_READ_KEY = "uhired-admin-notif-read";
type SavedSessionView = {
  id: string;
  name: string;
  createdAt: number;
  filters: {
    search: string;
    status: string;
    scoreMin: string;
    scoreMax: string;
    from: string;
    to: string;
  };
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  unread?: boolean;
  section?: string;
};

type SupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

function loadReadNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(ADMIN_NOTIF_READ_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveReadNotificationIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_NOTIF_READ_KEY, JSON.stringify([...ids]));
}

function getPasswordStrengthScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 4) score += 1;
  if (password.length >= 8) score += 1;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) && password.length >= 8) score += 1;
  return score;
}

function formatTenantSince(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function AdminPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { section: activeSection, openingTab } = parseAdminPath(pathname);
  const { confirmDelete, confirmAction, notify } = useAppFeedback();
  const formRef = useRef<HTMLFormElement>(null);
  const draftSectionRef = useRef<HTMLElement>(null);
  const invitePanelRef = useRef<HTMLDivElement>(null);
  const roleFieldRef = useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [error, setError] = useState("");
  const [inviteMode, setInviteMode] = useState<"excel" | "manual">("excel");
  const [manualEmailText, setManualEmailText] = useState("");
  const [parsedEmails, setParsedEmails] = useState<string[]>([]);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [excelInvalidRows, setExcelInvalidRows] = useState<number[]>([]);
  const [excelDuplicateRows, setExcelDuplicateRows] = useState<number[]>([]);
  const [excelEmptyRows, setExcelEmptyRows] = useState<number[]>([]);
  const [inviteResults, setInviteResults] = useState<InviteDeliveryRow[] | null>(null);
  const [inviteSummary, setInviteSummary] = useState<InviteDeliverySummary | null>(null);
  const [emailVerifications, setEmailVerifications] = useState<EmailVerificationResult[]>([]);
  const [verifyingEmails, setVerifyingEmails] = useState(false);
  const [verificationPdfBusy, setVerificationPdfBusy] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [savingRequirement, setSavingRequirement] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [debouncedTargetRole, setDebouncedTargetRole] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [durationMin, setDurationMin] = useState<number | string>(5);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [optionalQuestionsOpen, setOptionalQuestionsOpen] = useState(false);
  const [mandatoryQuestionsText, setMandatoryQuestionsText] = useState("");
  const [optionalQuestionsText, setOptionalQuestionsText] = useState("");
  const [generateQuestionsBusy, setGenerateQuestionsBusy] = useState(false);
  const [maxOptionalQuestions, setMaxOptionalQuestions] = useState(2);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [overviewRequirements, setOverviewRequirements] = useState<RequirementView[]>([]);
  const [loadingOverviewRequirements, setLoadingOverviewRequirements] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailSession, setDetailSession] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [regradeBusy, setRegradeBusy] = useState(false);
  const [scorecardShareLinks, setScorecardShareLinks] = useState<ScorecardShareLinkRow[]>([]);
  const [scorecardShareBusy, setScorecardShareBusy] = useState(false);
  const [scorecardShareTtlDays, setScorecardShareTtlDays] = useState(14);
  const [scorecardShareIncludeName, setScorecardShareIncludeName] = useState(true);
  const [observerLinkUrl, setObserverLinkUrl] = useState("");
  const [observerLinkBusy, setObserverLinkBusy] = useState(false);
  const [observerLinks, setObserverLinks] = useState<ObserverLinkRow[]>([]);
  const [requirementInterviewLanguage, setRequirementInterviewLanguage] = useState("en");
  const [lastCreatedShare, setLastCreatedShare] = useState<{
    shareUrl: string;
    pdfUrl: string;
    expiresAt: string;
  } | null>(null);
  const [authCompanyName, setAuthCompanyName] = useState("Company");
  const [authAdminEmail, setAuthAdminEmail] = useState("");
  const [authCompanyDomain, setAuthCompanyDomain] = useState("");
  const [companyCreatedAt, setCompanyCreatedAt] = useState("");
  const [profileForm, setProfileForm] = useState({
    companyName: "",
    newPasscode: "",
    confirmPasscode: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>("dark");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [supportForm, setSupportForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [supportSending, setSupportSending] = useState(false);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportTicketSearch, setSupportTicketSearch] = useState("");
  const [supportTicketStatus, setSupportTicketStatus] = useState<"ALL" | SupportTicket["status"]>("ALL");
  const [loadingSupportTickets, setLoadingSupportTickets] = useState(false);
  const [supportFaqOpen, setSupportFaqOpen] = useState<string | null>("invite-email");
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => new Set());
  const [interviewerSettings, setInterviewerSettings] = useState({
    interviewerName: "",
    interviewerVoiceGender: "MALE" as "MALE" | "FEMALE",
  });
  const [brandSettings, setBrandSettings] = useState({
    brandDisplayName: "",
    brandPrimaryColor: "",
    brandLogoUrl: "",
    interviewLanguage: "en",
    atsWebhookUrl: "",
    atsWebhookSecret: "",
  });
  const [savingBrandSettings, setSavingBrandSettings] = useState(false);
  const [savingInterviewerSettings, setSavingInterviewerSettings] = useState(false);
  const [draftScrollToken, setDraftScrollToken] = useState(0);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("30d");
  const [candidates, setCandidates] = useState<CandidateView[]>([]);
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidateMetrics, setCandidateMetrics] = useState({
    total: 0,
    completedInterview: 0,
    readyNotStarted: 0,
    avgSessionsPerCandidate: 0,
    totalSessions: 0,
  });
  const [requirements, setRequirements] = useState<RequirementView[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [requirementSearch, setRequirementSearch] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("ALL");
  const [sessionQuickView, setSessionQuickView] = useState<SessionQuickViewKey>("all");
  const [sessionRecordingFilter, setSessionRecordingFilter] = useState<"all" | "no_recording">("all");
  const [sessionScoreMin, setSessionScoreMin] = useState<string>("");
  const [sessionScoreMax, setSessionScoreMax] = useState<string>("");
  const [sessionFrom, setSessionFrom] = useState<string>("");
  const [sessionTo, setSessionTo] = useState<string>("");
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [bulkExportBusy, setBulkExportBusy] = useState(false);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [savedSessionViews, setSavedSessionViews] = useState<SavedSessionView[]>([]);
  const [saveViewName, setSaveViewName] = useState("");
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionsTotal, setSessionsTotal] = useState(0);
  const [sessionsTotalPages, setSessionsTotalPages] = useState(1);
  const [requirementPage, setRequirementPage] = useState(1);
  const [requirementsTotal, setRequirementsTotal] = useState(0);
  const [requirementsTotalPages, setRequirementsTotalPages] = useState(1);
  const [requirementInviteStats, setRequirementInviteStats] = useState({
    used: 0,
    sent: 0,
    expired: 0,
  });
  const [sessionStatusCounts, setSessionStatusCounts] = useState({
    total: 0,
    ready: 0,
    live: 0,
    completed: 0,
    open: 0,
  });
  const SESSION_PAGE_SIZE = 10;
  const REQUIREMENT_PAGE_SIZE = 10;
  const [successMessage, setSuccessMessage] = useState("");
  const [requirementViewer, setRequirementViewer] = useState<RequirementView | null>(null);
  const [scheduleBusyEmail, setScheduleBusyEmail] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    kind: "session" | "candidate" | "requirement";
    recordId: string;
  } | null>(null);
  const [sessionEditDetail, setSessionEditDetail] = useState<SessionDetail | null>(null);
  const [sessionEditLoading, setSessionEditLoading] = useState(false);
  const [candidateViewer, setCandidateViewer] = useState<CandidateDetail | null>(null);
  const [candidateViewerLoading, setCandidateViewerLoading] = useState(false);

  const summary = useMemo(
    () => ({
      total: sessionStatusCounts.total,
      live: sessionStatusCounts.live,
      completed: sessionStatusCounts.completed,
      open: sessionStatusCounts.open,
    }),
    [sessionStatusCounts],
  );

  const displayedSessions = useMemo(() => {
    if (sessionRecordingFilter === "no_recording") {
      return sessions.filter((s) => s.videoRecordingStatus !== "AVAILABLE");
    }
    return sessions;
  }, [sessions, sessionRecordingFilter]);

  function applySessionQuickView(key: SessionQuickViewKey) {
    setSessionQuickView(key);
    setSessionRecordingFilter(key === "no_recording" ? "no_recording" : "all");
    if (key === "completed") setSessionStatusFilter("COMPLETED");
    else if (key === "ready") setSessionStatusFilter("READY");
    else setSessionStatusFilter("ALL");
    setSessionPage(1);
  }

  function resetSessionFilters() {
    setSessionSearch("");
    setSessionStatusFilter("ALL");
    setSessionScoreMin("");
    setSessionScoreMax("");
    setSessionFrom("");
    setSessionTo("");
    setSessionQuickView("all");
    setSessionRecordingFilter("all");
    setSessionPage(1);
  }

  const refreshDashboard = useCallback(async (period: DashboardPeriod = dashboardPeriod): Promise<string | null> => {
    setLoadingDashboard(true);
    try {
      const response = await fetch(`/api/admin/dashboard?period=${period}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as DashboardData & { error?: string };
      if (!response.ok) {
        return data.error ?? "Unable to load dashboard.";
      }
      setDashboardData(data);
      return null;
    } catch {
      return "Unable to load dashboard.";
    } finally {
      setLoadingDashboard(false);
    }
  }, [dashboardPeriod]);

  const refreshSessions = useCallback(async (): Promise<string | null> => {
    setLoadingSessions(true);
    const params = new URLSearchParams({
      page: String(sessionPage),
      pageSize: String(SESSION_PAGE_SIZE),
      status: sessionStatusFilter,
      search: sessionSearch.trim(),
      minScore: sessionScoreMin.trim(),
      maxScore: sessionScoreMax.trim(),
      from: sessionFrom.trim(),
      to: sessionTo.trim(),
    });
    try {
      const listRes = await fetch(`/api/admin/sessions?${params}`, { cache: "no-store" });
      const data = (await listRes.json().catch(() => ({}))) as {
        sessions?: SessionView[];
        pagination?: { total: number; totalPages: number };
        statusCounts?: typeof sessionStatusCounts;
        error?: string;
      };
      if (!listRes.ok) {
        return data.error ?? "Unable to load sessions.";
      }
      setSessions(data.sessions ?? []);
      setSessionsTotal(data.pagination?.total ?? 0);
      setSessionsTotalPages(data.pagination?.totalPages ?? 1);
      if (data.statusCounts) setSessionStatusCounts(data.statusCounts);
      return null;
    } catch {
      return "Unable to load sessions.";
    } finally {
      setLoadingSessions(false);
    }
  }, [
    sessionPage,
    sessionSearch,
    sessionStatusFilter,
    sessionScoreMin,
    sessionScoreMax,
    sessionFrom,
    sessionTo,
  ]);

  const refreshAuthCompany = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/company-auth/session", { cache: "no-store" });
      const data = (await response.json()) as { companyName?: string; error?: string };
      if (!response.ok || !data.companyName) {
        return data.error ?? "Unable to validate company session.";
      }
      setAuthCompanyName(data.companyName);
      return null;
    } catch {
      return "Unable to validate company session.";
    }
  }, []);

  const applyTheme = useCallback((next: AdminTheme) => {
    setTheme(next);
    applySiteTheme(next);
  }, []);

  const refreshInterviewerSettings = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/admin/company-settings", { cache: "no-store" });
      const data = (await response.json()) as {
        companyName?: string;
        companyDomain?: string;
        adminEmail?: string;
        createdAt?: string;
        interviewerName?: string;
        interviewerVoiceGender?: "MALE" | "FEMALE";
        brandDisplayName?: string;
        brandPrimaryColor?: string;
        brandLogoUrl?: string;
        interviewLanguage?: string;
        atsWebhookUrl?: string;
        error?: string;
      };
      if (!response.ok) {
        return data.error ?? "Unable to load interviewer settings.";
      }
      if (data.companyName) {
        setAuthCompanyName(data.companyName);
        setProfileForm((prev) => ({ ...prev, companyName: data.companyName ?? prev.companyName }));
        setSupportForm((prev) => ({
          ...prev,
          name: prev.name || data.companyName || "",
        }));
      }
      setAuthCompanyDomain(data.companyDomain ?? "");
      setAuthAdminEmail(data.adminEmail ?? "");
      setCompanyCreatedAt(data.createdAt ?? "");
      setSupportForm((prev) => ({
        ...prev,
        email: prev.email || (data.adminEmail ?? ""),
      }));
      setInterviewerSettings({
        interviewerName: data.interviewerName ?? "",
        interviewerVoiceGender: data.interviewerVoiceGender ?? "MALE",
      });
      setBrandSettings({
        brandDisplayName: data.brandDisplayName ?? "",
        brandPrimaryColor: data.brandPrimaryColor ?? "",
        brandLogoUrl: data.brandLogoUrl ?? "",
        interviewLanguage: data.interviewLanguage ?? "en",
        atsWebhookUrl: data.atsWebhookUrl ?? "",
        atsWebhookSecret: "",
      });
      setRequirementInterviewLanguage(data.interviewLanguage ?? "en");
      return null;
    } catch {
      return "Unable to load interviewer settings.";
    }
  }, []);

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSupportSending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supportForm.name.trim() || authCompanyName,
          email: (supportForm.email.trim() || authAdminEmail).toLowerCase(),
          subject: supportForm.subject.trim(),
          message: supportForm.message.trim(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        ticket?: SupportTicket;
      };
      if (!response.ok) {
        setError(data.error ?? "Unable to submit support request.");
        return;
      }
      setSuccessMessage("Support request sent. Our team will contact you shortly.");
      setSupportForm((prev) => ({ ...prev, subject: "", message: "" }));
      void refreshSupportTickets();
    } finally {
      setSupportSending(false);
    }
  }

  const refreshSupportTickets = useCallback(async (): Promise<string | null> => {
    setLoadingSupportTickets(true);
    try {
      const response = await fetch("/api/admin/support", { cache: "no-store" });
      const data = (await response.json()) as { tickets?: SupportTicket[]; error?: string };
      if (!response.ok) {
        return data.error ?? "Unable to load support tickets.";
      }
      setSupportTickets(data.tickets ?? []);
      return null;
    } catch {
      return "Unable to load support tickets.";
    } finally {
      setLoadingSupportTickets(false);
    }
  }, []);

  function toggleSelectedSession(id: string) {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setAllVisibleSessionsSelected(checked: boolean, visibleIds: string[]) {
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleIds.forEach((id) => next.add(id));
      } else {
        visibleIds.forEach((id) => next.delete(id));
      }
      return next;
    });
  }

  function csvEscape(value: unknown) {
    const raw = value == null ? "" : String(value);
    const needsQuotes = /[",\n\r]/.test(raw);
    const escaped = raw.replaceAll('"', '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  }

  function downloadCsv(filename: string, header: string[], rows: Array<Record<string, unknown>>) {
    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(","));
    for (const row of rows) {
      lines.push(header.map((key) => csvEscape(row[key])).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function sessionsToCsvRows(list: SessionView[]) {
    return list.map((s) => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt,
      positionTitle: s.positionTitle ?? "",
      domain: s.domain ?? "",
      topic: s.topic ?? "",
      accessCode: formatSessionInviteCode(s),
      candidateName: s.candidateName ?? "",
      candidateEmail: s.candidateEmail ?? "",
      overallScore: s.scorecard?.overallScore ?? "",
      videoRecordingStatus: s.videoRecordingStatus ?? "",
    }));
  }

  function persistSavedSessionViews(next: SavedSessionView[]) {
    setSavedSessionViews(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ADMIN_SAVED_SESSION_VIEWS_KEY, JSON.stringify(next));
    }
  }

  function applySavedSessionView(view: SavedSessionView) {
    setSessionSearch(view.filters.search);
    setSessionStatusFilter(view.filters.status);
    setSessionScoreMin(view.filters.scoreMin);
    setSessionScoreMax(view.filters.scoreMax);
    setSessionFrom(view.filters.from);
    setSessionTo(view.filters.to);
    setSuccessMessage(`Applied view: ${view.name}`);
  }

  function saveCurrentSessionView() {
    const name = saveViewName.trim();
    if (!name) {
      setError("Enter a name to save this view.");
      return;
    }
    setError("");
    const next: SavedSessionView[] = [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        createdAt: Date.now(),
        filters: {
          search: sessionSearch,
          status: sessionStatusFilter,
          scoreMin: sessionScoreMin,
          scoreMax: sessionScoreMax,
          from: sessionFrom,
          to: sessionTo,
        },
      },
      ...savedSessionViews,
    ].slice(0, 25);
    persistSavedSessionViews(next);
    setSaveViewName("");
    setSuccessMessage("View saved.");
  }

  function deleteSavedSessionView(id: string) {
    const next = savedSessionViews.filter((v) => v.id !== id);
    persistSavedSessionViews(next);
    setSuccessMessage("View removed.");
  }

  async function exportSelectedSessionsCsv() {
    const selected = sessions.filter((s) => selectedSessionIds.has(s.id));
    if (!selected.length) {
      setError("Select at least 1 session to export.");
      return;
    }
    setError("");
    downloadCsv(
      `sessions-selected-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "id",
        "status",
        "createdAt",
        "positionTitle",
        "domain",
        "topic",
        "accessCode",
        "candidateName",
        "candidateEmail",
        "overallScore",
        "videoRecordingStatus",
      ],
      sessionsToCsvRows(selected),
    );
  }

  async function exportAllFilteredSessionsCsv() {
    setBulkExportBusy(true);
    setError("");
    try {
      const header = [
        "id",
        "status",
        "createdAt",
        "positionTitle",
        "domain",
        "topic",
        "accessCode",
        "candidateName",
        "candidateEmail",
        "overallScore",
        "videoRecordingStatus",
      ];
      const rows: SessionView[] = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages) {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "50",
          status: sessionStatusFilter,
          search: sessionSearch.trim(),
          minScore: sessionScoreMin.trim(),
          maxScore: sessionScoreMax.trim(),
          from: sessionFrom.trim(),
          to: sessionTo.trim(),
          recentLimit: "0",
        });
        const res = await fetch(`/api/admin/sessions?${params}`);
        const data = (await res.json().catch(() => ({}))) as {
          sessions?: SessionView[];
          pagination?: { totalPages: number };
          error?: string;
        };
        if (!res.ok) {
          setError(data.error ?? "Unable to export sessions.");
          return;
        }
        rows.push(...(data.sessions ?? []));
        totalPages = data.pagination?.totalPages ?? 1;
        page += 1;
      }
      downloadCsv(
        `sessions-filtered-${new Date().toISOString().slice(0, 10)}.csv`,
        header,
        sessionsToCsvRows(rows),
      );
      setSuccessMessage("CSV exported.");
    } finally {
      setBulkExportBusy(false);
    }
  }

  async function bulkDeleteSelectedSessions() {
    const ids = sessions.filter((s) => selectedSessionIds.has(s.id)).map((s) => s.id);
    if (!ids.length) {
      setError("Select at least 1 session to delete.");
      return;
    }
    const ok = await confirmDelete({
      item: "session",
      count: ids.length,
      message: "This deletes transcripts, scorecards, and videos permanently.",
    });
    if (!ok) return;

    setBulkDeleteBusy(true);
    setError("");
    try {
      for (const id of ids) {
        const response = await fetch(`/api/admin/session/${id}`, { method: "DELETE" });
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Unable to delete one or more sessions.");
          return;
        }
      }
      setSelectedSessionIds(new Set());
      await Promise.all([refreshSessions(), refreshCandidates(), refreshRequirements()]);
      setSuccessMessage("Selected sessions deleted.");
    } finally {
      setBulkDeleteBusy(false);
    }
  }

  async function saveInterviewerSettings() {
    setSavingInterviewerSettings(true);
    setError("");
    try {
      const response = await fetch("/api/admin/company-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(interviewerSettings),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to save interviewer settings.");
        return;
      }
      setSuccessMessage("AI interviewer settings saved.");
      await refreshInterviewerSettings();
    } finally {
      setSavingInterviewerSettings(false);
    }
  }

  async function saveBrandSettings() {
    setSavingBrandSettings(true);
    setError("");
    try {
      const response = await fetch("/api/admin/company-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brandSettings),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Unable to save branding settings.");
        return;
      }
      setSuccessMessage("Branding and integrations saved.");
      await refreshInterviewerSettings();
    } finally {
      setSavingBrandSettings(false);
    }
  }

  async function saveProfileSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");
    try {
      if (profileForm.newPasscode || profileForm.confirmPasscode) {
        if (profileForm.newPasscode.length < 4) {
          setError("New password must be at least 4 characters.");
          return;
        }
        if (profileForm.newPasscode !== profileForm.confirmPasscode) {
          setError("New password and confirm password do not match.");
          return;
        }
      }

      const response = await fetch("/api/admin/company-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: profileForm.companyName.trim(),
          ...(profileForm.newPasscode
            ? {
                newPasscode: profileForm.newPasscode,
              }
            : {}),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        companyName?: string;
        passwordUpdated?: boolean;
      };
      if (!response.ok) {
        setError(data.error ?? "Unable to save profile.");
        return;
      }
      if (data.companyName) setAuthCompanyName(data.companyName);
      setProfileForm((prev) => ({
        ...prev,
        companyName: data.companyName ?? prev.companyName,
        newPasscode: "",
        confirmPasscode: "",
      }));
      setSuccessMessage(
        data.passwordUpdated ? "Profile and password updated." : "Profile updated.",
      );
      await refreshAuthCompany();
    } finally {
      setSavingProfile(false);
    }
  }

  const refreshCandidates = useCallback(async (): Promise<string | null> => {
    setLoadingCandidates(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "200",
        search: candidateSearch.trim(),
        status: "ALL",
      });
      const response = await fetch(`/api/admin/candidates?${params}`, { cache: "no-store" });
      const data = (await response.json()) as {
        candidates?: CandidateView[];
        pagination?: { total: number; totalPages: number };
        metrics?: {
          total: number;
          completedInterview: number;
          readyNotStarted: number;
          avgSessionsPerCandidate: number;
          totalSessions?: number;
        };
        error?: string;
      };
      if (!response.ok) {
        return data.error ?? "Unable to load candidates.";
      }
      setCandidates(data.candidates ?? []);
      if (data.metrics) {
        setCandidateMetrics({
          total: data.metrics.total,
          completedInterview: data.metrics.completedInterview,
          readyNotStarted: data.metrics.readyNotStarted,
          avgSessionsPerCandidate: data.metrics.avgSessionsPerCandidate,
          totalSessions: data.metrics.totalSessions ?? 0,
        });
      }
      return null;
    } catch {
      return "Unable to load candidates.";
    } finally {
      setLoadingCandidates(false);
    }
  }, [candidateSearch]);

  const refreshRequirements = useCallback(async (): Promise<string | null> => {
    setLoadingRequirements(true);
    const params = new URLSearchParams({
      page: "1",
      pageSize: "200",
      search: requirementSearch.trim(),
    });
    try {
      const response = await fetch(`/api/admin/requirements?${params}`, { cache: "no-store" });
      const data = (await response.json()) as {
        requirements?: RequirementView[];
        pagination?: { total: number; totalPages: number };
        inviteStats?: { used: number; sent: number; expired: number };
        error?: string;
      };
      if (!response.ok) {
        return data.error ?? "Unable to load openings.";
      }
      setRequirements(data.requirements ?? []);
      setRequirementsTotal(data.pagination?.total ?? 0);
      setRequirementsTotalPages(data.pagination?.totalPages ?? 1);
      setRequirementInviteStats(
        data.inviteStats ?? { used: 0, sent: 0, expired: 0 },
      );
      return null;
    } catch {
      return "Unable to load openings.";
    } finally {
      setLoadingRequirements(false);
    }
  }, [requirementSearch]);

  const refreshOverviewRequirements = useCallback(async (): Promise<string | null> => {
    setLoadingOverviewRequirements(true);
    const params = new URLSearchParams({ page: "1", pageSize: "20" });
    try {
      const response = await fetch(`/api/admin/requirements?${params}`, { cache: "no-store" });
      const data = (await response.json()) as {
        requirements?: RequirementView[];
        error?: string;
      };
      if (!response.ok) {
        return data.error ?? "Unable to load previous openings.";
      }
      setOverviewRequirements(data.requirements ?? []);
      return null;
    } catch {
      return "Unable to load previous openings.";
    } finally {
      setLoadingOverviewRequirements(false);
    }
  }, []);

  function applyRequirementToForm(requirement: RequirementView) {
    setSelectedRequirementId(requirement.requirementId);
    setTargetRole(requirement.title?.trim() || requirement.domain);
    setJobDescription(requirement.jobDescription?.trim() || "");
    setSkills(parseKeySkillsArray(requirement.keySkills));
    setDurationMin(requirement.durationMin);
    setMandatoryQuestionsText(requirement.mandatoryQuestions.join("\n"));
    setOptionalQuestionsText(requirement.optionalQuestions.join("\n"));
    setMaxOptionalQuestions(requirement.maxOptionalQuestions);
    setQuestionsOpen(requirement.mandatoryQuestions.length > 0);
    setOptionalQuestionsOpen(requirement.optionalQuestions.length > 0);
    setRoleMenuOpen(false);
    setError("");
    setSuccessMessage(`Loaded "${requirement.title ?? requirement.domain}" — add emails and send invites.`);
  }

  function clearSelectedRequirement() {
    setSelectedRequirementId(null);
    setTargetRole("");
    setJobDescription("");
    setSkills([]);
    setSkillInput("");
    setMandatoryQuestionsText("");
    setOptionalQuestionsText("");
    setDurationMin(5);
    setMaxOptionalQuestions(2);
    setQuestionsOpen(false);
    setOptionalQuestionsOpen(false);
    setError("");
  }

  function addSkill() {
    const next = skillInput.trim();
    if (!next || skills.includes(next)) return;
    setSkills((s) => [...s, next]);
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setSkills((s) => s.filter((x) => x !== skill));
  }

  function addSuggestedSkill(skill: string) {
    const next = skill.trim();
    if (!next) return;
    setSkills((current) => (current.includes(next) ? current : [...current, next]));
  }

  function addAllSuggestedSkills() {
    const toAdd = roleSkillSuggestions.skills.filter((skill) => !skills.includes(skill));
    if (!toAdd.length) return;
    setSkills((current) => [...current, ...toAdd]);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTargetRole(targetRole.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [targetRole]);

  useEffect(() => {
    function closeRoleMenu(event: MouseEvent) {
      if (!roleFieldRef.current?.contains(event.target as Node)) {
        setRoleMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeRoleMenu);
    return () => document.removeEventListener("mousedown", closeRoleMenu);
  }, []);

  const roleSkillSuggestions = suggestKeySkillsForTargetRole(debouncedTargetRole);
  const pendingSuggestedSkills = roleSkillSuggestions.skills.filter((skill) => !skills.includes(skill));
  const verificationByEmail = useMemo(
    () => new Map(emailVerifications.map((row) => [row.email, row])),
    [emailVerifications],
  );
  const verifiedEmailCount = emailVerifications.filter((row) => row.valid).length;
  const invalidEmailCount = emailVerifications.filter((row) => !row.valid).length;

  const filteredSupportTickets = useMemo(() => {
    const query = supportTicketSearch.trim().toLowerCase();
    return supportTickets.filter((ticket) => {
      if (supportTicketStatus !== "ALL" && ticket.status !== supportTicketStatus) return false;
      if (!query) return true;
      return `${ticket.subject} ${ticket.message}`.toLowerCase().includes(query);
    });
  }, [supportTickets, supportTicketSearch, supportTicketStatus]);

  useEffect(() => {
    if (!parsedEmails.length) {
      setEmailVerifications([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setVerifyingEmails(true);
        const response = await fetch("/api/admin/requirements/verify-emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: parsedEmails }),
        });
        const data = await readResponseJson<{ results?: EmailVerificationResult[] }>(response);
        if (!cancelled) {
          setEmailVerifications(response.ok ? (data.results ?? []) : []);
          setVerifyingEmails(false);
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [parsedEmails]);

  const isRequirementFormValid = useMemo(
    () =>
      jobDescription.trim().length > 0 &&
      targetRole.trim().length > 0 &&
      skills.length > 0,
    [jobDescription, targetRole, skills],
  );

  const canSendInvites = useMemo(
    () => parsedEmails.length > 0 && (selectedRequirementId !== null || isRequirementFormValid),
    [parsedEmails.length, selectedRequirementId, isRequirementFormValid],
  );

  function updateDuration(value: string) {
    if (value === "") {
      setDurationMin("");
      return;
    }
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    const rounded = Math.round(next);
    const clamped = Math.min(120, Math.max(0, rounded));
    setDurationMin(clamped);
  }

  async function handleExcelFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError("");
    setInviteResults(null);
    setInviteSummary(null);
    if (!file) {
      setParsedEmails([]);
      setExcelFileName(null);
      setExcelInvalidRows([]);
      setExcelDuplicateRows([]);
      setExcelEmptyRows([]);
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setError("Excel file is empty.");
        return;
      }
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
      const parsed = extractEmailsFromSheetRows(rows);
      if (parsed.columnIndex < 0) {
        setError('Could not find an "email" column in the Excel sheet.');
        setParsedEmails([]);
        setExcelInvalidRows([]);
        setExcelDuplicateRows([]);
        setExcelEmptyRows([]);
        setExcelFileName(file.name);
        return;
      }
      if (!parsed.emails.length) {
        setError("No valid emails found in the Excel sheet.");
        setParsedEmails([]);
        setExcelInvalidRows(parsed.invalidRows);
        setExcelDuplicateRows(parsed.duplicateRows);
        setExcelEmptyRows(parsed.emptyRows);
        setExcelFileName(file.name);
        return;
      }
      if (parsed.emails.length > EXCEL_EMAIL_LIMIT) {
        setError(`Excel can include up to ${EXCEL_EMAIL_LIMIT} candidate emails.`);
        setParsedEmails(parsed.emails.slice(0, EXCEL_EMAIL_LIMIT));
      } else {
        setParsedEmails(parsed.emails);
      }
      setExcelInvalidRows(parsed.invalidRows);
      setExcelDuplicateRows(parsed.duplicateRows);
      setExcelEmptyRows(parsed.emptyRows);
      setExcelFileName(file.name);
    } catch {
      setError("Unable to read the Excel file.");
      setParsedEmails([]);
      setExcelFileName(null);
      setExcelInvalidRows([]);
      setExcelDuplicateRows([]);
      setExcelEmptyRows([]);
    }
  }

  function handleManualEmailChange(value: string) {
    setManualEmailText(value);
    setInviteResults(null);
    setInviteSummary(null);
    setParsedEmails(parseManualEmailInput(value));
  }

  function buildRequirementPayload(formData: FormData) {
    const questionsText = mandatoryQuestionsText.trim()
      ? mandatoryQuestionsText
      : String(formData.get("questions") ?? "");
    const optionalQuestionsTextValue = optionalQuestionsText.trim()
      ? optionalQuestionsText
      : String(formData.get("optionalQuestions") ?? "");
    const questions = questionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const optionalQuestions = optionalQuestionsTextValue
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const positionTitle = targetRole.trim();
    const jobDescriptionValue = jobDescription.trim();
    const domain = positionTitle;
    const topic = jobDescriptionValue.slice(0, 400);

    return {
      ...(selectedRequirementId ? { requirementId: selectedRequirementId } : {}),
      positionTitle,
      domain,
      topic,
      durationMin: Math.min(120, Math.max(5, Number(durationMin) || 5)),
      jobDescription: jobDescriptionValue,
      keySkills: skills,
      questions: questions.length ? questions : undefined,
      optionalQuestions: optionalQuestions.length ? optionalQuestions : undefined,
      maxOptionalQuestions,
      interviewLanguage: requirementInterviewLanguage,
    };
  }

  async function downloadVerificationPdf() {
    if (!emailVerifications.length || verifyingEmails) return;
    setVerificationPdfBusy(true);
    setError("");
    try {
      const bytes = await buildCandidateVerificationPdfBytes({
        companyName: authCompanyName,
        roleTitle: targetRole.trim() || undefined,
        source: inviteMode,
        fileName: excelFileName,
        results: emailVerifications,
      });
      const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `candidate-email-verification-${stamp}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setSuccessMessage("Verification report downloaded as PDF.");
    } catch {
      setError("Unable to generate verification PDF.");
    } finally {
      setVerificationPdfBusy(false);
    }
  }

  async function handleGenerateQuestionsFromJd() {
    const jobDescriptionValue = jobDescription.trim();
    const positionTitle = targetRole.trim();

    if (!jobDescriptionValue) {
      setError("Enter a job description before generating questions.");
      return;
    }
    if (!positionTitle) {
      setError("Enter a target role before generating questions.");
      return;
    }

    setGenerateQuestionsBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-questions",
          jobDescription: jobDescriptionValue,
          positionTitle,
          domain: positionTitle,
          keySkills: skills,
          questionCount: 5,
        }),
      });
      const data = (await response.json()) as {
        questions?: Array<{ prompt: string }>;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Unable to generate questions from job description.");
        return;
      }
      const prompts = (data.questions ?? [])
        .map((q) => q.prompt.trim())
        .filter(Boolean)
        .slice(0, 5);
      if (!prompts.length) {
        setError("No questions were generated. Try again or add questions manually.");
        return;
      }
      setMandatoryQuestionsText(prompts.join("\n"));
      setQuestionsOpen(true);
      setSuccessMessage(`Generated ${prompts.length} role-specific interview question(s) from the job description.`);
    } catch {
      setError("Unable to generate questions from job description.");
    } finally {
      setGenerateQuestionsBusy(false);
    }
  }

  async function handleSendInvites() {
    setError("");
    setSuccessMessage("");
    setInviteResults(null);
    setInviteSummary(null);

    const positionTitle = targetRole.trim();
    const jobDescriptionValue = jobDescription.trim();

    if (!selectedRequirementId) {
      if (!jobDescriptionValue) {
        setError("Please enter a job description.");
        return;
      }
      if (!positionTitle) {
        setError("Please enter a target role.");
        return;
      }
      if (!skills.length) {
        setError("Please add at least one key skill.");
        return;
      }
    }

    const emails =
      inviteMode === "manual" ? parseManualEmailInput(manualEmailText) : parsedEmails;

    if (!emails.length) {
      setError(
        inviteMode === "manual"
          ? "Add at least one valid email address."
          : "Upload an Excel file with a valid email column.",
      );
      return;
    }

    const limit = inviteMode === "manual" ? MANUAL_EMAIL_LIMIT : EXCEL_EMAIL_LIMIT;
    if (emails.length > limit) {
      setError(`You can invite up to ${limit} candidates via ${inviteMode === "manual" ? "manual entry" : "Excel upload"}.`);
      return;
    }

    const formData = formRef.current ? new FormData(formRef.current) : new FormData();
    const payload = {
      source: inviteMode,
      emails,
      requirement: buildRequirementPayload(formData),
    };

    setInviteSending(true);
    const response = await fetch("/api/admin/requirements/invite-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readResponseJson<{
      invites?: InviteDeliveryRow[];
      summary?: InviteDeliverySummary;
      sentCount?: number;
      failedCount?: number;
      invalidCount?: number;
      spamFolderNote?: string;
      error?: string;
    }>(response);
    setInviteSending(false);

    if (!response.ok) {
      setError(data.error ?? "Unable to send candidate invites.");
      return;
    }

    setInviteResults(data.invites ?? []);
    setInviteSummary(data.summary ?? null);
    const summary = data.summary;
    if (summary) {
      const parts = [`${summary.sent} sent`];
      if (summary.invalid > 0) parts.push(`${summary.invalid} incorrect`);
      if (summary.failed > 0) parts.push(`${summary.failed} failed`);
      setSuccessMessage(`Invite report: ${parts.join(" · ")}.`);
    } else {
      setSuccessMessage(`Interview invites sent to ${data.sentCount ?? emails.length} candidate(s).`);
    }
    await refreshSessions();
    await refreshOverviewRequirements();
  }

  async function handleSaveRequirement() {
    setError("");
    setSuccessMessage("");

    const positionTitle = targetRole.trim();
    const jobDescriptionValue = jobDescription.trim();

    if (!jobDescriptionValue) {
      setError("Please enter a job description.");
      return;
    }
    if (!positionTitle) {
      setError("Please enter a target role.");
      return;
    }
    if (!skills.length) {
      setError("Please add at least one key skill.");
      return;
    }

    const formData = formRef.current ? new FormData(formRef.current) : new FormData();
    const draft = buildRequirementPayload(formData);
    const questions = (draft.questions as string[] | undefined) ?? [];
    const optionalQuestions = (draft.optionalQuestions as string[] | undefined) ?? [];

    setSavingRequirement(true);
    const response = await fetch("/api/admin/requirements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.positionTitle,
        domain: draft.domain,
        topic: draft.topic,
        durationMin: draft.durationMin,
        jobDescription: draft.jobDescription,
        keySkills: draft.keySkills,
        mandatoryQuestions: questions,
        optionalQuestions,
        maxOptionalQuestions: draft.maxOptionalQuestions,
        interviewLanguage: draft.interviewLanguage,
      }),
    });
    const data = await readResponseJson<{ requirementId?: string; accessCode?: string; error?: string }>(
      response,
    );
    setSavingRequirement(false);

    if (!response.ok) {
      setError(data.error ?? "Unable to save opening.");
      return;
    }

    setSuccessMessage(
      data.accessCode
        ? `Opening saved. You can invite candidates anytime from Job Openings or send invites below.`
        : "Opening saved.",
    );
    await refreshRequirements();
    await refreshDashboard();
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleSendInvites();
  }

  function scrollToDraft() {
    closeAllViewers();
    try {
      sessionStorage.setItem("uhired-admin-focus-draft", "1");
    } catch {
      // ignore
    }
    if (pathname !== "/admin/invite") {
      router.push("/admin/invite");
      return;
    }
    setDraftScrollToken((token) => token + 1);
  }

  function closeAllViewers() {
    setDetailSession(null);
    setDetailLoading(false);
    setCandidateViewer(null);
    setCandidateViewerLoading(false);
    setRequirementViewer(null);
    setEditor(null);
    setSessionEditDetail(null);
    setSessionEditLoading(false);
  }

  function setActiveSection(section: string) {
    closeAllViewers();
    const path = adminPathForSection(section, section === "requirements" ? "openings" : openingTab);
    if (pathname !== path) router.push(path);
  }

  function setOpeningTab(tab: "openings" | "sessions") {
    const path = adminPathForSection("requirements", tab);
    if (pathname !== path) router.push(path);
  }

  function goToOpening(tab: "openings" | "sessions" = "openings") {
    closeAllViewers();
    setOpeningTab(tab);
  }

  function navigateToSection(section: string) {
    closeAllViewers();
    if (section === "overview") {
      scrollToDraft();
      return;
    }
    if (section === "sessions") {
      setOpeningTab("sessions");
      return;
    }
    setActiveSection(section);
  }

  function updateMaxOptionalQuestions(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    const rounded = Math.round(next);
    const clamped = Math.min(20, Math.max(0, rounded));
    setMaxOptionalQuestions(clamped);
  }

  async function copyCode(value: string, successText: string) {
    await navigator.clipboard.writeText(value);
    setSuccessMessage(successText);
  }

  async function copyOpeningShareLink(requirement: RequirementView) {
    const response = await fetch(`/api/admin/requirements/${requirement.requirementId}/share-link`, {
      method: "POST",
    });
    const data = (await response.json()) as { shareUrl?: string; accessCode?: string; error?: string };
    if (!response.ok || !data.shareUrl) {
      setError(data.error ?? "Unable to create share link.");
      return;
    }
    if (data.accessCode) {
      setRequirements((current) =>
        current.map((item) =>
          item.requirementId === requirement.requirementId
            ? { ...item, requirementAccessCode: data.accessCode ?? item.requirementAccessCode }
            : item,
        ),
      );
      setRequirementViewer((current) =>
        current && current.requirementId === requirement.requirementId
          ? { ...current, requirementAccessCode: data.accessCode ?? current.requirementAccessCode }
          : current,
      );
    }
    await copyCode(data.shareUrl, "Share link copied. Send it to any candidate.");
  }

  async function scheduleOpeningInvite(input: {
    requirementId: string;
    email: string;
    scheduledAt: string;
  }) {
    setError("");
    setScheduleBusyEmail(input.email);
    try {
      const scheduledAt = new Date(input.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        setError("Choose a valid interview date and time.");
        return;
      }
      const response = await fetch("/api/admin/requirements/schedule-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementId: input.requirementId,
          email: input.email,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        emailed?: boolean;
        emailError?: string | null;
        invite?: RequirementView["candidateInvites"][number];
        error?: string;
      };
      if (!response.ok || !data.ok || !data.invite) {
        setError(data.error ?? "Unable to schedule this interview.");
        return;
      }
      const updatedInvite = data.invite;
      const patchInvites = (invites: RequirementView["candidateInvites"]) =>
        invites.map((invite) => (invite.email === updatedInvite.email ? { ...invite, ...updatedInvite } : invite));
      setRequirements((current) =>
        current.map((item) =>
          item.requirementId === input.requirementId
            ? { ...item, candidateInvites: patchInvites(item.candidateInvites ?? []) }
            : item,
        ),
      );
      setRequirementViewer((current) =>
        current && current.requirementId === input.requirementId
          ? { ...current, candidateInvites: patchInvites(current.candidateInvites ?? []) }
          : current,
      );
      if (data.emailed) {
        setSuccessMessage(`Interview email sent to ${input.email} with the scheduled time.`);
      } else {
        setError(data.emailError ?? "Schedule saved, but the email was not sent.");
      }
    } catch {
      setError("Unable to schedule this interview.");
    } finally {
      setScheduleBusyEmail(null);
    }
  }

  async function runAnswerGrading(sessionId: string) {
    setRegradeBusy(true);
    setError("");
    const response = await fetch(`/api/admin/session/${sessionId}/regrade`, { method: "POST" });
    const data = (await response.json()) as {
      error?: string;
      questionResults?: SessionDetail["scorecard"] extends { questionResults?: infer R } ? R : never;
      accuracyPercent?: number;
    };
    setRegradeBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Unable to grade answers.");
      return;
    }
    setSuccessMessage(
      data.accuracyPercent != null
        ? `Answer grading updated (${data.accuracyPercent}% accuracy).`
        : "Answer grading updated.",
    );
    await openSessionDetail(sessionId);
  }

  async function openSessionEditor(sessionId: string) {
    setDetailSession(null);
    setDetailLoading(false);
    setCandidateViewer(null);
    setCandidateViewerLoading(false);
    setRequirementViewer(null);
    setEditor({ kind: "session", recordId: sessionId });
    setSessionEditLoading(true);
    setSessionEditDetail(null);
    setError("");
    const response = await fetch(`/api/admin/session/${sessionId}`);
    const data = (await response.json()) as { session?: SessionDetail; error?: string };
    setSessionEditLoading(false);
    if (!response.ok || !data.session) {
      setError(data.error ?? "Unable to load session for editing.");
      closeEditor();
      return;
    }
    setSessionEditDetail(data.session);
  }

  function closeEditor() {
    setEditor(null);
    setSessionEditDetail(null);
    setSessionEditLoading(false);
  }

  async function openCandidateViewer(candidateId: string) {
    setDetailSession(null);
    setRequirementViewer(null);
    setCandidateViewerLoading(true);
    setCandidateViewer(null);
    setError("");
    const response = await fetch(`/api/admin/candidates/${candidateId}`);
    const data = (await response.json().catch(() => ({}))) as CandidateDetail & { error?: string };
    setCandidateViewerLoading(false);
    if (!response.ok || !data.candidate) {
      setError(data.error ?? "Unable to load candidate details.");
      return;
    }
    setCandidateViewer(data);
  }

  function closeCandidateViewer() {
    setCandidateViewer(null);
    setCandidateViewerLoading(false);
  }

  async function openSessionDetail(sessionId: string) {
    setCandidateViewer(null);
    setCandidateViewerLoading(false);
    setRequirementViewer(null);
    setDetailLoading(true);
    setDetailSession(null);
    setLastCreatedShare(null);
    setScorecardShareLinks([]);
    setObserverLinkUrl("");
    setObserverLinks([]);
    const response = await fetch(`/api/admin/session/${sessionId}`);
    const data = (await response.json()) as { session?: SessionDetail; error?: string };
    setDetailLoading(false);
    if (!response.ok || !data.session) {
      setError(data.error ?? "Unable to load session detail.");
      return;
    }
    setDetailSession(data.session);
    if (data.session.candidateName) {
      setScorecardShareIncludeName(true);
    }
    setError("");
    if (data.session.scorecard) {
      const linksRes = await fetch(`/api/admin/session/${sessionId}/scorecard-share`);
      const linksData = (await linksRes.json()) as { links?: ScorecardShareLinkRow[] };
      const activeLinks = linksRes.ok ? (linksData.links ?? []) : [];
      setScorecardShareLinks(activeLinks);
      const stored = loadStoredScorecardShare(sessionId);
      if (stored && activeLinks.some((link) => link.id === stored.linkId)) {
        setLastCreatedShare({
          shareUrl: stored.shareUrl,
          pdfUrl: stored.pdfUrl,
          expiresAt: stored.expiresAt,
        });
      }
    } else {
      setScorecardShareLinks([]);
    }
    if (data.session.status === "LIVE" || data.session.status === "READY") {
      const observerRes = await fetch(`/api/admin/session/${sessionId}/observer-link`);
      const observerData = (await observerRes.json()) as { links?: ObserverLinkRow[] };
      setObserverLinks(observerRes.ok ? (observerData.links ?? []) : []);
    } else {
      setObserverLinks([]);
    }
  }

  async function saveSessionEdit(event: FormEvent<HTMLFormElement>, sessionId: string) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const session = sessionEditDetail ?? sessions.find((s) => s.id === sessionId);
    const isCompleted = session?.status === "COMPLETED";

    const mandatoryQuestions = String(fd.get("mandatoryQuestions") ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const optionalQuestions = String(fd.get("optionalQuestions") ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const keySkills = String(fd.get("keySkills") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const payload = isCompleted
      ? {
          candidateName: String(fd.get("candidateName") ?? "").trim(),
          ...(String(fd.get("candidateEmail") ?? "").trim()
            ? { candidateEmail: String(fd.get("candidateEmail") ?? "").trim() }
            : {}),
        }
      : {
          positionTitle: String(fd.get("positionTitle") ?? "").trim(),
          domain: String(fd.get("domain") ?? "").trim(),
          topic: String(fd.get("topic") ?? "").trim(),
          durationMin: Number(fd.get("durationMin") ?? 10),
          candidateName: String(fd.get("candidateName") ?? "").trim() || undefined,
          candidateEmail: String(fd.get("candidateEmail") ?? "").trim() || undefined,
          jobDescription: String(fd.get("jobDescription") ?? "").trim(),
          keySkills,
          maxOptionalQuestions: Number(fd.get("maxOptionalQuestions") ?? 0),
          mandatoryQuestions,
          optionalQuestions,
        };

    const response = await fetch(`/api/admin/session/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to save session.");
      return;
    }
    closeEditor();
    setSuccessMessage(isCompleted ? "Candidate details updated." : "Session updated.");
    await refreshSessions();
    if (detailSession?.id === sessionId) {
      await openSessionDetail(sessionId);
    }
  }

  async function saveCandidateEdit(event: FormEvent<HTMLFormElement>, sessionId: string) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/candidates/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(fd.get("candidateName") ?? "").trim(),
        email: String(fd.get("candidateEmail") ?? "").trim(),
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to save candidate.");
      return;
    }
    closeEditor();
    setSuccessMessage("Candidate updated.");
    await refreshCandidates();
    await refreshSessions();
    if (detailSession) {
      await openSessionDetail(detailSession.id);
    }
  }

  async function saveRequirementEdit(event: FormEvent<HTMLFormElement>, sessionId: string) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const mandatoryQuestions = String(fd.get("mandatoryQuestions") ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const optionalQuestions = String(fd.get("optionalQuestions") ?? "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const keySkills = String(fd.get("keySkills") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const response = await fetch(`/api/admin/requirements/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(fd.get("title") ?? "").trim(),
        domain: String(fd.get("domain") ?? "").trim(),
        topic: String(fd.get("topic") ?? "").trim(),
        durationMin: Number(fd.get("durationMin") ?? 5),
        jobDescription: String(fd.get("jobDescription") ?? "").trim(),
        keySkills,
        maxOptionalQuestions: Number(fd.get("maxOptionalQuestions") ?? 0),
        mandatoryQuestions,
        optionalQuestions,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to save opening.");
      return;
    }
    closeEditor();
    setSuccessMessage("Opening updated.");
    await refreshRequirements();
  }

  async function deleteSessionSubmission(sessionId: string) {
    const ok = await confirmDelete({
      item: "interview session",
      message: "This will delete the session, transcript, scorecard, and video permanently.",
    });
    if (!ok) {
      return;
    }

    // Optimistically remove from local state
    const previousSessions = [...sessions];
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));

    if (detailSession?.id === sessionId) {
      setDetailSession(null);
    }

    const response = await fetch(`/api/admin/session/${sessionId}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    
    if (!response.ok) {
      // Revert on error
      setSessions(previousSessions);
      setError(data.error ?? "Unable to delete interview session.");
      return;
    }

    setSuccessMessage("Interview session deleted successfully.");
    await Promise.all([refreshSessions(), refreshCandidates(), refreshRequirements()]);
  }

  async function deleteCandidateEntry(candidate: CandidateView) {
    const ok = await confirmDelete({
      item: "candidate entry",
      message: "This removes the candidate entry and linked submissions for this company.",
    });
    if (!ok) {
      return;
    }
    const response = await fetch("/api/admin/candidates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateId: candidate.candidateId,
      }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to delete candidate entry.");
      return;
    }
    setSuccessMessage("Candidate entry deleted.");
    await Promise.all([refreshSessions(), refreshCandidates(), refreshRequirements()]);
  }

  async function deleteRequirement(sessionId: string) {
    const shouldDelete = await confirmAction({
      title: "Delete opening?",
      message:
        "This removes the opening from active use. Existing submitted interview data will be preserved in Interview Sessions.",
      confirmLabel: "Delete opening",
      variant: "danger",
    });
    if (!shouldDelete) {
      return;
    }

    const response = await fetch(`/api/admin/requirements/${sessionId}`, {
      method: "DELETE",
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Unable to delete opening.");
      return;
    }
    setSuccessMessage("Opening deleted from active list.");
    await Promise.all([refreshRequirements(), refreshSessions()]);
  }

  async function handleLogout() {
    await fetch("/api/company-auth/logout", { method: "POST" });
    window.location.href = "/company-login";
  }

  useEffect(() => {
    applyTheme(readStoredSiteTheme() ?? "dark");
  }, [applyTheme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(ADMIN_SAVED_SESSION_VIEWS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as SavedSessionView[];
      if (Array.isArray(parsed)) {
        setSavedSessionViews(parsed.slice(0, 25));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!headerMenuRef.current) return;
      if (!headerMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    setReadNotificationIds(loadReadNotificationIds());
  }, []);

  useEffect(() => {
    const items: NotificationItem[] = [];
    if (sessionStatusCounts.live > 0) {
      items.push({
        id: "live",
        title: "Live interviews",
                        body: `${sessionStatusCounts.live} interview${sessionStatusCounts.live === 1 ? "" : "s"} currently live.`,
        time: "Now",
        section: "sessions",
      });
    }
    if (sessionStatusCounts.ready > 0) {
      items.push({
        id: "ready",
        title: "Ready interviews",
        body: `${sessionStatusCounts.ready} interview${sessionStatusCounts.ready === 1 ? "" : "s"} waiting for candidates.`,
        time: "Today",
        section: "sessions",
      });
    }
    const pendingInvites = dashboardData?.invites.pending ?? 0;
    if (pendingInvites > 0) {
      items.push({
        id: "invites-pending",
        title: "Pending invites",
        body: `${pendingInvites} invite${pendingInvites === 1 ? "" : "s"} sent but not yet used.`,
        time: "Active",
        section: "requirements",
      });
    }
    const repliedTickets = supportTickets.filter((t) => t.status === "REPLIED");
    for (const ticket of repliedTickets.slice(0, 3)) {
      items.push({
        id: `support-${ticket.id}`,
        title: "Support reply received",
        body: ticket.subject,
        time: formatRelativeTime(ticket.updatedAt),
        section: "support",
      });
    }
    if (sessionStatusCounts.completed > 0 && items.length < 5) {
      items.push({
        id: "completed",
        title: "Completed interviews",
        body: `${sessionStatusCounts.completed} completed interview${sessionStatusCounts.completed === 1 ? "" : "s"} available for review.`,
        time: "Updated",
        section: "sessions",
      });
    }
    if (!items.length) {
      items.push({
        id: "empty",
        title: "You're all caught up",
        body: "No new alerts right now. New interview activity will appear here.",
        time: "Just now",
      });
    }
    setNotifications(
      items.map((item) => ({
        ...item,
        unread: item.id !== "empty" && !readNotificationIds.has(item.id),
      })),
    );
  }, [sessionStatusCounts, dashboardData, supportTickets, readNotificationIds]);

  const supportTicketStats = useMemo(() => {
    const newCount = supportTickets.filter((t) => t.status === "NEW").length;
    const openCount = supportTickets.filter(
      (t) => t.status === "NEW" || t.status === "READ",
    ).length;
    const repliedCount = supportTickets.filter((t) => t.status === "REPLIED").length;
    return {
      total: supportTickets.length,
      newCount,
      openCount,
      repliedCount,
    };
  }, [supportTickets]);

  function markNotificationsRead(ids: string[]) {
    setReadNotificationIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveReadNotificationIds(next);
      return next;
    });
  }

  function handleNotificationClick(item: NotificationItem) {
    markNotificationsRead([item.id]);
    setNotificationsOpen(false);
    if (item.section === "sessions") {
      goToOpening("sessions");
      return;
    }
    if (item.section === "requirements") {
      goToOpening("openings");
      return;
    }
    if (item.section) {
      setActiveSection(item.section);
    }
  }

  const invitesSentCount = dashboardData?.invites.sent ?? 0;
  const startedRate =
    invitesSentCount > 0
      ? Math.round(((dashboardData?.invites.used ?? 0) / invitesSentCount) * 100)
      : 0;

  useEffect(() => {
    closeAllViewers();
  }, [pathname]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const err = await refreshAuthCompany();
      if (active && err) setError(err);
    })();
    return () => {
      active = false;
    };
  }, [refreshAuthCompany]);

  useEffect(() => {
    setSessionPage(1);
    setSelectedSessionIds(new Set());
  }, [sessionSearch, sessionStatusFilter, sessionScoreMin, sessionScoreMax, sessionFrom, sessionTo]);

  useEffect(() => {
    setRequirementPage(1);
  }, [requirementSearch]);

  useEffect(() => {
    setCandidatePage(1);
  }, [candidateSearch]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const tasks: Array<Promise<string | null>> = [];
      if (activeSection === "dashboard" || activeSection === "overview") {
        tasks.push(refreshDashboard());
      }
      if (activeSection === "overview" || (activeSection === "requirements" && openingTab === "sessions")) {
        tasks.push(refreshSessions());
      }
      if (activeSection === "overview") {
        tasks.push(refreshOverviewRequirements());
      }
      if (activeSection === "requirements") {
        tasks.push(refreshRequirements());
      }
      if (activeSection === "candidates") {
        tasks.push(refreshCandidates());
      }
      if (activeSection === "support") {
        tasks.push(refreshSupportTickets());
      }
      if (activeSection === "settings" || activeSection === "profile" || activeSection === "app-settings") {
        tasks.push(refreshInterviewerSettings());
      }
      if (!tasks.length) return;
      const results = await Promise.all(tasks);
      if (!active) return;
      const firstError = results.find((message): message is string => Boolean(message));
      if (firstError) setError(firstError);
    })();
    return () => {
      active = false;
    };
  }, [
    activeSection,
    openingTab,
    refreshCandidates,
    refreshDashboard,
    refreshInterviewerSettings,
    refreshOverviewRequirements,
    refreshRequirements,
    refreshSessions,
    refreshSupportTickets,
  ]);

  useEffect(() => {
    if (activeSection !== "overview") return;
    let shouldFocus = draftScrollToken > 0;
    if (!shouldFocus) {
      try {
        shouldFocus = sessionStorage.getItem("uhired-admin-focus-draft") === "1";
        if (shouldFocus) sessionStorage.removeItem("uhired-admin-focus-draft");
      } catch {
        // ignore
      }
    }
    if (!shouldFocus) return;

    const frame = window.requestAnimationFrame(() => {
      draftSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => formRef.current?.querySelector("textarea")?.focus(), 400);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [draftScrollToken, activeSection]);

  useEffect(() => {
    if (!successMessage) return;
    notify.success(successMessage);
    const timer = window.setTimeout(() => setSuccessMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [successMessage, notify]);

  useEffect(() => {
    if (!error) return;
    notify.error(error);
  }, [error, notify]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications],
  );

  async function createObserverLink() {
    if (!detailSession?.id) return;
    setObserverLinkBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/session/${detailSession.id}/observer-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttlHours: 24 }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? "Unable to create observer link.");
        return;
      }
      setObserverLinkUrl(data.url);
      setSuccessMessage("Observer link created for hiring team.");
      await copyCode(data.url, "Observer link copied.");
      const observerRes = await fetch(`/api/admin/session/${detailSession.id}/observer-link`);
      const observerData = (await observerRes.json()) as { links?: ObserverLinkRow[] };
      if (observerRes.ok) setObserverLinks(observerData.links ?? []);
    } finally {
      setObserverLinkBusy(false);
    }
  }

  async function revokeObserverLink(linkId: string) {
    if (!detailSession?.id) return;
    const response = await fetch(
      `/api/admin/session/${detailSession.id}/observer-link/${linkId}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setError("Unable to revoke observer link.");
      return;
    }
    const observerRes = await fetch(`/api/admin/session/${detailSession.id}/observer-link`);
    const observerData = (await observerRes.json()) as { links?: ObserverLinkRow[] };
    if (observerRes.ok) setObserverLinks(observerData.links ?? []);
    setSuccessMessage("Observer link revoked.");
  }

  async function createScorecardShareLink() {
    if (!detailSession?.id || !detailSession.scorecard) return;
    setScorecardShareBusy(true);
    const response = await fetch(`/api/admin/session/${detailSession.id}/scorecard-share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ttlDays: scorecardShareTtlDays,
        includeCandidateName: scorecardShareIncludeName,
      }),
    });
    const data = (await response.json()) as {
      reused?: boolean;
      linkId?: string;
      shareUrl?: string;
      pdfUrl?: string;
      expiresAt?: string;
      message?: string;
      error?: string;
    };
    setScorecardShareBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Could not create share link.");
      return;
    }
    if (data.reused) {
      const stored = loadStoredScorecardShare(detailSession.id);
      if (stored && data.linkId && stored.linkId === data.linkId) {
        setLastCreatedShare({
          shareUrl: stored.shareUrl,
          pdfUrl: stored.pdfUrl,
          expiresAt: stored.expiresAt,
        });
        setSuccessMessage("Active share link renewed. Use the saved link below.");
      } else {
        setSuccessMessage(
          data.message ??
            "This session already has an active share link. Revoke it first if you need a new URL.",
        );
      }
    } else if (data.shareUrl && data.pdfUrl && data.expiresAt && data.linkId) {
      setLastCreatedShare({ shareUrl: data.shareUrl, pdfUrl: data.pdfUrl, expiresAt: data.expiresAt });
      saveStoredScorecardShare(detailSession.id, {
        linkId: data.linkId,
        shareUrl: data.shareUrl,
        pdfUrl: data.pdfUrl,
        expiresAt: data.expiresAt,
      });
      setSuccessMessage("Share link created. Copy the URL now — it is only shown once.");
    }
    setError("");
    const linksRes = await fetch(`/api/admin/session/${detailSession.id}/scorecard-share`);
    const linksData = (await linksRes.json()) as { links?: ScorecardShareLinkRow[] };
    if (linksRes.ok) setScorecardShareLinks(linksData.links ?? []);
  }

  async function revokeScorecardShareLink(linkId: string) {
    setScorecardShareBusy(true);
    const response = await fetch(`/api/admin/scorecard-share-link/${linkId}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    setScorecardShareBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Could not revoke link.");
      return;
    }
    setSuccessMessage("Share link revoked.");
    setError("");
    if (detailSession?.id) {
      window.localStorage.removeItem(`${SCORECARD_SHARE_STORAGE_PREFIX}${detailSession.id}`);
      setLastCreatedShare(null);
      const linksRes = await fetch(`/api/admin/session/${detailSession.id}/scorecard-share`);
      const linksData = (await linksRes.json()) as { links?: ScorecardShareLinkRow[] };
      if (linksRes.ok) setScorecardShareLinks(linksData.links ?? []);
    }
  }

  const editingCandidate = useMemo(
    () =>
      editor?.kind === "candidate"
        ? candidates.find((c) => c.candidateId === editor.recordId) ?? null
        : null,
    [editor, candidates],
  );
  const editingRequirement = useMemo(
    () =>
      editor?.kind === "requirement"
        ? requirements.find((r) => r.requirementId === editor.recordId) ?? null
        : null,
    [editor, requirements],
  );
  const navCounts = useMemo(
    () => ({
      overview: sessionStatusCounts.open,
      sessions: sessionStatusCounts.total,
      candidates: candidateMetrics.total,
      requirements: requirementsTotal,
    }),
    [sessionStatusCounts.open, sessionStatusCounts.total, candidateMetrics.total, requirementsTotal],
  );

  const sessionPageStart = sessionsTotal === 0 ? 0 : (sessionPage - 1) * SESSION_PAGE_SIZE + 1;
  const sessionPageEnd = Math.min(sessionPage * SESSION_PAGE_SIZE, sessionsTotal);
  const requirementPageStart =
    requirementsTotal === 0 ? 0 : (requirementPage - 1) * REQUIREMENT_PAGE_SIZE + 1;
  const requirementPageEnd = Math.min(requirementPage * REQUIREMENT_PAGE_SIZE, requirementsTotal);

  const previousRoleOptions = useMemo(() => {
    const query = targetRole.trim().toLowerCase();
    return overviewRequirements
      .map((requirement) => ({
        requirement,
        label: requirement.title?.trim() || requirement.domain,
      }))
      .filter((row) => !query || row.label.toLowerCase().includes(query));
  }, [overviewRequirements, targetRole]);

  const inviteGuideOpenings = overviewRequirements.length;
  const latestSavedOpening = overviewRequirements[0]
    ? overviewRequirements[0].title?.trim() || overviewRequirements[0].domain
    : null;
  const unusedInviteCount = overviewRequirements.reduce((count, requirement) => {
    return count + (requirement.candidateInvites ?? []).filter((invite) => !invite.usedAt).length;
  }, 0);

  const headerSubtitle =
    activeSection === "dashboard" ? (
      <>
        Track openings, invites, interviews, and candidate scores for{" "}
        <span className="font-medium text-foreground">{authCompanyName}</span>
      </>
    ) : activeSection === "overview" ? (
      <>Create a job opening, add candidate emails, and send invites</>
    ) : activeSection === "requirements" && openingTab === "sessions" ? (
      <>Review interviews linked to your saved job openings</>
    ) : activeSection === "candidates" ? (
      <>Track every candidate in your hiring pipeline</>
    ) : activeSection === "support" ? (
      <>Get help with invites, sessions, and scoring</>
    ) : activeSection === "requirements" ? (
      <>Reuse saved openings or open one to review related interviews</>
    ) : activeSection === "settings" ? (
      <>Choose the interviewer name and voice candidates will hear</>
    ) : (
      <>Signed in as {authCompanyName}</>
    );

  const supportsHeaderSearch = activeSection === "candidates" || activeSection === "requirements";
  const headerSearchPlaceholder =
    activeSection === "candidates"
      ? "Search candidates"
      : activeSection === "requirements" && openingTab === "sessions"
        ? "Search interviews by candidate, role, or code"
        : activeSection === "requirements"
          ? "Search job openings"
          : "Open Candidates or Job Openings to search";

  const isViewPage =
    detailSession !== null ||
    detailLoading ||
    candidateViewer !== null ||
    candidateViewerLoading ||
    requirementViewer !== null;
  const viewPageTitle = editor
    ? editor.kind === "requirement"
      ? "Edit Opening"
      : editor.kind === "session"
        ? "Edit Session"
        : "Edit Candidate"
    : detailSession || detailLoading
      ? "Session"
      : candidateViewer || candidateViewerLoading
        ? "Candidate"
        : requirementViewer
          ? "Opening"
          : null;

  return (
    <>
    <AppShell
      brandTitle="Uhired"
      brandSubtitle="Admin Portal"
      headerTitle={
        viewPageTitle ??
        (activeSection === "requirements" && openingTab === "sessions"
          ? "Opening Interviews"
          : sectionTitles[activeSection] ?? "Admin Portal")
      }
      headerSubtitle={editor ? "Update details" : viewPageTitle ? "View details" : headerSubtitle}
      primaryAction={{
        label: "Quick Invite",
        icon: PlusCircle,
        onClick: scrollToDraft,
      }}
      secondaryAction={{
        label: "Support",
        icon: Mail,
        href: "/admin/support",
      }}
      navGroups={[
        {
          items: workspaceNavItems.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
            href: adminNavHref(item.key),
            active:
              item.key === "requirements"
                ? activeSection === "requirements" && openingTab === "openings"
                : item.key === "sessions"
                  ? activeSection === "requirements" && openingTab === "sessions"
                  : activeSection === item.key,
            count: item.key in navCounts ? navCounts[item.key as keyof typeof navCounts] : undefined,
          })),
        },
        {
          label: "Setup",
          items: systemNavItems.map((item) => ({
            key: item.key,
            label: item.label,
            icon: item.icon,
            href: adminNavHref(item.key),
            active: activeSection === item.key,
          })),
        },
      ]}
      headerSearch={
          <label className="admin-header-search mx-auto">
            <Search className="h-4 w-4 shrink-0 opacity-70" />
            <input
              type="search"
              placeholder={headerSearchPlaceholder}
              disabled={!supportsHeaderSearch}
              value={
                activeSection === "candidates"
                  ? candidateSearch
                  : activeSection === "requirements"
                    ? openingTab === "sessions"
                      ? sessionSearch
                      : requirementSearch
                    : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (!supportsHeaderSearch) return;
                if (activeSection === "candidates") setCandidateSearch(v);
                else if (activeSection === "requirements" && openingTab === "sessions") setSessionSearch(v);
                else if (activeSection === "requirements") setRequirementSearch(v);
              }}
              onFocus={() => undefined}
              aria-label={headerSearchPlaceholder}
              className={!supportsHeaderSearch ? "cursor-not-allowed opacity-60" : undefined}
            />
            <kbd>⌘ K</kbd>
          </label>
      }
      headerActions={
          <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2" ref={headerMenuRef}>
            <div
              className="flex items-center rounded-lg border border-border bg-background p-0.5"
              role="group"
              aria-label="Theme"
            >
              <button
                type="button"
                onClick={() => applyTheme("light")}
                className={`rounded-md p-1.5 transition ${
                  theme === "light"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Light theme"
                aria-pressed={theme === "light"}
              >
                <Sun className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => applyTheme("dark")}
                className={`rounded-md p-1.5 transition ${
                  theme === "dark"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Dark theme"
                aria-pressed={theme === "dark"}
              >
                <Moon className="h-4 w-4" />
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((o) => {
                    const next = !o;
                    if (next) {
                      const unreadIds = notifications.filter((n) => n.unread).map((n) => n.id);
                      if (unreadIds.length) markNotificationsRead(unreadIds);
                    }
                    return next;
                  });
                  setProfileMenuOpen(false);
                }}
                className="text-muted-foreground hover:bg-muted hover:text-foreground relative rounded-lg p-2 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadNotificationCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadNotificationCount}
                  </span>
                ) : null}
              </button>
              {notificationsOpen ? (
                <div className="absolute right-0 z-[60] mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-bold text-foreground">Notifications</p>
                    <p className="text-[11px] text-muted-foreground">Live activity from your portal</p>
                  </div>
                  <ul className="max-h-72 overflow-y-auto">
                    {notifications.map((item) => (
                      <li key={item.id} className="border-b border-border/60 last:border-0">
                        <button
                          type="button"
                          onClick={() => handleNotificationClick(item)}
                          disabled={item.id === "empty"}
                          className={`w-full px-4 py-3 text-left transition hover:bg-surface/80 disabled:cursor-default disabled:hover:bg-transparent ${
                            item.unread ? "bg-primary/8" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">{item.title}</p>
                            <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{item.time}</span>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-border px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        goToOpening("sessions");
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-primary hover:bg-surface/80"
                    >
                      View all interviews →
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((o) => !o);
                  setNotificationsOpen(false);
                }}
                className="hover:bg-muted flex items-center gap-2 rounded-lg border border-border bg-background py-1 pl-1 pr-2 transition"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                  title={`${authCompanyName} company admin`}
                  aria-label={`${authCompanyName} company admin`}
                >
                  {authCompanyName.charAt(0).toUpperCase()}
                </div>
                <span className="max-w-[120px] truncate text-sm font-semibold text-foreground" title={authCompanyName}>
                  {authCompanyName}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              {profileMenuOpen ? (
                <div className="admin-card absolute right-0 z-[60] mt-2 w-56 overflow-hidden !rounded-xl !p-0 shadow-xl ring-1 ring-border">
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-bold text-foreground">{authCompanyName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{authAdminEmail || "Company admin"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setActiveSection("profile");
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-surface/60"
                  >
                    <UserCircle className="h-4 w-4 text-primary" />
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setActiveSection("app-settings");
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-surface/60"
                  >
                    <Palette className="h-4 w-4 text-violet" />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      applyTheme(theme === "dark" ? "light" : "dark");
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-surface/60"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4 text-slate-500" />
                    ) : (
                      <Moon className="h-4 w-4 text-slate-500" />
                    )}
                    {theme === "dark" ? "Light theme" : "Dark theme"}
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void handleLogout();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
      }
      sidebarFooter={
        <div className="px-1 pb-1">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
              {authCompanyName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{authCompanyName}</p>
              <p className="text-muted-foreground truncate text-xs">Company Admin</p>
            </div>
          </div>
        </div>
      }
      footer={
        <footer className="admin-footer mt-auto border-t py-4">
          <div className="text-muted-foreground mx-auto flex max-w-[100rem] flex-col items-center justify-between gap-3 px-4 text-xs sm:flex-row sm:px-6">
            <span>© 2026 UHIRED. All rights reserved.</span>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/privacy" className="hover:text-foreground">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-foreground">
                Terms of Service
              </a>
              <a href="#" className="hover:text-foreground font-medium">
                Security
              </a>
            </div>
          </div>
        </footer>
      }
    >
          {editor ? (
            <section className="admin-invites space-y-3">
              <div className="admin-card px-4 py-3">
                <button
                  type="button"
                  onClick={() => closeEditor()}
                  className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1.5 text-xs font-medium"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Back
                </button>
                <h2 className="text-lg font-semibold">
                  {editor.kind === "requirement"
                    ? "Edit Opening"
                    : editor.kind === "session"
                      ? "Edit Session"
                      : "Edit Candidate"}
                </h2>
              </div>

            {editor.kind === "session" ? (
              sessionEditLoading ? (
                <p className="text-muted-foreground py-8 text-center text-sm">Loading session details…</p>
              ) : sessionEditDetail ? (
                <form
                  className="admin-card space-y-3 p-3"
                  onSubmit={(e) => void saveSessionEdit(e, sessionEditDetail.id)}
                >
                  <p className="text-muted-foreground text-xs">
                    Status <span className="text-foreground font-medium">{sessionEditDetail.status}</span>
                    {" · "}
                    <code className="admin-code-badge admin-code-badge-sm">
                      {formatSessionInviteCode(sessionEditDetail)}
                    </code>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="admin-label">Candidate name</span>
                      <input
                        name="candidateName"
                        defaultValue={sessionEditDetail.candidateName ?? ""}
                        className="admin-input"
                      />
                    </label>
                    <label>
                      <span className="admin-label">Candidate email</span>
                      <input
                        name="candidateEmail"
                        type="email"
                        defaultValue={sessionEditDetail.candidateEmail ?? ""}
                        className="admin-input"
                      />
                    </label>
                  </div>
                  {sessionEditDetail.status === "COMPLETED" ? (
                    <p className="text-muted-foreground text-xs">
                      Completed session — only candidate name and email can be updated.
                    </p>
                  ) : (
                    <>
                      <label>
                        <span className="admin-label">Position / role</span>
                        <input
                          name="positionTitle"
                          defaultValue={sessionEditDetail.positionTitle ?? ""}
                          className="admin-input"
                          required
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label>
                          <span className="admin-label">Domain</span>
                          <input name="domain" defaultValue={sessionEditDetail.domain} className="admin-input" required />
                        </label>
                        <label>
                          <span className="admin-label">Topic</span>
                          <input name="topic" defaultValue={sessionEditDetail.topic} className="admin-input" required />
                        </label>
                        <label>
                          <span className="admin-label">Duration (min)</span>
                          <input
                            name="durationMin"
                            type="number"
                            min={5}
                            max={120}
                            defaultValue={sessionEditDetail.durationMin}
                            className="admin-input"
                            required
                          />
                        </label>
                        <label>
                          <span className="admin-label">Max optional Qs</span>
                          <input
                            name="maxOptionalQuestions"
                            type="number"
                            min={0}
                            max={20}
                            defaultValue={sessionEditDetail.maxOptionalQuestions}
                            className="admin-input"
                          />
                        </label>
                      </div>
                      <label>
                        <span className="admin-label">Job description</span>
                        <textarea
                          name="jobDescription"
                          rows={3}
                          defaultValue={sessionEditDetail.jobDescription ?? ""}
                          className="admin-input min-h-[5rem] resize-y"
                        />
                      </label>
                      <label>
                        <span className="admin-label">Key skills</span>
                        <input
                          name="keySkills"
                          defaultValue={formatSessionKeySkills(sessionEditDetail.keySkills)}
                          className="admin-input"
                        />
                      </label>
                      <label>
                        <span className="admin-label">Mandatory questions</span>
                        <textarea
                          name="mandatoryQuestions"
                          rows={3}
                          defaultValue={sessionMandatoryPrompts(sessionEditDetail)}
                          className="admin-input min-h-[5rem] resize-y"
                        />
                      </label>
                      <label>
                        <span className="admin-label">Optional questions</span>
                        <textarea
                          name="optionalQuestions"
                          rows={3}
                          defaultValue={sessionOptionalPrompts(sessionEditDetail)}
                          className="admin-input min-h-[5rem] resize-y"
                        />
                      </label>
                    </>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button type="submit" className="admin-btn-primary px-4 py-2 text-xs">Save</button>
                    <button type="button" onClick={() => closeEditor()} className="admin-btn-ghost px-4 py-2 text-xs">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-muted-foreground py-6 text-center text-sm">Unable to load session.</p>
              )
            ) : null}

            {editor.kind === "candidate" && editingCandidate ? (
              <form
                className="admin-card space-y-3 p-3"
                onSubmit={(e) => void saveCandidateEdit(e, editingCandidate.candidateId)}
              >
                <p className="text-muted-foreground text-xs">
                  Sessions {editingCandidate.sessionsCount} · Latest {editingCandidate.latestStatus}
                  {editingCandidate.latestScore != null ? ` · ${editingCandidate.latestScore}%` : ""}
                </p>
                <label>
                  <span className="admin-label">Candidate name</span>
                  <input
                    name="candidateName"
                    defaultValue={editingCandidate.candidateName ?? ""}
                    className="admin-input"
                    required
                  />
                </label>
                <label>
                  <span className="admin-label">Candidate email</span>
                  <input
                    name="candidateEmail"
                    type="email"
                    defaultValue={editingCandidate.candidateEmail ?? ""}
                    className="admin-input"
                  />
                </label>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="admin-btn-primary px-4 py-2 text-xs">Save</button>
                  <button type="button" onClick={() => closeEditor()} className="admin-btn-ghost px-4 py-2 text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {editor.kind === "requirement" && editingRequirement ? (
              <form
                className="admin-card space-y-3 p-3"
                onSubmit={(e) => void saveRequirementEdit(e, editingRequirement.requirementId)}
              >
                <p className="text-muted-foreground text-xs">
                  {editingRequirement.sessionsCount} session{editingRequirement.sessionsCount === 1 ? "" : "s"} ·{" "}
                  {editingRequirement.candidateInvites?.length ?? 0} invite
                  {(editingRequirement.candidateInvites?.length ?? 0) === 1 ? "" : "s"}
                </p>
                <label>
                  <span className="admin-label">Target role</span>
                  <input
                    name="title"
                    defaultValue={editingRequirement.title ?? ""}
                    placeholder="e.g. Product Designer"
                    className="admin-input"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="admin-label">Domain</span>
                    <input
                      name="domain"
                      defaultValue={editingRequirement.domain}
                      className="admin-input"
                      required
                    />
                  </label>
                  <label>
                    <span className="admin-label">Topic</span>
                    <input
                      name="topic"
                      defaultValue={editingRequirement.topic}
                      className="admin-input"
                      required
                    />
                  </label>
                  <label>
                    <span className="admin-label">Duration (min)</span>
                    <input
                      name="durationMin"
                      type="number"
                      min={5}
                      max={120}
                      defaultValue={editingRequirement.durationMin}
                      className="admin-input"
                      required
                    />
                  </label>
                  <label>
                    <span className="admin-label">Max optional Qs</span>
                    <input
                      name="maxOptionalQuestions"
                      type="number"
                      min={0}
                      max={20}
                      defaultValue={editingRequirement.maxOptionalQuestions}
                      className="admin-input"
                    />
                  </label>
                </div>
                <label>
                  <span className="admin-label">Job description</span>
                  <textarea
                    name="jobDescription"
                    defaultValue={editingRequirement.jobDescription ?? ""}
                    rows={3}
                    className="admin-input min-h-[5rem] resize-y"
                  />
                </label>
                <label>
                  <span className="admin-label">Key skills</span>
                  <input
                    name="keySkills"
                    defaultValue={
                      Array.isArray(editingRequirement.keySkills)
                        ? editingRequirement.keySkills.join(", ")
                        : ""
                    }
                    className="admin-input"
                  />
                </label>
                <label>
                  <span className="admin-label">Mandatory questions</span>
                  <textarea
                    name="mandatoryQuestions"
                    defaultValue={editingRequirement.mandatoryQuestions.join("\n")}
                    rows={4}
                    className="admin-input min-h-[6rem] resize-y"
                  />
                </label>
                <label>
                  <span className="admin-label">Optional questions</span>
                  <textarea
                    name="optionalQuestions"
                    defaultValue={editingRequirement.optionalQuestions.join("\n")}
                    rows={3}
                    className="admin-input min-h-[5rem] resize-y"
                  />
                </label>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="admin-btn-primary px-4 py-2 text-xs">Save</button>
                  <button type="button" onClick={() => closeEditor()} className="admin-btn-ghost px-4 py-2 text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            ) : editor.kind === "requirement" ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Unable to load opening.</p>
            ) : null}
            </section>
          ) : isViewPage ? (
            <>
              <AdminCandidateDetailModal
                open={candidateViewer !== null || candidateViewerLoading}
                loading={candidateViewerLoading}
                detail={candidateViewer}
                onClose={closeCandidateViewer}
                onEdit={(candidateId) => {
                  setCandidateViewer(null);
                  setEditor({ kind: "candidate", recordId: candidateId });
                }}
                onViewSession={(sessionId) => void openSessionDetail(sessionId)}
                onEditSession={(sessionId) => void openSessionEditor(sessionId)}
              />
              <AdminSessionDetailModal
                open={detailSession !== null || detailLoading}
                loading={detailLoading}
                session={detailSession}
                inviteCode={detailSession ? formatSessionInviteCode(detailSession) : ""}
                onClose={() => {
                  setDetailSession(null);
                  setDetailLoading(false);
                }}
                onEdit={(id) => void openSessionEditor(id)}
                regradeBusy={regradeBusy}
                onRunAnswerGrading={(id) => void runAnswerGrading(id)}
                observerLinkBusy={observerLinkBusy}
                onCreateObserverLink={() => void createObserverLink()}
                observerLinkUrl={observerLinkUrl}
                observerLinks={observerLinks}
                onRevokeObserverLink={(linkId) => void revokeObserverLink(linkId)}
                onCopy={(text, message) => void copyCode(text, message)}
                scorecardShareTtlDays={scorecardShareTtlDays}
                onScorecardShareTtlDaysChange={setScorecardShareTtlDays}
                scorecardShareIncludeName={scorecardShareIncludeName}
                onScorecardShareIncludeNameChange={setScorecardShareIncludeName}
                scorecardShareBusy={scorecardShareBusy}
                onCreateScorecardShareLink={() => void createScorecardShareLink()}
                scorecardShareLinks={scorecardShareLinks}
                lastCreatedShare={lastCreatedShare}
                onRevokeScorecardShareLink={(linkId) => void revokeScorecardShareLink(linkId)}
                holisticFormula={HOLISTIC_OVERALL_FORMULA}
                overallWithAnswerNote={OVERALL_WITH_ANSWER_GRADING_NOTE}
              />
              <AdminRequirementDetailModal
                open={requirementViewer !== null}
                requirement={requirementViewer}
                onClose={() => setRequirementViewer(null)}
                onOpenSession={(sessionId) => {
                  setRequirementViewer(null);
                  void openSessionDetail(sessionId);
                }}
                onCopyShareLink={(requirement) => void copyOpeningShareLink(requirement)}
                onScheduleInvite={(input) => scheduleOpeningInvite(input)}
                scheduleBusyEmail={scheduleBusyEmail}
              />
            </>
          ) : (
          <>
          {activeSection === "dashboard" ? (
            <AdminDashboard
              companyName={authCompanyName}
              data={dashboardData}
              loading={loadingDashboard}
              period={dashboardPeriod}
              onPeriodChange={setDashboardPeriod}
              onNavigate={navigateToSection}
              onOpenSession={(id) => void openSessionDetail(id)}
              formatSessionCode={formatSessionInviteCode}
              formatRelativeTime={formatRelativeTime}
            />
          ) : null}
          {activeSection === "candidates" ? (
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                {[
                  { label: "Candidates", value: candidateMetrics.total, hint: "In your pipeline", hot: candidateMetrics.total > 0 },
                  { label: "Completed", value: candidateMetrics.completedInterview, hint: "Finished interviews", hot: false },
                  { label: "Ready", value: candidateMetrics.readyNotStarted, hint: "Waiting to start", hot: candidateMetrics.readyNotStarted > 0 },
                  {
                    label: "Interviews",
                    value: candidateMetrics.totalSessions,
                    hint:
                      candidateMetrics.totalSessions > 0
                        ? `${candidateMetrics.avgSessionsPerCandidate} per candidate`
                        : "No interviews yet",
                    hot: false,
                  },
                ].map((stat) => (
                  <div key={stat.label} className={`admin-card admin-kpi ${stat.hot ? "admin-kpi-hot" : ""}`}>
                    <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <p className="text-foreground text-xl font-semibold tabular-nums tracking-tight">
                      {stat.value}
                    </p>
                    <p className={`text-[11px] ${stat.hot ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {stat.hint}
                    </p>
                  </div>
                ))}
              </div>

              <AdminCandidatesTable
                candidates={candidates}
                loading={loadingCandidates}
                search={candidateSearch}
                onSearchChange={setCandidateSearch}
                page={candidatePage}
                onPageChange={setCandidatePage}
                onView={(candidateId) => void openCandidateViewer(candidateId)}
                onEdit={(candidateId) => {
                  setRequirementViewer(null);
                  setDetailSession(null);
                  setCandidateViewer(null);
                  setEditor({ kind: "candidate", recordId: candidateId });
                }}
                onDelete={(candidate) => void deleteCandidateEntry(candidate)}
              />
            </section>
          ) : null}

          {activeSection === "settings" ? (
            <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
              <div className="admin-card glow-card space-y-3 p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[var(--shadow-glow)]"
                    style={{ background: "var(--gradient-brand)" }}
                    aria-hidden
                  >
                    <Video className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="admin-section-title font-display text-base">Interviewer voice</h3>
                    <p className="text-muted-foreground text-xs">
                      Set the interviewer name and voice used in every {authCompanyName} interview.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="admin-label">Interviewer name</span>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                      <input
                        value={interviewerSettings.interviewerName}
                        onChange={(event) =>
                          setInterviewerSettings((prev) => ({
                            ...prev,
                            interviewerName: event.target.value,
                          }))
                        }
                        placeholder="e.g. Alex, Emma"
                        className="admin-input pl-9"
                      />
                    </div>
                  </label>

                  <label className="block space-y-1">
                    <span className="admin-label">Voice</span>
                    <div className="relative">
                      <Mic
                        className="pointer-events-none absolute left-3 top-1/2 z-10 size-3.5 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                      <AppSelect
                        value={interviewerSettings.interviewerVoiceGender}
                        onValueChange={(value) =>
                          setInterviewerSettings((prev) => ({
                            ...prev,
                            interviewerVoiceGender: value as "MALE" | "FEMALE",
                          }))
                        }
                        className="!pl-9"
                        aria-label="Interviewer voice"
                        options={[
                          { value: "MALE", label: "Male voice" },
                          { value: "FEMALE", label: "Female voice" },
                        ]}
                      />
                    </div>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => void saveInterviewerSettings()}
                  disabled={savingInterviewerSettings}
                  className="admin-btn-primary h-9 px-4 text-xs disabled:opacity-60"
                >
                  {savingInterviewerSettings ? (
                    "Saving…"
                  ) : (
                    <>
                      <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
                      Save settings
                    </>
                  )}
                </button>
              </div>

              {(() => {
                const previewName = interviewerSettings.interviewerName.trim() || "Emma";
                const previewVoiceLabel =
                  interviewerSettings.interviewerVoiceGender === "FEMALE"
                    ? "Female voice"
                    : "Male voice";
                const previewAvatarLetter = previewName.charAt(0).toUpperCase();
                const previewGreeting = `Hello Drashti, it's great to meet you. I'm ${previewName} from ${authCompanyName}. To get us started, could you briefly introduce yourself...`;
                const waveformBars = [3, 5, 8, 6, 10, 7, 9, 5, 8, 6, 4, 7, 9, 5, 6, 8, 4, 7, 5, 3];

                return (
                  <div className="admin-hero relative overflow-hidden rounded-2xl p-4">
                    <p className="text-cyan text-[10px] font-bold uppercase tracking-[0.2em]">
                      Live preview
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground"
                        style={{ background: "var(--gradient-brand)" }}
                        aria-hidden
                      >
                        {previewAvatarLetter}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground">{previewName}</p>
                        <p className="text-muted-foreground text-xs">
                          <span className="text-cyan">•</span> {previewVoiceLabel} interviewer
                        </p>
                      </div>
                    </div>
                    <div className="bg-muted mt-3 rounded-xl p-3 ring-1 ring-border">
                      <p className="text-sm leading-relaxed text-foreground">{previewGreeting}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm"
                        aria-label="Play preview greeting"
                      >
                        <Play className="size-3.5 fill-slate-800 text-slate-800" aria-hidden />
                      </button>
                      <div className="flex h-7 min-w-0 flex-1 items-end gap-[3px]" aria-hidden>
                        {waveformBars.map((height, index) => (
                          <div
                            key={index}
                            className="bg-foreground/40 w-[3px] rounded-full"
                            style={{ height: `${height * 2.5}px` }}
                          />
                        ))}
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-400">0:04</span>
                    </div>
                  </div>
                );
              })()}
            </section>
          ) : null}

          {activeSection === "profile" ? (
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
              <div className="admin-card glow-card space-y-6 p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
                    style={{ background: "var(--gradient-brand)" }}
                    aria-hidden
                  >
                    {authCompanyName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                      Profile
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Update your company display name and login password (admin passcode).
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-surface/50 p-4 ring-1 ring-border">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                        <Mail className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Admin email
                        </p>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {authAdminEmail || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface/50 p-4 ring-1 ring-border">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet/12 text-violet ring-1 ring-violet/20">
                        <Globe className="h-4 w-4" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Domain
                        </p>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {authCompanyDomain || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <form className="space-y-5" onSubmit={(e) => void saveProfileSettings(e)}>
                  <label className="block space-y-2">
                    <span className="admin-label">Company name</span>
                    <input
                      value={profileForm.companyName}
                      onChange={(e) =>
                        setProfileForm((prev) => ({ ...prev, companyName: e.target.value }))
                      }
                      className="admin-input"
                      placeholder="Company name"
                      required
                    />
                  </label>

                  <div className="space-y-4 pt-1">
                    <div className="flex items-center gap-3">
                      <Lock className="h-4 w-4 shrink-0 text-violet" aria-hidden />
                      <span className="text-sm font-semibold text-foreground">Change password</span>
                      <div className="h-px flex-1 bg-border" aria-hidden />
                    </div>

                    <label className="block space-y-2">
                      <span className="admin-label">New password</span>
                      <input
                        type="password"
                        value={profileForm.newPasscode}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, newPasscode: e.target.value }))
                        }
                        className="admin-input"
                        placeholder="Min 4 characters"
                        autoComplete="new-password"
                      />
                      <div className="flex gap-1.5" aria-hidden>
                        {[1, 2, 3, 4].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              getPasswordStrengthScore(profileForm.newPasscode) >= level
                                ? "bg-primary"
                                : "bg-border"
                            }`}
                          />
                        ))}
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="admin-label">Confirm new password</span>
                      <input
                        type="password"
                        value={profileForm.confirmPasscode}
                        onChange={(e) =>
                          setProfileForm((prev) => ({ ...prev, confirmPasscode: e.target.value }))
                        }
                        className="admin-input"
                        placeholder="Repeat new password"
                        autoComplete="new-password"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="admin-btn-primary gap-2 px-5 py-2.5 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    {savingProfile ? "Saving…" : "Save profile"}
                  </button>
                </form>
              </div>

              <div className="flex flex-col gap-4">
                <div className="admin-hero relative overflow-hidden rounded-2xl p-5 sm:p-6">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    This passcode protects access to your entire Uhired account, including candidate
                    data and scoring.
                  </p>
                  <ul className="mt-5 space-y-3">
                    {[
                      "Use at least 8 characters mixing letters and numbers.",
                      "Avoid reusing passwords from other tools.",
                      "Changing your password signs out other active sessions.",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2.5">
                        <span className="bg-muted ring-border mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1">
                          <Check className="h-3 w-3 text-cyan" strokeWidth={3} aria-hidden />
                        </span>
                        <span className="text-sm leading-relaxed text-foreground">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="admin-card space-y-5 p-5 sm:p-6">
                  <h4 className="admin-section-title text-base">Account details</h4>
                  <ul className="space-y-4">
                    <li className="flex gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success ring-1 ring-success/25"
                        aria-hidden
                      >
                        <Clock className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Account created</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          {companyCreatedAt
                            ? `Active on Uhired since ${formatTenantSince(companyCreatedAt)}`
                            : "Active on Uhired"}
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning ring-1 ring-warning/25"
                        aria-hidden
                      >
                        <Building2 className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Company name is public</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          Shown to candidates in interview invites and greetings.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "app-settings" ? (
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
              <div className="admin-card glow-card space-y-6 p-6 sm:p-8">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-[var(--shadow-glow)]"
                    style={{ background: "var(--gradient-brand)" }}
                    aria-hidden
                  >
                    <Settings className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                      Settings
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      Appearance and account shortcuts for your admin portal.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="admin-label">Theme</p>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface/50 p-1.5 ring-1 ring-border">
                    <button
                      type="button"
                      onClick={() => applyTheme("light")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${
                        theme === "light"
                          ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                          : "text-muted-foreground hover:bg-surface/80 hover:text-foreground"
                      }`}
                      style={theme === "light" ? { background: "var(--gradient-brand)" } : undefined}
                    >
                      <Sun className="h-4 w-4" aria-hidden />
                      Light
                    </button>
                    <button
                      type="button"
                      onClick={() => applyTheme("dark")}
                      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${
                        theme === "dark"
                          ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                          : "text-muted-foreground hover:bg-surface/80 hover:text-foreground"
                      }`}
                      style={theme === "dark" ? { background: "var(--gradient-brand)" } : undefined}
                    >
                      <Moon className="h-4 w-4" aria-hidden />
                      Dark
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Theme preference is saved on this browser.</p>
                </div>

                <div className="space-y-4 border-t border-border pt-4">
                  <p className="admin-label">White-label branding</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="admin-label !mb-0">Display name</span>
                      <input
                        type="text"
                        value={brandSettings.brandDisplayName}
                        onChange={(e) =>
                          setBrandSettings((prev) => ({ ...prev, brandDisplayName: e.target.value }))
                        }
                        className="admin-input"
                        placeholder="Shown to candidates"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="admin-label !mb-0">Brand color</span>
                      <input
                        type="text"
                        value={brandSettings.brandPrimaryColor}
                        onChange={(e) =>
                          setBrandSettings((prev) => ({ ...prev, brandPrimaryColor: e.target.value }))
                        }
                        className="admin-input"
                        placeholder="#0055D4"
                      />
                    </label>
                    <label className="block space-y-2 sm:col-span-2">
                      <span className="admin-label !mb-0">Logo URL</span>
                      <input
                        type="url"
                        value={brandSettings.brandLogoUrl}
                        onChange={(e) =>
                          setBrandSettings((prev) => ({ ...prev, brandLogoUrl: e.target.value }))
                        }
                        className="admin-input"
                        placeholder="https://..."
                      />
                    </label>
                    <label className="block space-y-2 sm:col-span-2">
                      <span className="admin-label !mb-0">Default interview language</span>
                      <AppSelect
                        value={brandSettings.interviewLanguage}
                        onValueChange={(value) =>
                          setBrandSettings((prev) => ({ ...prev, interviewLanguage: value }))
                        }
                        aria-label="Default interview language"
                        options={INTERVIEW_LANGUAGES.map((lang) => ({
                          value: lang.code,
                          label: lang.label,
                        }))}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-4 border-t border-border pt-4">
                  <p className="admin-label">ATS webhook (Greenhouse / Lever / custom)</p>
                  <label className="block space-y-2">
                    <span className="admin-label !mb-0">Webhook URL</span>
                    <input
                      type="url"
                      value={brandSettings.atsWebhookUrl}
                      onChange={(e) =>
                        setBrandSettings((prev) => ({ ...prev, atsWebhookUrl: e.target.value }))
                      }
                      className="admin-input"
                      placeholder="https://your-ats.com/webhooks/uhired"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="admin-label !mb-0">Webhook secret (optional)</span>
                    <input
                      type="password"
                      value={brandSettings.atsWebhookSecret}
                      onChange={(e) =>
                        setBrandSettings((prev) => ({ ...prev, atsWebhookSecret: e.target.value }))
                      }
                      className="admin-input"
                      placeholder="Leave blank to keep existing"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingBrandSettings}
                    onClick={() => void saveBrandSettings()}
                    className="admin-btn-primary px-5 py-2.5 disabled:opacity-60"
                  >
                    {savingBrandSettings ? "Saving…" : "Save branding & ATS"}
                  </button>
                </div>

                {/* Phase 7b team UI — uncomment when PHASE_7B_ENABLED=true
                <div className="space-y-2 border-t border-border pt-4">
                  <AdminTeamPanel />
                </div>
                */}

                <div className="space-y-2 border-t border-border pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveSection("profile")}
                    className="flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-left transition hover:bg-surface/60"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet/12 text-violet ring-1 ring-violet/25"
                      aria-hidden
                    >
                      <UserCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">Edit profile &amp; password</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Update your company name and admin passcode.
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSection("support")}
                    className="flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-left transition hover:bg-surface/60"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/25"
                      aria-hidden
                    >
                      <HelpCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">Contact support</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Get help with invites, sessions, or scoring.
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </button>

                  <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-1">
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center gap-4 rounded-lg px-3 py-3.5 text-left transition hover:bg-destructive/10"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/12 text-destructive ring-1 ring-destructive/25"
                        aria-hidden
                      >
                        <LogOut className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-destructive">Logout</p>
                        <p className="mt-0.5 text-sm text-destructive/80">
                          End your current session on this device.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="admin-hero relative overflow-hidden rounded-2xl p-5 sm:p-6">
                  <span className="bg-muted text-muted-foreground ring-border inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ring-1">
                    Company account
                  </span>
                  <div className="mt-4 flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground"
                      style={{ background: "var(--gradient-brand)" }}
                      aria-hidden
                    >
                      {authCompanyName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground">{authCompanyName}</p>
                      <p className="text-muted-foreground truncate text-xs">{authAdminEmail || "—"}</p>
                    </div>
                  </div>
                  <dl className="mt-5 space-y-2.5">
                    {[
                      { label: "Interview sessions", value: sessionsTotal },
                      { label: "Candidates", value: candidateMetrics.total },
                      { label: "Job openings", value: requirementsTotal },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="font-semibold text-foreground">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-semibold text-foreground">Company Admin</span>
                  </div>
                </div>

                <div className="admin-card space-y-5 p-5 sm:p-6">
                  <h4 className="admin-section-title text-base">About these settings</h4>
                  <ul className="space-y-4">
                    <li className="flex gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/12 text-cyan ring-1 ring-cyan/25"
                        aria-hidden
                      >
                        <Clock className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Local to this browser</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          Theme preferences are stored on this device and do not sync across browsers.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning ring-1 ring-warning/25"
                        aria-hidden
                      >
                        <Lock className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Logging out is safe</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          Your data and interview sessions remain saved when you sign out.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "support" ? (
            <section className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Total tickets
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                      {supportTicketStats.total}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/20">
                    <HelpCircle className="h-5 w-5" aria-hidden />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      New
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                      {supportTicketStats.newCount}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/12 text-warning ring-1 ring-warning/25">
                    <Mail className="h-5 w-5" aria-hidden />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Open
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                      {supportTicketStats.openCount}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet/12 text-violet ring-1 ring-violet/25">
                    <MessageCircle className="h-5 w-5" aria-hidden />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Replied
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-foreground">
                      {supportTicketStats.repliedCount}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/12 text-success ring-1 ring-success/25">
                    <CheckCircle2 className="h-5 w-5" aria-hidden />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
                <div className="admin-card glow-card space-y-6 p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-primary shadow-[var(--shadow-glow)]"
                      style={{ background: "var(--gradient-brand)" }}
                      aria-hidden
                    >
                      <HelpCircle className="h-6 w-6 text-primary-foreground" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                        Contact support
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        Need help with invites, sessions, or scoring? Send a message and we&apos;ll get back
                        to you.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-surface/50 p-4 ring-1 ring-border">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet/12 text-violet ring-1 ring-violet/20">
                          <Building2 className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Company
                          </p>
                          <p className="truncate text-sm font-semibold text-foreground">{authCompanyName}</p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface/50 p-4 ring-1 ring-border">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
                          <Mail className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Admin email
                          </p>
                          <p className="truncate text-sm font-semibold text-foreground">
                            {authAdminEmail || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <form className="space-y-5" onSubmit={(e) => void submitSupport(e)}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="admin-label">Name</span>
                        <input
                          value={supportForm.name}
                          onChange={(e) => setSupportForm((p) => ({ ...p, name: e.target.value }))}
                          className="admin-input"
                          placeholder="Your name"
                          required
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="admin-label">Email</span>
                        <input
                          value={supportForm.email}
                          onChange={(e) => setSupportForm((p) => ({ ...p, email: e.target.value }))}
                          className="admin-input"
                          placeholder="you@company.com"
                          required
                        />
                      </label>
                    </div>
                    <label className="block space-y-2">
                      <span className="admin-label">Subject</span>
                      <input
                        value={supportForm.subject}
                        onChange={(e) => setSupportForm((p) => ({ ...p, subject: e.target.value }))}
                        className="admin-input"
                        placeholder="e.g. Invite emails not delivered"
                        required
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="admin-label">Message</span>
                      <textarea
                        value={supportForm.message}
                        onChange={(e) => setSupportForm((p) => ({ ...p, message: e.target.value }))}
                        className="admin-input min-h-[10rem] resize-y"
                        placeholder="Describe the issue. Include invite code or session code if possible."
                        required
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="submit"
                        disabled={supportSending}
                        className="admin-btn-primary gap-2 px-5 py-2.5 disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" aria-hidden />
                        {supportSending ? "Sending…" : "Send to support"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSection("dashboard")}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-surface"
                      >
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                        Back to dashboard
                      </button>
                    </div>
                  </form>

                  <div className="border-t border-border pt-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="admin-section-title text-base">Your support tickets</h4>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Track requests you&apos;ve sent from this portal.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshSupportTickets()}
                        disabled={loadingSupportTickets}
                        className="admin-btn-ghost text-xs disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`mr-1.5 inline h-3.5 w-3.5 ${loadingSupportTickets ? "animate-spin" : ""}`}
                          aria-hidden
                        />
                        {loadingSupportTickets ? "Refreshing…" : "Refresh"}
                      </button>
                    </div>
                    {supportTickets.length > 0 ? (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[12rem] flex-1">
                          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
                          <input
                            value={supportTicketSearch}
                            onChange={(event) => setSupportTicketSearch(event.target.value)}
                            placeholder="Search tickets"
                            className="border-input bg-background h-8 w-full rounded-md border pr-3 pl-8 text-sm outline-none"
                            aria-label="Search support tickets"
                          />
                        </div>
                        <AppSelect
                          value={supportTicketStatus}
                          onValueChange={(value) =>
                            setSupportTicketStatus(value as typeof supportTicketStatus)
                          }
                          size="sm"
                          className="w-[9.5rem]"
                          aria-label="Filter tickets by status"
                          options={[
                            { value: "ALL", label: "All status" },
                            { value: "NEW", label: "New" },
                            { value: "READ", label: "Read" },
                            { value: "REPLIED", label: "Replied" },
                            { value: "ARCHIVED", label: "Archived" },
                          ]}
                        />
                      </div>
                    ) : null}
                    {loadingSupportTickets && supportTickets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Loading tickets…</p>
                    ) : supportTickets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-8 text-center">
                        <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden />
                        <p className="mt-3 text-sm font-semibold text-foreground">No support tickets yet</p>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          Submit a message above and it will appear here.
                        </p>
                      </div>
                    ) : filteredSupportTickets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tickets match these filters.</p>
                    ) : (
                      <ul className="space-y-3">
                        {filteredSupportTickets.map((ticket) => {
                          const statusStyles: Record<SupportTicket["status"], string> = {
                            NEW: "bg-warning/12 text-warning ring-warning/25",
                            READ: "bg-primary/12 text-primary ring-primary/25",
                            REPLIED: "bg-success/12 text-success ring-success/25",
                            ARCHIVED: "bg-surface/80 text-muted-foreground ring-border",
                          };
                          return (
                            <li
                              key={ticket.id}
                              className="glow-card rounded-xl border border-border bg-surface/40 p-4 transition-colors hover:bg-surface/60"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <p className="text-sm font-bold text-foreground">{ticket.subject}</p>
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusStyles[ticket.status]}`}
                                >
                                  {ticket.status === "REPLIED" ? "Replied" : ticket.status.toLowerCase()}
                                </span>
                              </div>
                              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                {ticket.message.split("\n")[0]}
                              </p>
                              <p className="mt-2 text-[10px] font-semibold text-muted-foreground">
                                Submitted {formatRelativeTime(ticket.createdAt)}
                                {ticket.status === "REPLIED"
                                  ? ` · Updated ${formatRelativeTime(ticket.updatedAt)}`
                                  : ""}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="admin-hero relative overflow-hidden rounded-2xl p-5 sm:p-6">
                    <span className="bg-muted text-muted-foreground ring-border inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] ring-1">
                      Expected response
                    </span>
                    <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Within 24 hours</p>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      Our team reviews every ticket manually — priority given to invite delivery and scoring
                      issues.
                    </p>
                    <div className="mt-5 space-y-2">
                      <a
                        href="mailto:support@uhired.in"
                        className="hover:bg-muted flex items-center gap-3 rounded-xl bg-muted/60 p-3 ring-1 ring-border no-underline transition"
                      >
                        <div className="bg-background flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-border">
                          <Mail className="h-4 w-4 text-cyan" aria-hidden />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">Email support</p>
                          <p className="text-muted-foreground text-[11px]">support@uhired.in</p>
                        </div>
                      </a>
                      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 ring-1 ring-border">
                        <div className="bg-background flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-border">
                          <MessageCircle className="h-4 w-4 text-cyan" aria-hidden />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">Live chat</p>
                          <p className="text-muted-foreground text-[11px]">Mon–Fri, 9am–6pm IST</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="admin-card p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        aria-hidden
                      />
                      <div>
                        <p className="text-sm font-bold text-foreground">All systems operational</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          No incidents reported in the last 30 days
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="admin-card space-y-3 p-5 sm:p-6">
                    <h4 className="admin-section-title text-base">Common questions</h4>
                    <div className="space-y-3">
                      {[
                        {
                          id: "invite-email",
                          question: "Why didn't my invite email arrive?",
                          answer: `${SPAM_FOLDER_NOTE} Invites also expire — check the invite status in Job Openings and resend if needed.`,
                        },
                        {
                          id: "match-score",
                          question: "How is the match score calculated?",
                          answer: `${HOLISTIC_OVERALL_FORMULA}. ${OVERALL_WITH_ANSWER_GRADING_NOTE}`,
                        },
                      ].map((item) => {
                        const isOpen = supportFaqOpen === item.id;
                        return (
                          <div key={item.id} className="glow-card overflow-hidden rounded-xl border border-border">
                            <button
                              type="button"
                              onClick={() => setSupportFaqOpen(isOpen ? null : item.id)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface/50"
                              aria-expanded={isOpen}
                            >
                              <span className="text-sm font-semibold text-foreground">{item.question}</span>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                                aria-hidden
                              />
                            </button>
                            {isOpen ? (
                              <div className="border-t border-border px-4 pb-4 pt-3">
                                <p className="text-xs leading-relaxed text-muted-foreground">{item.answer}</p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "requirements" ? (
            <section className="space-y-3">
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Saved openings are reusable hiring templates.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use Invites when you want to send a new batch of candidate emails. Use this page to reuse, review,
                  and manage saved openings and their interviews.
                </p>
              </div>
              <div className="bg-muted/40 flex rounded-lg border p-0.5">
                {(
                  [
                    { key: "openings", label: "Saved openings", count: requirementsTotal },
                    { key: "sessions", label: "Interviews for openings", count: sessionStatusCounts.total },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setOpeningTab(tab.key)}
                    className={`inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium ${
                      openingTab === tab.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                    <span className="tabular-nums opacity-70">{tab.count}</span>
                  </button>
                ))}
              </div>

              {openingTab === "openings" ? (
                <>
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {[
                      { label: "Saved openings", value: requirementsTotal },
                      { label: "Invites used", value: requirementInviteStats.used },
                      { label: "Invites sent", value: requirementInviteStats.sent },
                      { label: "Expired", value: requirementInviteStats.expired },
                    ].map((stat) => (
                      <div key={stat.label} className="admin-card flex items-center justify-between gap-2 px-3 py-2">
                        <p className="text-muted-foreground text-xs">{stat.label}</p>
                        <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <AdminRequirementsTable
                    requirements={requirements}
                    loading={loadingRequirements}
                    search={requirementSearch}
                    onSearchChange={setRequirementSearch}
                    page={requirementPage}
                    totalPages={requirementsTotalPages}
                    pageStart={requirementPageStart}
                    pageEnd={requirementPageEnd}
                    totalItems={requirementsTotal}
                    onPageChange={setRequirementPage}
                    onView={(requirement) => {
                      setDetailSession(null);
                      setCandidateViewer(null);
                      setRequirementViewer(requirement);
                    }}
                    onEdit={(requirementId) => {
                      setRequirementViewer(null);
                      setDetailSession(null);
                      setCandidateViewer(null);
                      setEditor({ kind: "requirement", recordId: requirementId });
                    }}
                    onDelete={(requirementId) => void deleteRequirement(requirementId)}
                    onInvite={(requirement) => {
                      setActiveSection("overview");
                      applyRequirementToForm(requirement);
                    }}
                    onCopyCode={(code) => void copyCode(code, "Opening code copied.")}
                    onCopyShareLink={(requirement) => void copyOpeningShareLink(requirement)}
                    onOpenSessions={(requirement) => {
                      const role = requirement.title?.trim() || requirement.domain;
                      setSessionSearch(role);
                      setSessionStatusFilter("ALL");
                      setSessionRecordingFilter("all");
                      setSessionQuickView("all");
                      setSessionPage(1);
                      setOpeningTab("sessions");
                    }}
                  />
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                    {[
                      { label: "Sessions", value: sessionStatusCounts.total },
                      { label: "Completed", value: sessionStatusCounts.completed },
                      { label: "Ready", value: sessionStatusCounts.ready },
                      { label: "Live", value: sessionStatusCounts.live },
                    ].map((stat) => (
                      <div key={stat.label} className="admin-card flex items-center justify-between gap-2 px-3 py-2">
                        <p className="text-muted-foreground text-xs">{stat.label}</p>
                        <p className="text-sm font-semibold tabular-nums">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <AdminSessionsTable
                    sessions={displayedSessions}
                    loading={loadingSessions}
                    search={sessionSearch}
                    onSearchChange={(value) => {
                      setSessionSearch(value);
                      setSessionQuickView("all");
                    }}
                    status={sessionStatusFilter}
                    onStatusChange={(value) => {
                      setSessionStatusFilter(value);
                      if (value === "COMPLETED") setSessionQuickView("completed");
                      else if (value === "READY") setSessionQuickView("ready");
                      else setSessionQuickView("all");
                    }}
                    recording={sessionRecordingFilter}
                    onRecordingChange={(value) => {
                      setSessionRecordingFilter(value);
                      setSessionQuickView(value === "no_recording" ? "no_recording" : "all");
                    }}
                    scoreMin={sessionScoreMin}
                    scoreMax={sessionScoreMax}
                    onScoreMinChange={setSessionScoreMin}
                    onScoreMaxChange={setSessionScoreMax}
                    from={sessionFrom}
                    to={sessionTo}
                    onFromChange={setSessionFrom}
                    onToChange={setSessionTo}
                    onReset={resetSessionFilters}
                    selectedIds={selectedSessionIds}
                    onToggle={toggleSelectedSession}
                    onTogglePage={setAllVisibleSessionsSelected}
                    page={sessionPage}
                    totalPages={sessionsTotalPages}
                    pageStart={sessionPageStart}
                    pageEnd={sessionPageEnd}
                    totalItems={sessionsTotal}
                    onPageChange={setSessionPage}
                    onView={(sessionId) => void openSessionDetail(sessionId)}
                    onEdit={(sessionId) => void openSessionEditor(sessionId)}
                    onDelete={(sessionId) => void deleteSessionSubmission(sessionId)}
                    onExportSelected={() => void exportSelectedSessionsCsv()}
                    onExportAll={() => void exportAllFilteredSessionsCsv()}
                    onBulkDelete={() => void bulkDeleteSelectedSessions()}
                    exportBusy={bulkExportBusy}
                    deleteBusy={bulkDeleteBusy}
                    formatCode={formatSessionInviteCode}
                  />
                </>
              )}
            </section>
          ) : null}

          {activeSection === "overview" ? (
            <div className="admin-invites space-y-3">
          <div className="rounded-xl border border-primary/20 bg-primary/6 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Use this page when you are ready to invite candidates.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Start from scratch or load a saved opening, then send emails from here.
            </p>
          </div>
          <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            {[
              {
                label: "Active interviews",
                value: summary.open,
                hint: summary.open > 0 ? "Need attention" : "None waiting",
                icon: PlayCircle,
                hot: summary.open > 0,
                onClick: () => goToOpening("sessions"),
              },
              {
                label: "Completed",
                value: summary.completed,
                hint: "Completed interviews",
                icon: CheckCircle2,
                hot: false,
                onClick: () => goToOpening("sessions"),
              },
              {
                label: "Invites sent",
                value: invitesSentCount,
                hint: "Emails delivered to candidates",
                icon: Mail,
                hot: false,
                onClick: undefined,
              },
              {
                label: "Attended",
                value: `${startedRate}%`,
                hint:
                  invitesSentCount > 0
                    ? "joined the interview"
                    : "No invites sent yet",
                icon: Zap,
                hot: startedRate >= 40,
                onClick: () => goToOpening("sessions"),
              },
            ].map((stat) => {
              const Icon = stat.icon;
              const Tag = stat.onClick ? "button" : "div";
              return (
                <Tag
                  key={stat.label}
                  type={stat.onClick ? "button" : undefined}
                  onClick={stat.onClick}
                  className={`admin-card admin-kpi ${stat.hot ? "admin-kpi-hot" : ""} ${stat.onClick ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                      {stat.label}
                    </p>
                    <Icon className={`size-3.5 ${stat.hot ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <p className="text-foreground text-xl font-semibold tabular-nums tracking-tight">
                    {stat.value}
                  </p>
                  <p className={`text-[11px] ${stat.hot ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {stat.hint}
                  </p>
                </Tag>
              );
            })}
          </section>

          <section ref={draftSectionRef} className="grid items-start gap-3 lg:grid-cols-12">
            <form
              ref={formRef}
              id="admin-session-form"
              onSubmit={handleGenerate}
              className="lg:col-span-8"
            >
              <div className="admin-card p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                  <div>
                    <h3 className="admin-section-title">Interview opening</h3>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {selectedRequirementId
                        ? "Saved opening loaded — add candidate emails on the right"
                        : "Set role, JD, and interview settings"}
                    </p>
                  </div>
                  <span className="admin-badge shrink-0">
                    {selectedRequirementId ? "Saved opening" : "New opening"}
                  </span>
                </div>

                <div className="space-y-4">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="admin-overview-step-num">1</span>
                      <h4 className="admin-form-group-title text-sm">Company and role</h4>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="admin-label">Company</label>
                        <div className="admin-input-readonly">{authCompanyName}</div>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <label className="admin-label mb-0">
                            Target role <span className="text-red-500">*</span>
                          </label>
                          {selectedRequirementId ? (
                            <button
                              type="button"
                              onClick={clearSelectedRequirement}
                              className="text-primary text-[11px] font-medium"
                            >
                              New role
                            </button>
                          ) : null}
                        </div>
                        <div ref={roleFieldRef} className="relative">
                          <input
                            name="positionTitle"
                            value={targetRole}
                            onChange={(e) => {
                              const value = e.target.value;
                              setTargetRole(value);
                              setRoleMenuOpen(true);
                              if (selectedRequirementId) {
                                const selected = overviewRequirements.find(
                                  (row) => row.requirementId === selectedRequirementId,
                                );
                                const selectedLabel = selected?.title?.trim() || selected?.domain || "";
                                if (value.trim() !== selectedLabel) setSelectedRequirementId(null);
                              }
                            }}
                            onFocus={() => setRoleMenuOpen(true)}
                            placeholder="Type a role or pick a previous one"
                            className={`admin-input pr-9 ${targetRole.trim() ? "" : "admin-input-needed"}`}
                            autoComplete="off"
                            aria-expanded={roleMenuOpen}
                            aria-controls="previous-role-list"
                          />
                          <button
                            type="button"
                            className="text-muted-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
                            onClick={() => setRoleMenuOpen((open) => !open)}
                            aria-label="Show previous roles"
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${roleMenuOpen ? "rotate-180" : ""}`} />
                          </button>
                          {roleMenuOpen ? (
                            <div
                              id="previous-role-list"
                              className="border-border bg-card absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border shadow-md"
                            >
                              {loadingOverviewRequirements && overviewRequirements.length === 0 ? (
                                <p className="text-muted-foreground px-3 py-2 text-xs">Loading previous roles…</p>
                              ) : previousRoleOptions.length === 0 ? (
                                <p className="text-muted-foreground px-3 py-2 text-xs">
                                  {overviewRequirements.length === 0
                                    ? "No previous roles yet. Type a new one."
                                    : "No matching previous role."}
                                </p>
                              ) : (
                                previousRoleOptions.map(({ requirement, label }) => {
                                  const isSelected = selectedRequirementId === requirement.requirementId;
                                  const inviteCount = requirement.candidateInvites?.length ?? 0;
                                  return (
                                    <button
                                      key={requirement.requirementId}
                                      type="button"
                                      onClick={() => applyRequirementToForm(requirement)}
                                      className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-muted ${
                                        isSelected ? "bg-muted" : ""
                                      }`}
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate text-xs font-semibold">{label}</span>
                                        <span className="text-muted-foreground block text-[11px]">
                                          {requirement.durationMin}m · {inviteCount} invite
                                          {inviteCount === 1 ? "" : "s"}
                                        </span>
                                      </span>
                                      {isSelected ? <Check className="text-primary mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <span className="admin-overview-step-num">2</span>
                      <h4 className="admin-form-group-title text-sm">Job details</h4>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="admin-label">
                          Job description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="jobDescription"
                          rows={4}
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          placeholder="Paste the full job description here..."
                          className={`admin-input min-h-[5.5rem] resize-y ${jobDescription.trim() ? "" : "admin-input-needed"}`}
                        />
                      </div>

                      <div>
                        <label className="admin-label">
                          Key skills <span className="text-red-500">*</span>
                        </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {skills.map((skill) => (
                        <span key={skill} className="admin-skill-tag">
                          {skill}
                          <button
                            type="button"
                            onClick={() => removeSkill(skill)}
                            className="ml-0.5 rounded-full px-1 hover:bg-white/20"
                            aria-label={`Remove ${skill}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <span className="flex min-w-[14rem] flex-1 items-center gap-2">
                        <input
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addSkill();
                            }
                          }}
                          placeholder="Add skill"
                          className={`admin-input min-w-0 flex-1 ${
                            skills.length ? "" : "admin-input-needed"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={addSkill}
                          className="admin-btn-primary h-10 shrink-0 px-3 text-xs"
                        >
                          Add +
                        </button>
                      </span>
                    </div>
                    {debouncedTargetRole && pendingSuggestedSkills.length > 0 ? (
                      <div className="mt-2 rounded-lg border border-primary/20 bg-primary/8 p-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                            Suggested for {roleSkillSuggestions.roleLabel || debouncedTargetRole}
                          </p>
                          <button
                            type="button"
                            onClick={addAllSuggestedSkills}
                            className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground hover:opacity-90"
                          >
                            Add all
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {pendingSuggestedSkills.map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => addSuggestedSkill(skill)}
                              className="rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-semibold text-foreground hover:border-primary/30 hover:bg-surface"
                            >
                              + {skill}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {debouncedTargetRole && roleSkillSuggestions.skills.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Type a role title to see skill suggestions, or add skills manually.
                      </p>
                    ) : null}
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      <span className="admin-overview-step-num">3</span>
                      <h4 className="admin-form-group-title text-sm">Interview setup</h4>
                    </div>
                    <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="admin-label">Duration</label>
                    <div className="admin-duration-row">
                      {[5, 10, 30, 60].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDurationMin(m)}
                          className={`admin-duration-pill ${
                            durationMin === m
                              ? "text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                          style={
                            durationMin === m ? { background: "var(--gradient-brand)" } : undefined
                          }
                        >
                          {m}m
                        </button>
                      ))}
                      <input
                        id="customDurationMin"
                        type="number"
                        min={5}
                        max={120}
                        step={1}
                        value={durationMin}
                        onChange={(event) => updateDuration(event.target.value)}
                        className="admin-input admin-duration-custom"
                        aria-label="Custom duration in minutes"
                        title="Custom minutes (5–120)"
                      />
                    </div>
                    <input type="hidden" name="durationMin" value={durationMin} readOnly />
                  </div>

                  <div>
                    <label className="admin-label" htmlFor="requirementInterviewLanguage">
                      Language
                    </label>
                    <AppSelect
                      value={requirementInterviewLanguage}
                      onValueChange={setRequirementInterviewLanguage}
                      aria-label="Interview language"
                      options={INTERVIEW_LANGUAGES.map((lang) => ({
                        value: lang.code,
                        label: lang.label,
                      }))}
                    />
                  </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <label className="admin-label mb-0">Mandatory questions</label>
                      <button
                        type="button"
                        onClick={() => void handleGenerateQuestionsFromJd()}
                        disabled={generateQuestionsBusy || !isRequirementFormValid}
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {generateQuestionsBusy ? "Generating…" : "Generate from JD"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuestionsOpen((o) => !o)}
                      className="admin-question-toggle border-border bg-muted/40 hover:bg-muted flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-xs text-muted-foreground"
                    >
                      <PlusCircle className="h-4 w-4 shrink-0" />
                      {mandatoryQuestionsText.trim()
                        ? `${mandatoryQuestionsText.split("\n").filter((line) => line.trim()).length} question(s) — click to edit`
                        : "Add mandatory questions (max 5)"}
                    </button>
                    {questionsOpen ? (
                      <>
                        <textarea
                          name="questions"
                          rows={4}
                          placeholder="One question per line — technical and experience questions are asked before behavioral follow-ups"
                          className="admin-input mt-3"
                          value={mandatoryQuestionsText}
                          onChange={(event) => setMandatoryQuestionsText(event.target.value)}
                        />
                        <p className="text-muted-foreground mt-1.5 text-xs">
                          Leave blank to auto-generate from the JD when invites are sent.
                        </p>
                      </>
                    ) : null}
                  </div>

                  <div>
                    <div className="mb-2 flex min-h-7 items-center">
                      <label className="admin-label mb-0">Optional interview topics</label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOptionalQuestionsOpen((o) => !o)}
                      className="admin-question-toggle border-border bg-muted/40 hover:bg-muted flex w-full items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-left text-xs text-muted-foreground"
                    >
                      <PlusCircle className="h-4 w-4 shrink-0" />
                      Add optional questions
                    </button>
                    {optionalQuestionsOpen ? (
                      <>
                        <textarea
                          name="optionalQuestions"
                          rows={4}
                          placeholder="One optional question per line"
                          className="admin-input mt-3"
                          value={optionalQuestionsText}
                          onChange={(event) => setOptionalQuestionsText(event.target.value)}
                        />
                        <div className="mt-2">
                          <label htmlFor="maxOptionalQuestions" className="admin-label">
                            Max optional questions
                          </label>
                          <input
                            id="maxOptionalQuestions"
                            type="number"
                            min={0}
                            max={20}
                            step={1}
                            value={maxOptionalQuestions}
                            onChange={(event) => updateMaxOptionalQuestions(event.target.value)}
                            className="admin-input"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  </div>
                    </div>
                  </section>
                </div>
              </div>
            </form>

            <div ref={invitePanelRef} className="lg:col-span-4">
              <div
                className={`admin-card p-4 ${
                  isRequirementFormValid && parsedEmails.length === 0 ? "admin-card-attention" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-border pb-2.5">
                    <div>
                      <h3 className="admin-section-title">Candidate invites</h3>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Excel or emails. Codes expire in 24 hours and work once.
                      </p>
                    </div>
                    {canSendInvites ? (
                      <span className="admin-badge shrink-0">Ready to send</span>
                    ) : null}
                  </div>

                  <div className="bg-muted/80 grid grid-cols-2 gap-1 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setInviteMode("excel");
                        setInviteResults(null);
                        setInviteSummary(null);
                        setError("");
                        if (!excelFileName) setParsedEmails([]);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${
                        inviteMode === "excel"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Excel upload
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteMode("manual");
                        setInviteResults(null);
                        setInviteSummary(null);
                        setError("");
                        setParsedEmails(parseManualEmailInput(manualEmailText));
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold ${
                        inviteMode === "manual"
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      Manual emails
                    </button>
                  </div>

                  {inviteMode === "excel" ? (
                    <div className="mt-0 space-y-2">
                      <label className="border-border bg-background hover:bg-muted/60 flex min-h-[5.25rem] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-3 py-3.5 text-center transition-colors">
                        <Upload className="text-muted-foreground mb-1.5 h-4 w-4" />
                        <span className="text-xs font-semibold">
                          {excelFileName ?? "Upload Excel (.xlsx, .xls, .csv)"}
                        </span>
                        <span className="text-muted-foreground mt-0.5 text-[11px]">
                          Email column, up to {EXCEL_EMAIL_LIMIT} candidates
                        </span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={handleExcelFileChange}
                        />
                      </label>
                      {excelInvalidRows.length > 0 ? (
                        <p className="text-xs text-amber-700">
                          Skipped invalid rows: {excelInvalidRows.join(", ")}
                        </p>
                      ) : null}
                      {excelDuplicateRows.length > 0 ? (
                        <p className="text-xs text-amber-700">
                          Skipped duplicate emails (rows): {excelDuplicateRows.join(", ")}
                        </p>
                      ) : null}
                      {excelEmptyRows.length > 0 ? (
                        <p className="text-xs text-amber-700">
                          Skipped rows with missing email: {excelEmptyRows.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-0">
                      <label className="admin-label">
                        Emails (max {MANUAL_EMAIL_LIMIT})
                      </label>
                      <textarea
                        value={manualEmailText}
                        onChange={(event) => handleManualEmailChange(event.target.value)}
                        rows={3}
                        placeholder={"candidate1@company.com\ncandidate2@company.com"}
                        className="admin-input min-h-[5.5rem] resize-y"
                      />
                    </div>
                  )}

                  <div className="border-border bg-muted/30 rounded-lg border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        Parsed candidates ({parsedEmails.length})
                      </p>
                      <div className="flex items-center gap-2">
                        {parsedEmails.length > 0 && !verifyingEmails ? (
                          <button
                            type="button"
                            onClick={() => void downloadVerificationPdf()}
                            disabled={verificationPdfBusy || !emailVerifications.length}
                            className="inline-flex items-center gap-1 rounded-lg border border-success/40 px-2 py-1 text-[10px] font-semibold text-success hover:bg-success/10 disabled:opacity-40"
                          >
                            <FileDown className="h-3 w-3" />
                            {verificationPdfBusy ? "Preparing…" : "Download PDF"}
                          </button>
                        ) : null}
                        {parsedEmails.length > 0 ? (
                          <p className="text-[10px] font-semibold text-muted-foreground">
                            {verifyingEmails
                              ? "Verifying…"
                              : `${verifiedEmailCount} verified · ${invalidEmailCount} incorrect`}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {parsedEmails.length ? (
                      <ul className="mt-3 max-h-36 space-y-1 overflow-y-auto text-xs text-foreground">
                        {parsedEmails.map((email) => {
                          const verification = verificationByEmail.get(email);
                          const isValid = verification?.valid;
                          const isInvalid = verification && !verification.valid;
                          return (
                            <li
                              key={email}
                              className={`flex items-center justify-between gap-2 rounded px-2 py-1 ${
                                isInvalid
                                  ? "bg-destructive/10 text-destructive"
                                  : isValid
                                    ? "bg-success/10 text-success"
                                    : "bg-surface/60"
                              }`}
                            >
                              <span className="truncate">{email}</span>
                              <span className="shrink-0 text-[10px] font-semibold uppercase">
                                {verification
                                  ? verificationStatusLabel(verification.status)
                                  : verifyingEmails
                                    ? "…"
                                    : "Pending"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {inviteMode === "excel"
                          ? "Upload a sheet with an email column to preview candidates."
                          : "Add valid email addresses to preview candidates."}
                      </p>
                    )}
                    {invalidEmailCount > 0 && !verifyingEmails ? (
                      <p className="mt-3 text-xs text-red-700">
                        {invalidEmailCount} incorrect email(s) will be skipped automatically when you send invites.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2.5">
                  <div className="admin-ready-grid rounded-lg border border-border bg-muted/20 p-2.5">
                    {[
                      { done: Boolean(targetRole.trim()) || selectedRequirementId !== null, label: "Target role" },
                      { done: Boolean(jobDescription.trim()) || selectedRequirementId !== null, label: "Job description" },
                      { done: skills.length > 0 || selectedRequirementId !== null, label: "Key skill" },
                      { done: parsedEmails.length > 0, label: "Candidate email" },
                    ].map((step) => (
                      <div
                        key={step.label}
                        className={`admin-ready-step ${step.done ? "is-done text-foreground" : "text-muted-foreground"}`}
                      >
                        <span className="admin-ready-step-dot">
                          {step.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
                        </span>
                        {step.label}
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveRequirement()}
                      disabled={savingRequirement || inviteSending || !isRequirementFormValid || selectedRequirementId !== null}
                      className="admin-btn-ghost inline-flex h-10 w-full items-center justify-center gap-2 border border-border text-xs"
                    >
                      <Save className="h-4 w-4" />
                      {savingRequirement ? "Saving opening…" : "Save opening for later"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendInvites()}
                      disabled={inviteSending || savingRequirement || !canSendInvites}
                      className={`admin-btn-accent h-10 w-full text-xs ${canSendInvites ? "admin-cta-ready" : ""}`}
                    >
                      <Mail className="h-4 w-4" />
                      {inviteSending
                        ? `Sending… (${parsedEmails.length})`
                        : "Send candidate invites"}
                    </button>
                  </div>
                  <p className="text-center text-[11px] text-muted-foreground">
                    Saving keeps this opening for reuse. Sending invites emails candidates now.
                  </p>
                  </div>

                  {inviteSending ? (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      Large batches may take several minutes (~{Math.ceil((parsedEmails.length * 1.5) / 60)} min)
                    </p>
                  ) : null}

                  {inviteResults?.length ? (
                    <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
                      {inviteSummary ? (
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="rounded-lg bg-success/10 px-2 py-2 text-success">
                            <p className="text-lg font-black">{inviteSummary.sent}</p>
                            <p className="font-semibold">Sent</p>
                          </div>
                          <div className="rounded-lg bg-destructive/10 px-2 py-2 text-destructive">
                            <p className="text-lg font-black">{inviteSummary.invalid}</p>
                            <p className="font-semibold">Incorrect</p>
                          </div>
                          <div className="rounded-lg bg-amber-500/10 px-2 py-2 text-amber-600 dark:text-amber-400">
                            <p className="text-lg font-black">{inviteSummary.failed}</p>
                            <p className="font-semibold">Failed</p>
                          </div>
                        </div>
                      ) : null}

                      <p className="text-[11px] leading-relaxed text-muted-foreground">{SPAM_FOLDER_NOTE}</p>

                      <div className="max-h-56 space-y-2 overflow-y-auto">
                        {inviteResults.map((row) => (
                          <div
                            key={row.email}
                            className={`rounded px-3 py-2 text-xs ${
                              row.status === "sent"
                                ? "bg-success/10"
                                : row.status === "invalid_email"
                                  ? "bg-destructive/10"
                                  : row.status === "captured_dev"
                                    ? "bg-primary/10"
                                    : "bg-amber-500/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-foreground">{row.email}</p>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  row.status === "sent"
                                    ? "bg-success/20 text-success"
                                    : row.status === "invalid_email"
                                      ? "bg-destructive/20 text-destructive"
                                      : row.status === "captured_dev"
                                        ? "bg-primary/20 text-primary"
                                        : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {deliveryStatusLabel(row.status)}
                              </span>
                            </div>
                            {row.accessCode ? (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                  Interview code
                                </span>
                                <code className="admin-code-badge">{row.accessCode}</code>
                                <button
                                  type="button"
                                  onClick={() => void copyCode(row.accessCode!, "Invite code copied.")}
                                  className="rounded-md border border-border bg-surface/60 px-2 py-0.5 text-[10px] font-bold text-foreground transition hover:bg-surface"
                                >
                                  Copy
                                </button>
                              </div>
                            ) : null}
                            <p className="mt-1 text-muted-foreground">{row.deliveryMessage}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

            </div>
          </section>

          <section className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                applySessionQuickView("ready");
                goToOpening("sessions");
              }}
              className="admin-card admin-kpi cursor-pointer text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Waiting to start
                </p>
                <Clock className="size-3.5 text-amber-500" />
              </div>
              <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {sessionStatusCounts.ready}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {sessionStatusCounts.live > 0
                  ? `${sessionStatusCounts.live} live now`
                  : unusedInviteCount > sessionStatusCounts.ready
                    ? `${unusedInviteCount} unused invites`
                    : "Have a code, not started"}
              </p>
            </button>

            <button
              type="button"
              onClick={() => goToOpening("openings")}
              className="admin-card admin-kpi cursor-pointer text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Saved openings
                </p>
                <FileText className="size-3.5 text-violet-500" />
              </div>
              <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {inviteGuideOpenings}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {latestSavedOpening ? `Latest: ${latestSavedOpening}` : "Save an opening to reuse it"}
              </p>
            </button>

            <button
              type="button"
              onClick={() => goToOpening("openings")}
              className="admin-card admin-kpi cursor-pointer text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  After you send
                </p>
                <Mail className="size-3.5 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-foreground">Email + unique code</p>
              <p className="text-[11px] text-muted-foreground">
                Ask them to check Spam if missing
              </p>
            </button>
          </section>
            </div>
          ) : null}
          </>
          )}
    </AppShell>

    </>
  );
}

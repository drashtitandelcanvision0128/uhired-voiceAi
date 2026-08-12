"use client";

// Phase 7b — enable when PHASE_7B_ENABLED=true
// import { AdminTeamPanel } from "@/components/admin/admin-team-panel";
import { useAppFeedback } from "@/components/app-feedback";
import {
  LayoutDashboard,
  Video,
  Users,
  FileText,
  BarChart3,
  PlusCircle,
  HelpCircle,
  Settings,
  Bell,
  Compass,
  Zap,
  Link2,
  Bot,
  MoreVertical,
  Upload,
  Mail,
  FileSpreadsheet,
  FileDown,
  Download,
  Search,
  CheckCircle2,
  Trash2,
  Clock,
  Layers,
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
import { DASHBOARD_AUTO_REFRESH_MS, readStoredSiteTheme, SITE_THEME_KEY } from "@/lib/site-theme";
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
import { AdminPortalLogo } from "@/components/admin-portal-logo";
import { AdminDashboard, type DashboardData, type DashboardPeriod } from "@/components/admin-dashboard";
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

function formatRequirementRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return formatDateShort(iso);
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
      return { chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70", dot: "bg-emerald-500" };
    case "Sent":
      return { chip: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/70", dot: "bg-sky-500" };
    case "Expired":
      return { chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70", dot: "bg-amber-500" };
    default:
      return { chip: "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80", dot: "bg-slate-400" };
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

function getCandidateInitials(name: string | null, email?: string | null) {
  const source = (name?.trim() || email?.trim() || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function sessionMatchStyles(score: number) {
  if (score >= 70) return { bar: "bg-emerald-500", text: "text-emerald-600" };
  if (score >= 40) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-rose-500", text: "text-rose-600" };
}

const SESSION_QUICK_VIEWS = [
  { key: "all", label: "All Sessions" },
  { key: "completed", label: "Completed only" },
  { key: "ready", label: "Ready to review" },
  { key: "no_recording", label: "No recording" },
] as const;

type SessionQuickViewKey = (typeof SESSION_QUICK_VIEWS)[number]["key"];

const ROLE_AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
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
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (status === "READY") return "bg-amber-100 text-amber-800";
  if (status === "LIVE") return "bg-cyan-100 text-cyan-800";
  return "bg-slate-100 text-slate-700";
}

function candidateAvatarColor(name: string | null) {
  const key = (name ?? "?").toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return ROLE_AVATAR_COLORS[Math.abs(hash) % ROLE_AVATAR_COLORS.length];
}

function candidateStatusBadgeClass(status: string) {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (status === "READY") return "bg-amber-100 text-amber-800";
  if (status === "LIVE") return "bg-cyan-100 text-cyan-800";
  return "bg-slate-100 text-slate-700";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const workspaceNavItems = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "overview", label: "Overview", icon: Compass },
  { key: "sessions", label: "Interview Sessions", icon: Video },
  { key: "candidates", label: "Candidates", icon: Users },
  { key: "requirements", label: "Requirements", icon: FileText },
];

const systemNavItems = [
  { key: "settings", label: "AI Interviewer", icon: Bot },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "app-settings", label: "Settings", icon: Settings },
  { key: "support", label: "Support", icon: HelpCircle },
];

const sectionTitles: Record<string, string> = {
  dashboard: "Dashboard",
  overview: "Overview",
  sessions: "Interview Sessions",
  candidates: "Candidates",
  requirements: "Requirements",
  settings: "AI Interviewer",
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
  const { confirmDelete, confirmAction, notify } = useAppFeedback();
  const formRef = useRef<HTMLFormElement>(null);
  const draftSectionRef = useRef<HTMLElement>(null);
  const invitePanelRef = useRef<HTMLDivElement>(null);
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
  const [previousRequirementsExpanded, setPreviousRequirementsExpanded] = useState(false);
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
  const [activeSection, setActiveSection] = useState("dashboard");
  const [draftScrollToken, setDraftScrollToken] = useState(0);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("30d");
  const [candidates, setCandidates] = useState<CandidateView[]>([]);
  const [candidatePage, setCandidatePage] = useState(1);
  const [candidatesTotal, setCandidatesTotal] = useState(0);
  const [candidatesTotalPages, setCandidatesTotalPages] = useState(1);
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<"ALL" | "COMPLETED" | "READY">("ALL");
  const [candidateMetrics, setCandidateMetrics] = useState({
    total: 0,
    completedInterview: 0,
    readyNotStarted: 0,
    avgSessionsPerCandidate: 0,
  });
  const [requirements, setRequirements] = useState<RequirementView[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [loadingRequirements, setLoadingRequirements] = useState(false);
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
  const [manualRefreshBusy, setManualRefreshBusy] = useState(false);
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
  const [recentSessions, setRecentSessions] = useState<SessionView[]>([]);
  const SESSION_PAGE_SIZE = 10;
  const CANDIDATE_PAGE_SIZE = 10;
  const REQUIREMENT_PAGE_SIZE = 10;
  const PREVIOUS_REQUIREMENTS_PREVIEW = 4;
  const [successMessage, setSuccessMessage] = useState("");
  const [requirementViewer, setRequirementViewer] = useState<RequirementView | null>(null);
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
    const params = new URLSearchParams({
      page: String(sessionPage),
      pageSize: String(SESSION_PAGE_SIZE),
      status: sessionStatusFilter,
      search: sessionSearch.trim(),
      minScore: sessionScoreMin.trim(),
      maxScore: sessionScoreMax.trim(),
      from: sessionFrom.trim(),
      to: sessionTo.trim(),
      recentLimit: "6",
    });
    try {
      const listRes = await fetch(`/api/admin/sessions?${params}`, { cache: "no-store" });
      const data = (await listRes.json().catch(() => ({}))) as {
        sessions?: SessionView[];
        recentSessions?: SessionView[];
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
      setRecentSessions(data.recentSessions ?? []);
      return null;
    } catch {
      return "Unable to load sessions.";
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
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SITE_THEME_KEY, next);
    }
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

  async function manualRefreshAllData() {
    setManualRefreshBusy(true);
    setError("");
    setSuccessMessage("");
    try {
      const results = await Promise.all([
        refreshSessions(),
        refreshDashboard(dashboardPeriod),
        refreshCandidates(),
        refreshRequirements(),
        refreshAuthCompany(),
      ]);
      const firstError = results.find((message): message is string => Boolean(message));
      if (firstError) {
        setError(firstError);
        return;
      }
      setSuccessMessage("Data refreshed.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to refresh data right now.";
      setError(message);
    } finally {
      setManualRefreshBusy(false);
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
        page: String(candidatePage),
        pageSize: String(CANDIDATE_PAGE_SIZE),
        search: candidateSearch.trim(),
        status: candidateStatusFilter,
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
        };
        error?: string;
      };
      if (!response.ok) {
        return data.error ?? "Unable to load candidates.";
      }
      setCandidates(data.candidates ?? []);
      setCandidatesTotal(data.pagination?.total ?? 0);
      setCandidatesTotalPages(data.pagination?.totalPages ?? 1);
      if (data.metrics) setCandidateMetrics(data.metrics);
      return null;
    } catch {
      return "Unable to load candidates.";
    } finally {
      setLoadingCandidates(false);
    }
  }, [candidatePage, candidateSearch, candidateStatusFilter]);

  const refreshRequirements = useCallback(async (): Promise<string | null> => {
    setLoadingRequirements(true);
    const params = new URLSearchParams({
      page: String(requirementPage),
      pageSize: String(REQUIREMENT_PAGE_SIZE),
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
        return data.error ?? "Unable to load requirements.";
      }
      setRequirements(data.requirements ?? []);
      setRequirementsTotal(data.pagination?.total ?? 0);
      setRequirementsTotalPages(data.pagination?.totalPages ?? 1);
      setRequirementInviteStats(
        data.inviteStats ?? { used: 0, sent: 0, expired: 0 },
      );
      return null;
    } catch {
      return "Unable to load requirements.";
    } finally {
      setLoadingRequirements(false);
    }
  }, [requirementPage, requirementSearch]);

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
        return data.error ?? "Unable to load previous requirements.";
      }
      setOverviewRequirements(data.requirements ?? []);
      return null;
    } catch {
      return "Unable to load previous requirements.";
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
    setError("");
    setSuccessMessage(`Loaded "${requirement.title ?? requirement.domain}" — add emails and send invites.`);
    window.requestAnimationFrame(() => {
      invitePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  const roleSkillSuggestions = suggestKeySkillsForTargetRole(debouncedTargetRole);
  const pendingSuggestedSkills = roleSkillSuggestions.skills.filter((skill) => !skills.includes(skill));
  const verificationByEmail = useMemo(
    () => new Map(emailVerifications.map((row) => [row.email, row])),
    [emailVerifications],
  );
  const verifiedEmailCount = emailVerifications.filter((row) => row.valid).length;
  const invalidEmailCount = emailVerifications.filter((row) => !row.valid).length;

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
      setError(data.error ?? "Unable to save interview requirement.");
      return;
    }

    setSuccessMessage(
      data.accessCode
        ? `Interview requirement saved. You can invite candidates anytime from Requirements or send invites below.`
        : "Interview requirement saved.",
    );
    await refreshRequirements();
    await refreshDashboard();
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleSendInvites();
  }

  function scrollToDraft() {
    setActiveSection("overview");
    setDraftScrollToken((token) => token + 1);
  }

  function navigateToSection(section: string) {
    if (section === "overview") {
      scrollToDraft();
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
      setError(data.error ?? "Unable to save requirements.");
      return;
    }
    closeEditor();
    setSuccessMessage("Requirements updated.");
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
      title: "Delete requirement?",
      message:
        "This removes the requirement from active use. Existing submitted interview data will be preserved in Interview Sessions.",
      confirmLabel: "Delete requirement",
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
      setError(data.error ?? "Unable to delete requirement.");
      return;
    }
    setSuccessMessage("Requirement deleted from active list.");
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
        body: `${sessionStatusCounts.live} session${sessionStatusCounts.live === 1 ? "" : "s"} currently live.`,
        time: "Now",
        section: "sessions",
      });
    }
    if (sessionStatusCounts.ready > 0) {
      items.push({
        id: "ready",
        title: "Ready sessions",
        body: `${sessionStatusCounts.ready} session${sessionStatusCounts.ready === 1 ? "" : "s"} waiting for candidates.`,
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
        body: `${sessionStatusCounts.completed} completed session${sessionStatusCounts.completed === 1 ? "" : "s"} available for review.`,
        time: "Updated",
        section: "sessions",
      });
    }
    if (!items.length) {
      items.push({
        id: "empty",
        title: "You're all caught up",
        body: "No new alerts right now. New session activity will appear here.",
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
    if (item.section) {
      setActiveSection(item.section);
    }
  }

  const utilizationRate = dashboardData?.utilizationRate ?? 0;

  useEffect(() => {
    let active = true;
    void (async () => {
      const results = await Promise.all([
        refreshSessions(),
        refreshAuthCompany(),
        refreshDashboard(),
        refreshSupportTickets(),
      ]);
      if (!active) return;
      const firstError = results.find((message): message is string => Boolean(message));
      if (firstError) setError(firstError);
    })();
    return () => {
      active = false;
    };
  }, [refreshSessions, refreshAuthCompany, refreshDashboard, refreshSupportTickets]);

  useEffect(() => {
    if (activeSection === "support") {
      void refreshSupportTickets();
    }
  }, [activeSection, refreshSupportTickets]);

  useEffect(() => {
    setSessionPage(1);
    setSelectedSessionIds(new Set());
  }, [sessionSearch, sessionStatusFilter, sessionScoreMin, sessionScoreMax, sessionFrom, sessionTo]);

  useEffect(() => {
    setRequirementPage(1);
  }, [requirementSearch]);

  useEffect(() => {
    setCandidatePage(1);
  }, [candidateSearch, candidateStatusFilter]);

  useEffect(() => {
    if (activeSection !== "candidates") return;
    let active = true;
    void (async () => {
      const err = await refreshCandidates();
      if (active && err) setError(err);
    })();
    return () => {
      active = false;
    };
  }, [activeSection, refreshCandidates, candidatePage, candidateSearch, candidateStatusFilter]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const tasks: Array<Promise<string | null>> = [];
      if (activeSection === "dashboard") {
        tasks.push(refreshDashboard());
      }
      if (activeSection === "sessions" || activeSection === "overview") {
        tasks.push(refreshSessions());
      }
      if (activeSection === "overview") {
        tasks.push(refreshOverviewRequirements());
      }
      if (activeSection === "requirements") {
        tasks.push(refreshRequirements());
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
  }, [activeSection, refreshCandidates, refreshDashboard, refreshInterviewerSettings, refreshOverviewRequirements, refreshRequirements, refreshSessions]);

  useEffect(() => {
    if (activeSection !== "dashboard") return;
    let active = true;
    void (async () => {
      const errorMessage = await refreshDashboard(dashboardPeriod);
      if (!active || !errorMessage) return;
      setError(errorMessage);
    })();
    return () => {
      active = false;
    };
  }, [dashboardPeriod, activeSection, refreshDashboard]);

  useEffect(() => {
    if (activeSection !== "dashboard" && activeSection !== "overview") return;
    const interval = window.setInterval(() => {
      void refreshDashboard(dashboardPeriod);
      if (activeSection === "overview") {
        void refreshSessions();
      }
    }, DASHBOARD_AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [activeSection, dashboardPeriod, refreshDashboard, refreshSessions]);

  useEffect(() => {
    if (!draftScrollToken || activeSection !== "overview") return;

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
  const visibleCandidates = candidates;

  const navCounts = useMemo(
    () => ({
      sessions: sessionStatusCounts.total,
      candidates: candidateMetrics.total,
      requirements: requirementsTotal,
    }),
    [sessionStatusCounts.total, candidateMetrics.total, requirementsTotal],
  );

  const candidatePageStart =
    candidatesTotal === 0 ? 0 : (candidatePage - 1) * CANDIDATE_PAGE_SIZE + 1;
  const candidatePageEnd = Math.min(candidatePage * CANDIDATE_PAGE_SIZE, candidatesTotal);

  const sessionPageStart = sessionsTotal === 0 ? 0 : (sessionPage - 1) * SESSION_PAGE_SIZE + 1;
  const sessionPageEnd = Math.min(sessionPage * SESSION_PAGE_SIZE, sessionsTotal);
  const requirementPageStart =
    requirementsTotal === 0 ? 0 : (requirementPage - 1) * REQUIREMENT_PAGE_SIZE + 1;
  const requirementPageEnd = Math.min(requirementPage * REQUIREMENT_PAGE_SIZE, requirementsTotal);

  const visibleOverviewRequirements = useMemo(() => {
    if (previousRequirementsExpanded) return overviewRequirements;
    return overviewRequirements.slice(0, PREVIOUS_REQUIREMENTS_PREVIEW);
  }, [overviewRequirements, previousRequirementsExpanded]);

  const hiddenOverviewRequirementsCount = Math.max(
    0,
    overviewRequirements.length - PREVIOUS_REQUIREMENTS_PREVIEW,
  );

  return (
    <div className="admin-shell relative flex min-h-screen flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="admin-sidebar z-30 flex w-full flex-col overflow-y-auto border-b p-5 lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-[17rem] lg:border-b-0 lg:border-r">
        <div className="mb-6 px-1">
          <AdminPortalLogo subtitle="ADMIN PORTAL" />
        </div>

        <nav className="flex flex-1 flex-col gap-5">
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
            <div className="flex flex-col gap-0.5">
              {workspaceNavItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={`admin-nav-item flex items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold ${
                    activeSection === item.key
                      ? "admin-nav-item-active"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                  {item.key in navCounts ? (
                    <span className="admin-nav-count">
                      {navCounts[item.key as keyof typeof navCounts]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">System</p>
            <div className="flex flex-col gap-0.5">
              {systemNavItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveSection(item.key === "analytics" ? "dashboard" : item.key)}
                  className={`admin-nav-item flex items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold ${
                    activeSection === item.key
                      ? "admin-nav-item-active"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span className="flex-1">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <button
          type="button"
          onClick={scrollToDraft}
          className="admin-btn-primary mb-3 mt-4 w-full py-3"
        >
          <PlusCircle className="h-4 w-4" />
          Invite Candidates
        </button>

        <div className="mt-auto space-y-3 border-t border-white/10 pt-5">
          <button
            type="button"
            onClick={() => void manualRefreshAllData()}
            disabled={manualRefreshBusy}
            className="admin-btn-ghost mb-1 w-full py-2.5 disabled:opacity-50"
          >
            {manualRefreshBusy ? "Refreshing…" : "Load / Refresh Data"}
          </button>
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
              style={{ background: "var(--gradient-brand)" }}
              title={`${authCompanyName} company admin`}
            >
              {authCompanyName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{authCompanyName}</p>
              <p className="text-[11px] text-muted-foreground">Tenant Admin</p>
            </div>
          </div>
          <div className="admin-sidebar-promo">
            <p className="text-sm font-bold text-foreground">Upgrade your hiring</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Unlock more seats, advanced analytics, and priority support.
            </p>
            <a
              href="/pricing"
              className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-foreground ring-1 ring-white/15 transition hover:bg-white/15"
            >
              Explore Plans
            </a>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-[17rem]">
        <header className="admin-header sticky top-0 z-50 flex h-[4.25rem] items-center justify-between gap-4 border-b px-5 sm:px-8">
          <div className="min-w-0 shrink-0">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
              {sectionTitles[activeSection] ?? "Admin Portal"}
            </h1>
            <p className="truncate text-xs font-medium text-muted-foreground">
              {activeSection === "dashboard" ? (
                <>
                  Welcome back, <span className="font-semibold text-foreground">{authCompanyName}</span>
                  ! Here&apos;s your hiring pipeline overview.
                </>
              ) : activeSection === "overview" ? (
                <>
                  Signed in as <span className="font-semibold text-foreground">{authCompanyName}</span>
                  {" · set up your next interview session"}
                </>
              ) : activeSection === "sessions" ? (
                <>Search and manage all {sessionsTotal} interview sessions</>
              ) : activeSection === "candidates" ? (
                <>
                  Signed in as <span className="font-semibold text-foreground">{authCompanyName}</span>
                </>
              ) : activeSection === "requirements" ? (
                <>
                  Signed in as <span className="font-semibold text-foreground">{authCompanyName}</span>
                </>
              ) : activeSection === "support" ? (
                <>
                  Signed in as <span className="font-semibold text-foreground">{authCompanyName}</span>
                  {" · get help with invites, sessions, and scoring"}
                </>
              ) : activeSection === "profile" ? (
                <>
                  Signed in as <span className="font-semibold text-foreground">{authCompanyName}</span>
                  {" · manage your company profile and password"}
                </>
              ) : (
                <>
                  Signed in as <span className="font-semibold text-foreground">{authCompanyName}</span>
                </>
              )}
            </p>
          </div>

          <label className="admin-header-search mx-auto">
            <Search className="h-4 w-4 shrink-0 opacity-70" />
            <input
              type="search"
              placeholder="Search anything..."
              value={
                activeSection === "sessions"
                  ? sessionSearch
                  : activeSection === "candidates"
                    ? candidateSearch
                    : activeSection === "requirements"
                      ? requirementSearch
                      : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (activeSection === "sessions") setSessionSearch(v);
                else if (activeSection === "candidates") setCandidateSearch(v);
                else if (activeSection === "requirements") setRequirementSearch(v);
                else if (v.trim()) {
                  setSessionSearch(v);
                  setActiveSection("sessions");
                }
              }}
              onFocus={() => {
                if (
                  activeSection !== "sessions" &&
                  activeSection !== "candidates" &&
                  activeSection !== "requirements"
                ) {
                  /* keep current section until user types */
                }
              }}
              aria-label="Search"
            />
            <kbd>⌘ K</kbd>
          </label>

          <div className="relative flex shrink-0 items-center gap-2 sm:gap-3" ref={headerMenuRef}>
            <div
              className="flex items-center rounded-xl border border-border bg-surface/60 p-0.5 shadow-sm"
              role="group"
              aria-label="Theme"
            >
              <button
                type="button"
                onClick={() => applyTheme("light")}
                className={`rounded-lg p-2 transition ${
                  theme === "light"
                    ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
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
                className={`rounded-lg p-2 transition ${
                  theme === "dark"
                    ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
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
                className="relative rounded-xl p-2.5 text-muted-foreground ring-1 ring-border transition-colors hover:bg-surface/80 hover:text-foreground"
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
                        setActiveSection("sessions");
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-primary hover:bg-surface/80"
                    >
                      View interview sessions →
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
                className="flex items-center gap-2.5 rounded-full border border-border bg-surface/60 py-1 pl-1 pr-2.5 shadow-sm backdrop-blur-sm transition hover:bg-surface hover:ring-1 hover:ring-primary/20"
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
        </header>

        <div className="mx-auto w-full max-w-[88rem] flex-1 space-y-6 p-5 sm:p-8">
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
          {activeSection === "sessions" ? (
            <section className="space-y-4">
              <div className="admin-card p-4 md:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {SESSION_QUICK_VIEWS.map((view) => (
                      <button
                        key={view.key}
                        type="button"
                        onClick={() => applySessionQuickView(view.key)}
                        className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                          sessionQuickView === view.key
                            ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                            : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:bg-surface hover:text-foreground"
                        }`}
                        style={
                          sessionQuickView === view.key
                            ? { background: "var(--gradient-brand)" }
                            : undefined
                        }
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => saveCurrentSessionView()}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-primary ring-1 ring-primary/25 transition hover:bg-primary/10"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Save current view
                  </button>
                </div>

                {savedSessionViews.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {savedSessionViews.map((view) => (
                      <div
                        key={view.id}
                        className="flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80"
                      >
                        <button
                          type="button"
                          onClick={() => applySavedSessionView(view)}
                          className="hover:text-[#0f172a]"
                          title="Apply view"
                        >
                          {view.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSavedSessionView(view.id)}
                          className="ml-1 rounded-full px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          title="Remove"
                          aria-label="Remove saved view"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
                  <label className="block space-y-1">
                    <span className="admin-label">Search</span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={sessionSearch}
                        onChange={(e) => {
                          setSessionSearch(e.target.value);
                          setSessionQuickView("all");
                        }}
                        placeholder="Role, code, candidate..."
                        className="admin-input w-full pl-9"
                      />
                    </div>
                  </label>
                  <label className="block space-y-1">
                    <span className="admin-label">Status</span>
                    <select
                      value={sessionStatusFilter}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSessionStatusFilter(value);
                        if (value === "COMPLETED") setSessionQuickView("completed");
                        else if (value === "READY") setSessionQuickView("ready");
                        else if (value === "ALL" && sessionRecordingFilter === "all") setSessionQuickView("all");
                        else setSessionQuickView("all");
                      }}
                      className="admin-input w-full"
                    >
                      <option value="ALL">All</option>
                      <option value="READY">READY</option>
                      <option value="LIVE">LIVE</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="admin-label">Score (min–max)</span>
                    <div className="flex gap-2">
                      <input
                        value={sessionScoreMin}
                        onChange={(e) => setSessionScoreMin(e.target.value)}
                        inputMode="decimal"
                        placeholder="min"
                        className="admin-input w-full"
                      />
                      <input
                        value={sessionScoreMax}
                        onChange={(e) => setSessionScoreMax(e.target.value)}
                        inputMode="decimal"
                        placeholder="max"
                        className="admin-input w-full"
                      />
                    </div>
                  </label>
                  <label className="block space-y-1">
                    <span className="admin-label">From</span>
                    <input
                      type="date"
                      value={sessionFrom}
                      onChange={(e) => setSessionFrom(e.target.value)}
                      className="admin-input w-full"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="admin-label">To</span>
                    <input
                      type="date"
                      value={sessionTo}
                      onChange={(e) => setSessionTo(e.target.value)}
                      className="admin-input w-full"
                    />
                  </label>
                  <button type="button" onClick={resetSessionFilters} className="admin-btn-ghost px-4 py-2.5">
                    Reset
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={saveViewName}
                    onChange={(e) => setSaveViewName(e.target.value)}
                    placeholder="Name for saved view…"
                    className="admin-input w-full max-w-xs text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Selected: <span className="font-extrabold text-[#0f172a]">{selectedSessionIds.size}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => void exportSelectedSessionsCsv()}
                    disabled={selectedSessionIds.size === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-emerald-500/20 transition hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    Export selected CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => void bulkDeleteSelectedSessions()}
                    disabled={bulkDeleteBusy || selectedSessionIds.size === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    {bulkDeleteBusy ? "Deleting…" : "Delete selected"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void exportAllFilteredSessionsCsv()}
                    disabled={bulkExportBusy}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <FileDown className="h-4 w-4" />
                    {bulkExportBusy ? "Exporting…" : "Export all (filtered) CSV"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">Tip: Use filters to narrow down, then export all.</p>
              </div>

              <div className="grid gap-3">
                {displayedSessions.map((session) => {
                  const hasRecording = session.videoRecordingStatus === "AVAILABLE";
                  return (
                    <div
                      key={session.id}
                      className="admin-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={selectedSessionIds.has(session.id)}
                            onChange={() => toggleSelectedSession(session.id)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            aria-label="Select session"
                          />
                        </div>
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${roleAvatarColor(
                            session.positionTitle,
                            session.domain,
                          )}`}
                        >
                          {getRoleInitials(session.positionTitle, session.domain)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-[#0f172a]">
                            {session.positionTitle ?? session.domain}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span className="font-mono text-[11px] text-slate-600">
                              {formatSessionInviteCode(session)}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${sessionStatusBadgeClass(
                                session.status,
                              )}`}
                            >
                              {session.status}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span>{session.candidateName ?? "Awaiting candidate"}</span>
                            {session.interviewDurationDisplay ? (
                              <>
                                <span className="text-slate-300">·</span>
                                <span>{session.interviewDurationDisplay}</span>
                              </>
                            ) : null}
                          </p>
                          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
                            {hasRecording ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                <span className="text-emerald-700">Recording: Available</span>
                              </>
                            ) : (
                              <span className="text-slate-500">Recording: Not uploaded</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => void openSessionDetail(session.id)}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => void openSessionEditor(session.id)}
                          className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteSessionSubmission(session.id)}
                          className="rounded-lg border border-red-100 bg-red-50/80 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!displayedSessions.length ? (
                  <p className="admin-card p-5 text-sm text-slate-500">No sessions match this filter yet.</p>
                ) : null}
              </div>
              {sessionsTotal > 0 ? (
                <div className="admin-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Showing {sessionPageStart}–{sessionPageEnd} of {sessionsTotal} sessions
                    {sessionRecordingFilter === "no_recording" ? (
                      <span className="text-slate-400"> · {displayedSessions.length} without recording on this page</span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="mr-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          displayedSessions.length > 0 &&
                          displayedSessions.every((s) => selectedSessionIds.has(s.id))
                        }
                        onChange={(e) =>
                          setAllVisibleSessionsSelected(
                            e.currentTarget.checked,
                            displayedSessions.map((s) => s.id),
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        aria-label="Select all visible sessions"
                      />
                      <span className="text-xs font-semibold text-slate-600">Select page</span>
                    </div>
                    <button
                      type="button"
                      disabled={sessionPage <= 1}
                      onClick={() => setSessionPage((p) => Math.max(1, p - 1))}
                      className="admin-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-sm text-slate-600">
                      Page {sessionPage} of {sessionsTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={sessionPage >= sessionsTotalPages}
                      onClick={() => setSessionPage((p) => Math.min(sessionsTotalPages, p + 1))}
                      className="admin-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeSection === "candidates" ? (
            <section className="space-y-5">
              <div>
                <h3 className="admin-section-title">Candidates</h3>
                <p className="mt-1 text-sm text-slate-500">View and manage all candidate records</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Total candidates
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">
                      {candidateMetrics.total}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
                    <Users className="h-5 w-5 text-violet-600" />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Completed an interview
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">
                      {candidateMetrics.completedInterview}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Ready — not started
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">
                      {candidateMetrics.readyNotStarted}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Avg sessions / candidate
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">
                      {candidateMetrics.avgSessionsPerCandidate}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <Layers className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="admin-card p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      placeholder="Search by name, email, or status..."
                      className="admin-input w-full pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: "ALL", label: "All" },
                        { key: "COMPLETED", label: "Completed" },
                        { key: "READY", label: "Ready" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setCandidateStatusFilter(opt.key)}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                          candidateStatusFilter === opt.key
                            ? "bg-[#0f172a] text-white shadow-sm"
                            : "bg-white text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-50"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loadingCandidates ? (
                <p className="text-sm text-slate-500">Loading candidates…</p>
              ) : null}

              <div className="admin-card overflow-hidden">
                {(() => {
                  const completedRows = visibleCandidates.filter((c) => c.latestStatus === "COMPLETED");
                  const readyRows = visibleCandidates.filter((c) => c.latestStatus === "READY");
                  const otherRows = visibleCandidates.filter(
                    (c) => c.latestStatus !== "COMPLETED" && c.latestStatus !== "READY",
                  );

                  const renderRow = (candidate: CandidateView) => (
                    <div
                      key={candidate.key}
                      className="flex flex-col gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between md:px-6"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold ${candidateAvatarColor(
                            candidate.candidateName,
                          )}`}
                        >
                          {getCandidateInitials(candidate.candidateName)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-[#0f172a]">
                              {candidate.candidateName ?? "Unnamed candidate"}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                              {candidate.sessionsCount} session{candidate.sessionsCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {candidate.candidateEmail ?? "No email"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${candidateStatusBadgeClass(
                            candidate.latestStatus,
                          )}`}
                        >
                          {candidate.latestStatus}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void openCandidateViewer(candidate.candidateId)}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditor({ kind: "candidate", recordId: candidate.candidateId })}
                            className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCandidateEntry(candidate)}
                            className="rounded-lg border border-red-100 bg-red-50/80 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );

                  if (!visibleCandidates.length && !loadingCandidates) {
                    return (
                      <p className="p-6 text-sm text-slate-500">No candidates match this filter yet.</p>
                    );
                  }

                  if (candidateStatusFilter === "COMPLETED") {
                    return (
                      <div>
                        <p className="border-b border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 md:px-6">
                          Completed interviews
                        </p>
                        {completedRows.map(renderRow)}
                      </div>
                    );
                  }

                  if (candidateStatusFilter === "READY") {
                    return (
                      <div>
                        <p className="border-b border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 md:px-6">
                          Ready — not yet started
                        </p>
                        {readyRows.map(renderRow)}
                      </div>
                    );
                  }

                  return (
                    <div>
                      {completedRows.length > 0 ? (
                        <div>
                          <p className="border-b border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 md:px-6">
                            Completed interviews
                          </p>
                          {completedRows.map(renderRow)}
                        </div>
                      ) : null}
                      {readyRows.length > 0 ? (
                        <div>
                          <p className="border-b border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 md:px-6">
                            Ready — not yet started
                          </p>
                          {readyRows.map(renderRow)}
                        </div>
                      ) : null}
                      {otherRows.length > 0 ? (
                        <div>
                          <p className="border-b border-slate-100 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 md:px-6">
                            Other
                          </p>
                          {otherRows.map(renderRow)}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              {candidatesTotal > 0 ? (
                <div className="admin-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Showing {candidatePageStart}–{candidatePageEnd} of {candidatesTotal} candidates
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={candidatePage <= 1}
                      onClick={() => setCandidatePage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-sm text-slate-600">
                      Page {candidatePage} of {candidatesTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={candidatePage >= candidatesTotalPages}
                      onClick={() => setCandidatePage((p) => Math.min(candidatesTotalPages, p + 1))}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeSection === "settings" ? (
            <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
              <div className="admin-card glow-card space-y-6 p-6 sm:p-8">
                <div className="flex gap-4">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary-foreground shadow-[var(--shadow-glow)]"
                    style={{ background: "var(--gradient-brand)" }}
                    aria-hidden
                  >
                    <Video className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="admin-section-title font-display text-xl sm:text-2xl">AI Interviewer</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      Set how the voice interviewer introduces itself for all {authCompanyName} interviews.
                      Candidates hear this name in the opening greeting; voice matches Male or Female.
                    </p>
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="admin-label">Interviewer name</span>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
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
                      className="admin-input pl-10"
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="admin-label">Voice</span>
                  <div className="relative">
                    <Mic
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                    <select
                      value={interviewerSettings.interviewerVoiceGender}
                      onChange={(event) =>
                        setInterviewerSettings((prev) => ({
                          ...prev,
                          interviewerVoiceGender: event.target.value as "MALE" | "FEMALE",
                        }))
                      }
                      className="admin-input appearance-none pl-10 pr-10"
                    >
                      <option value="MALE">Male (Cedar)</option>
                      <option value="FEMALE">Female (Marin)</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden
                    />
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => void saveInterviewerSettings()}
                  disabled={savingInterviewerSettings}
                  className="admin-btn-primary w-full px-5 py-3 disabled:opacity-60"
                >
                  {savingInterviewerSettings ? (
                    "Saving…"
                  ) : (
                    <>
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                      Save interviewer settings
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col gap-6">
                {(() => {
                  const previewName =
                    interviewerSettings.interviewerName.trim() || "Emma";
                  const previewVoiceLabel =
                    interviewerSettings.interviewerVoiceGender === "FEMALE"
                      ? "Female (Marin)"
                      : "Male (Cedar)";
                  const previewAvatarLetter = previewName.charAt(0).toUpperCase();
                  const previewGreeting = `Hello Drashti, it's great to meet you. I'm ${previewName} from ${authCompanyName}. To get us started, could you briefly introduce yourself...`;
                  const waveformBars = [3, 5, 8, 6, 10, 7, 9, 5, 8, 6, 4, 7, 9, 5, 6, 8, 4, 7, 5, 3];

                  return (
                    <div
                      className="admin-hero relative overflow-hidden rounded-2xl p-5 sm:p-6"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">
                        Live preview
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground"
                          style={{ background: "var(--gradient-brand)" }}
                          aria-hidden
                        >
                          {previewAvatarLetter}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-white">{previewName}</p>
                          <p className="text-xs text-white/70">
                            <span className="text-cyan">•</span> {previewVoiceLabel} - AI Interviewer
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 rounded-xl bg-black/25 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                        <p className="text-sm leading-relaxed text-white/90">{previewGreeting}</p>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm transition hover:bg-slate-100"
                          aria-label="Play preview greeting"
                        >
                          <Play className="h-4 w-4 fill-slate-800 text-slate-800" aria-hidden />
                        </button>
                        <div className="flex min-w-0 flex-1 items-end gap-[3px] h-8" aria-hidden>
                          {waveformBars.map((height, index) => (
                            <div
                              key={index}
                              className="w-[3px] rounded-full bg-white/70"
                              style={{ height: `${height * 3}px` }}
                            />
                          ))}
                        </div>
                        <span className="shrink-0 text-xs font-medium text-slate-400">0:04</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="admin-card space-y-5 p-5 sm:p-6">
                  <h4 className="admin-section-title text-base">How this is used</h4>
                  <ul className="space-y-4">
                    <li className="flex gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan/12 text-cyan ring-1 ring-cyan/25"
                        aria-hidden
                      >
                        <Clock className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Applies to all sessions</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          Every new interview across your {requirementsTotal} requirements uses this
                          name and voice.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet/12 text-violet ring-1 ring-violet/25"
                        aria-hidden
                      >
                        <Layers className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Consistent candidate experience
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          Candidates hear the same greeting style across roles, keeping tone
                          predictable.
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning ring-1 ring-warning/25"
                        aria-hidden
                      >
                        <Zap className="h-4 w-4" strokeWidth={2.25} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Takes effect immediately</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          Sessions already in progress keep their original interviewer voice.
                        </p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
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
                  <p className="text-sm leading-relaxed text-white/85">
                    This passcode protects access to your entire Uhired tenant, including candidate
                    data and scoring.
                  </p>
                  <ul className="mt-5 space-y-3">
                    {[
                      "Use at least 8 characters mixing letters and numbers.",
                      "Avoid reusing passwords from other tools.",
                      "Changing your password signs out other active sessions.",
                    ].map((tip) => (
                      <li key={tip} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                          <Check className="h-3 w-3 text-cyan" strokeWidth={3} aria-hidden />
                        </span>
                        <span className="text-sm leading-relaxed text-white/90">{tip}</span>
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
                        <p className="text-sm font-semibold text-foreground">Tenant since</p>
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
                      <select
                        value={brandSettings.interviewLanguage}
                        onChange={(e) =>
                          setBrandSettings((prev) => ({ ...prev, interviewLanguage: e.target.value }))
                        }
                        className="admin-input"
                      >
                        {INTERVIEW_LANGUAGES.map((lang) => (
                          <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                      </select>
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
                  <span className="inline-block rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan ring-1 ring-white/20">
                    Tenant summary
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
                      <p className="font-bold text-white">{authCompanyName}</p>
                      <p className="truncate text-xs text-white/70">{authAdminEmail || "—"}</p>
                    </div>
                  </div>
                  <dl className="mt-5 space-y-2.5">
                    {[
                      { label: "Interview sessions", value: sessionsTotal },
                      { label: "Candidates", value: candidateMetrics.total },
                      { label: "Requirements", value: requirementsTotal },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                        <dt className="text-white/65">{row.label}</dt>
                        <dd className="font-semibold text-white">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4 text-sm">
                    <span className="text-white/65">Plan</span>
                    <span className="font-semibold text-white">Tenant Admin</span>
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
                    ) : (
                      <ul className="space-y-3">
                        {supportTickets.map((ticket) => {
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
                    <span className="inline-block rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cyan ring-1 ring-white/20">
                      Expected response
                    </span>
                    <p className="mt-4 text-2xl font-black tracking-tight text-white">Within 24 hours</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/80">
                      Our team reviews every ticket manually — priority given to invite delivery and scoring
                      issues.
                    </p>
                    <div className="mt-5 space-y-2">
                      <a
                        href="mailto:support@uhired.in"
                        className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10 transition hover:bg-white/10 no-underline"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                          <Mail className="h-4 w-4 text-cyan" aria-hidden />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Email support</p>
                          <p className="text-[11px] text-white/70">support@uhired.in</p>
                        </div>
                      </a>
                      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                          <MessageCircle className="h-4 w-4 text-cyan" aria-hidden />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Live chat</p>
                          <p className="text-[11px] text-white/70">Mon–Fri, 9am–6pm IST</p>
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
                          answer: `${SPAM_FOLDER_NOTE} Invites also expire — check the invite status in Requirements and resend if needed.`,
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
            <section className="space-y-5">
              <div>
                <h3 className="admin-section-title">Requirements</h3>
                <p className="mt-1 text-sm text-slate-500">Browse and manage interview requirements</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Total requirements
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">
                      {requirementsTotal}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
                    <FileText className="h-5 w-5 text-violet-600" />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Invites used
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">
                      {requirementInviteStats.used}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Invites sent
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">
                      {requirementInviteStats.sent}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div className="admin-card flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                      Expired invites
                    </p>
                    <p className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">
                      {requirementInviteStats.expired}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={requirementSearch}
                  onChange={(e) => setRequirementSearch(e.target.value)}
                  placeholder="Search by role, domain, or topic..."
                  className="admin-input w-full pl-9"
                />
              </div>

              <div className="grid gap-4">
                {loadingRequirements ? (
                  <p className="text-sm text-slate-500">Loading requirements...</p>
                ) : null}
                {requirements.map((requirement) => {
                  const roleTitle = requirement.title ?? requirement.domain;
                  return (
                    <div key={requirement.requirementId} className="admin-card p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-black ${roleAvatarColor(
                              requirement.title,
                              requirement.domain,
                            )}`}
                          >
                            {getRoleInitials(requirement.title, requirement.domain)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#1a3352]">
                              {roleTitle}
                              <span className="font-semibold text-slate-500"> · {requirement.durationMin} min</span>
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              Mandatory {requirement.mandatoryQuestions.length} · Optional{" "}
                              {requirement.optionalQuestions.length} (max {requirement.maxOptionalQuestions}) · Used
                              in {requirement.sessionsCount} submissions
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRequirementViewer(requirement)}
                            className="admin-btn-ghost"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditor({ kind: "requirement", recordId: requirement.requirementId })}
                            className="admin-btn-primary px-3 py-1.5 text-xs disabled:opacity-40"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteRequirement(requirement.requirementId)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {requirement.candidateInvites?.length ? (
                        <div className="mt-4 space-y-2">
                          {requirement.candidateInvites.map((invite) => {
                            const status = getInviteStatus(invite);
                            const styles = inviteStatusStyles(status);
                            return (
                              <div
                                key={`${invite.email}-${invite.accessCode}`}
                                className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50/90 px-4 py-3 ring-1 ring-slate-100"
                              >
                                <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
                                  {invite.email}
                                </span>
                                <code className="admin-code-badge admin-code-badge-sm shrink-0">
                                  {invite.accessCode}
                                </code>
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles.chip}`}
                                >
                                  {status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : requirement.requirementAccessCode ? (
                        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50/90 px-4 py-3 ring-1 ring-slate-100">
                          <span className="text-xs font-semibold text-slate-500">Legacy shared code:</span>
                          <code className="admin-code-badge admin-code-badge-sm">
                            {requirement.requirementAccessCode}
                          </code>
                        </div>
                      ) : (
                        <p className="mt-4 text-xs font-medium text-slate-500">No candidate invites yet</p>
                      )}
                    </div>
                  );
                })}
                {!loadingRequirements && !requirements.length ? (
                  <p className="admin-card p-5 text-sm text-slate-500">
                    No requirement snapshots found yet.
                  </p>
                ) : null}
              </div>
              {requirementsTotal > 0 ? (
                <div className="admin-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Showing {requirementPageStart}–{requirementPageEnd} of {requirementsTotal} requirements
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={requirementPage <= 1}
                      onClick={() => setRequirementPage((p) => Math.max(1, p - 1))}
                      className="admin-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="px-2 text-sm text-slate-600">
                      Page {requirementPage} of {requirementsTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={requirementPage >= requirementsTotalPages}
                      onClick={() => setRequirementPage((p) => Math.min(requirementsTotalPages, p + 1))}
                      className="admin-btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {activeSection === "overview" ? (
            <>
          {/* Welcome + utilization */}
          <section className="grid gap-5 md:grid-cols-3">
            <div className="admin-hero relative overflow-hidden rounded-2xl p-8 text-white md:col-span-2 md:p-10">
              <div className="relative z-10 max-w-lg">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Overview</p>
                <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight md:text-[2rem]">
                  Welcome back,
                  <br />
                  {authCompanyName} Admin.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
                  You have <span className="font-semibold text-white">{summary.open} open sessions</span>,{" "}
                  <span className="font-semibold text-white">{summary.completed} completed</span>. Ready to
                  generate some insight?
                </p>
              </div>
              <div className="pointer-events-none absolute -right-4 -top-6 flex h-52 w-52 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Compass className="h-28 w-28 text-white/15" strokeWidth={1} />
              </div>
            </div>
            <div className="admin-card glow-card flex flex-col justify-between p-6 md:p-7">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/12 text-success ring-1 ring-success/25">
                    <Zap className="h-4 w-4" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-success">Active now</p>
                </div>
                <p className="mt-3 text-4xl font-black tracking-tight text-foreground">{utilizationRate}%</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dashboardData?.invites.sent
                    ? "Invite conversion rate (used ÷ sent)"
                    : "Session completion rate"}
                </p>
              </div>
              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-surface/80 ring-1 ring-border">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-all duration-500"
                  style={{ width: `${utilizationRate}%` }}
                />
              </div>
            </div>
          </section>

          {/* Interview requirements + candidate invites */}
          {(loadingOverviewRequirements || overviewRequirements.length > 0) ? (
            <section className="admin-card glow-card p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Reuse setup
                  </p>
                  <h3 className="mt-1 text-sm font-bold text-foreground">Previous requirements</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Click a saved requirement to autofill — then add emails and send interview codes.
                  </p>
                </div>
                {selectedRequirementId ? (
                  <button
                    type="button"
                    onClick={clearSelectedRequirement}
                    className="admin-btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    New requirement
                  </button>
                ) : null}
              </div>

              {loadingOverviewRequirements && overviewRequirements.length === 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">Loading previous requirements…</p>
              ) : (
                <>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {visibleOverviewRequirements.map((requirement) => {
                      const isSelected = selectedRequirementId === requirement.requirementId;
                      const inviteCount = requirement.candidateInvites?.length ?? 0;
                      return (
                        <button
                          key={requirement.requirementId}
                          type="button"
                          onClick={() => applyRequirementToForm(requirement)}
                          className={`group rounded-xl border px-3 py-2.5 text-left transition-all ${
                            isSelected
                              ? "border-primary/40 bg-primary/10 ring-1 ring-primary/25 shadow-sm"
                              : "border-border bg-surface/40 hover:border-primary/25 hover:bg-surface/60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold leading-snug text-foreground line-clamp-2">
                              {requirement.title ?? requirement.domain}
                            </p>
                            {isSelected ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                            ) : null}
                          </div>
                          <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                            {requirement.durationMin} min · {formatRequirementRelativeDate(requirement.createdAt)}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground/80">
                            {inviteCount} invite{inviteCount === 1 ? "" : "s"} · {requirement.sessionsCount} interview
                            {requirement.sessionsCount === 1 ? "" : "s"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {hiddenOverviewRequirementsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setPreviousRequirementsExpanded((open) => !open)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-90"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${previousRequirementsExpanded ? "rotate-180" : ""}`}
                      />
                      {previousRequirementsExpanded
                        ? "Show less"
                        : `See more (${hiddenOverviewRequirementsCount} more)`}
                    </button>
                  ) : null}
                </>
              )}
            </section>
          ) : null}

          <section ref={draftSectionRef} className="grid gap-8 lg:grid-cols-12">
            <form
              ref={formRef}
              id="admin-session-form"
              onSubmit={handleGenerate}
              className="space-y-6 lg:col-span-8"
            >
              <div className="admin-card glow-card p-6 md:p-8">
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
                  <div>
                    <h3 className="admin-section-title">Interview Requirements</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedRequirementId
                        ? "Reusing a saved requirement — add emails on the right to send more invites"
                        : "Configure role details for the AI interview session"}
                    </p>
                  </div>
                  <span className="admin-badge shrink-0">
                    {selectedRequirementId ? "Reusing saved" : "Drafting Session"}
                  </span>
                </div>

                {selectedRequirementId ? (
                  <div className="mb-6 rounded-xl border border-success/25 bg-success/10 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-success">
                      Active requirement
                    </p>
                    <p className="mt-1 text-sm font-bold text-foreground">{targetRole}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Same questions and settings as before. Add candidate emails and send — each gets a unique interview
                      code by email.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-8">
                  <section className="space-y-4">
                    <div className="flex gap-3">
                      <span className="admin-overview-step-num">1</span>
                      <div>
                        <h4 className="admin-form-group-title">Organization Details</h4>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Company and role you are hiring for
                        </p>
                      </div>
                    </div>
                    <div className="admin-form-group space-y-5">
                      <div>
                        <label className="admin-label">Organization name</label>
                        <div className="admin-input-readonly">{authCompanyName}</div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          Fixed to your current company session. Switch company is disabled for security.
                        </p>
                      </div>
                      <div>
                        <label className="admin-label">
                          Target role <span className="text-red-500">*</span>
                        </label>
                        <input
                          name="positionTitle"
                          value={targetRole}
                          onChange={(e) => setTargetRole(e.target.value)}
                          placeholder="e.g. Senior Product Designer, HR Manager, Civil Engineer"
                          className="admin-input"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex gap-3">
                      <span className="admin-overview-step-num">2</span>
                      <div>
                        <h4 className="admin-form-group-title">Job Details</h4>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Description and skills the AI interviewer will assess
                        </p>
                      </div>
                    </div>
                    <div className="admin-form-group space-y-5">
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
                          className="admin-input min-h-[7rem] resize-y"
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
                      <span className="flex items-center gap-2">
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
                          className="w-36 rounded-full border border-border bg-surface/40 px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={addSkill}
                          className="rounded-lg px-3 py-1.5 text-xs font-bold text-primary-foreground transition hover:opacity-90"
                          style={{ background: "var(--gradient-brand)" }}
                        >
                          Add +
                        </button>
                      </span>
                    </div>
                    {debouncedTargetRole && pendingSuggestedSkills.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/8 p-3">
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

                  <section className="space-y-4">
                    <div className="flex gap-3">
                      <span className="admin-overview-step-num">3</span>
                      <div>
                        <h4 className="admin-form-group-title">Interview Configuration</h4>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          Duration and questions for the AI interview session
                        </p>
                      </div>
                    </div>
                    <div className="admin-form-group space-y-5">
                  <div>
                    <label className="admin-label">Interview duration</label>
                    <div className="flex gap-2">
                      {[5, 10, 30, 60].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDurationMin(m)}
                          className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all ${
                            durationMin === m
                              ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                              : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                          }`}
                          style={
                            durationMin === m ? { background: "var(--gradient-brand)" } : undefined
                          }
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                    <div className="mt-4">
                      <label htmlFor="customDurationMin" className="admin-label">
                        Custom duration (10-120 minutes)
                      </label>
                      <input
                        id="customDurationMin"
                        type="number"
                        min={5}
                        max={120}
                        step={1}
                        value={durationMin}
                        onChange={(event) => updateDuration(event.target.value)}
                        className="admin-input"
                      />
                    </div>
                    <input type="hidden" name="durationMin" value={durationMin} readOnly />
                  </div>

                  <div>
                    <label className="admin-label" htmlFor="requirementInterviewLanguage">
                      Interview language
                    </label>
                    <select
                      id="requirementInterviewLanguage"
                      value={requirementInterviewLanguage}
                      onChange={(e) => setRequirementInterviewLanguage(e.target.value)}
                      className="admin-input py-2 text-sm"
                    >
                      {INTERVIEW_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>{lang.label}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-muted-foreground">
                      AI interviewer will conduct the session in this language.
                    </p>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="admin-label mb-0">Mandatory questions</label>
                      <button
                        type="button"
                        onClick={() => void handleGenerateQuestionsFromJd()}
                        disabled={generateQuestionsBusy || !isRequirementFormValid}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {generateQuestionsBusy ? "Generating…" : "Generate from JD"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuestionsOpen((o) => !o)}
                      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-4 text-left text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-surface/60 hover:text-foreground"
                    >
                      <PlusCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                      {mandatoryQuestionsText.trim()
                        ? `${mandatoryQuestionsText.split("\n").filter((line) => line.trim()).length} mandatory question(s) defined — click to edit`
                        : "Click to define mandatory questions for the AI to ask (max 5), or use Generate from JD…"}
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
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          Leave blank to auto-generate role-specific technical questions from the job description and key
                          skills when invites are sent. Ideal answers for grading are generated automatically.
                        </p>
                      </>
                    ) : null}
                  </div>

                  <div>
                    <label className="admin-label">Optional interview topics</label>
                    <button
                      type="button"
                      onClick={() => setOptionalQuestionsOpen((o) => !o)}
                      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-surface/40 p-4 text-left text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-surface/60 hover:text-foreground"
                    >
                      <PlusCircle className="h-5 w-5 shrink-0 text-muted-foreground" />
                      Add optional questions for random selection during interview...
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
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          Ideal answers for optional questions are auto-generated for grading.
                        </p>
                        <div className="mt-4">
                          <label htmlFor="maxOptionalQuestions" className="admin-label">
                            Max optional questions to ask
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
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            Mandatory questions are always prioritized. Optional questions are randomly
                            selected for each interview.
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                    </div>
                  </section>
                </div>
              </div>
            </form>

            <div ref={invitePanelRef} className="space-y-5 lg:col-span-4">
              <div className="admin-card glow-card relative overflow-hidden p-6 md:p-7">
                <div>
                  <h3 className="admin-section-title text-xl">Candidate Invites</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {selectedRequirementId
                      ? "Add more candidates to this saved requirement. Each gets a unique code and interview link by email."
                      : "Upload an Excel sheet or add emails manually. Each candidate gets a unique code and interview link by email."}
                    Codes and links expire <strong className="text-foreground">24 hours</strong> after the invite is sent and each code can only be
                    used <strong className="text-foreground">once</strong>.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-surface/60 p-1 ring-1 ring-border">
                    <button
                      type="button"
                      onClick={() => {
                        setInviteMode("excel");
                        setInviteResults(null);
                        setInviteSummary(null);
                        setError("");
                        if (!excelFileName) setParsedEmails([]);
                      }}
                      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                        inviteMode === "excel"
                          ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
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
                      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                        inviteMode === "manual"
                          ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                      Manual emails
                    </button>
                  </div>

                  {inviteMode === "excel" ? (
                    <div className="mt-5 space-y-3">
                      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface/40 px-4 py-8 text-center transition hover:border-success/40 hover:bg-success/5">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-border">
                          <Upload className="h-5 w-5 text-success" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {excelFileName ?? "Upload Excel (.xlsx, .xls, .csv)"}
                        </span>
                        <span className="mt-1 text-xs text-muted-foreground">
                          Include an <strong className="text-foreground">email</strong> column with up to {EXCEL_EMAIL_LIMIT} candidates
                        </span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="hidden"
                          onChange={handleExcelFileChange}
                        />
                      </label>
                      <a
                        href="/sample-candidate-invites.xlsx"
                        download="sample-candidate-invites.xlsx"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-success underline-offset-2 hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download sample Excel (3 test emails)
                      </a>
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
                    <div className="mt-5">
                      <label className="admin-label">
                        Candidate emails (max {MANUAL_EMAIL_LIMIT})
                      </label>
                      <textarea
                        value={manualEmailText}
                        onChange={(event) => handleManualEmailChange(event.target.value)}
                        rows={6}
                        placeholder={"candidate1@company.com\ncandidate2@company.com"}
                        className="admin-input"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">One email per line, or separated by commas.</p>
                    </div>
                  )}

                  <div className="mt-5 rounded-xl border border-border bg-surface/40 p-4">
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
                      <p className="mt-3 text-xs text-muted-foreground">
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

                  {!canSendInvites && !inviteSending ? (
                    <p className="mt-4 text-xs text-muted-foreground">
                      {selectedRequirementId
                        ? "Add at least one valid email address to send invites."
                        : "Complete job description, target role, and at least one key skill before sending invites."}
                    </p>
                  ) : null}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveRequirement()}
                      disabled={savingRequirement || inviteSending || !isRequirementFormValid || selectedRequirementId !== null}
                      className="admin-btn-ghost w-full border border-border"
                    >
                      <Save className="h-5 w-5" />
                      {savingRequirement ? "Saving requirement…" : "Save Requirement"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSendInvites()}
                      disabled={inviteSending || savingRequirement || !canSendInvites}
                      className="admin-btn-accent w-full"
                    >
                      <Mail className="h-5 w-5" />
                      {inviteSending
                        ? `Sending invites… (${parsedEmails.length} emails)`
                        : "Send Interview Invites"}
                    </button>
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

              <div className="admin-hero relative overflow-hidden rounded-2xl p-6 text-white">
                <div className="relative z-10">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                      <Bot className="h-4 w-4 text-emerald-300" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/90">
                      AI Status
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-slate-200">
                    {authCompanyName} is ready to analyze your inputs and curate a personalized session flow.
                  </p>
                  <div className="mt-5 flex items-center gap-3 border-t border-white/10 pt-4">
                    <div className="flex -space-x-2">
                      <div className="h-7 w-7 rounded-full border-2 border-[#0f172a] bg-blue-400" />
                      <div className="h-7 w-7 rounded-full border-2 border-[#0f172a] bg-rose-400" />
                      <div className="h-7 w-7 rounded-full border-2 border-[#0f172a] bg-amber-400" />
                    </div>
                    <span className="text-xs text-slate-400">Used by 4 teams today</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Recent sessions */}
          <section className="space-y-5">
            <div className="flex items-end justify-between gap-4 px-1">
              <div>
                <h3 className="admin-section-title">Recent Sessions</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live and historic tracking of architectural interviews.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection("sessions")}
                className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary transition hover:opacity-90"
              >
                View All History →
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {recentSessions.map((session) => {
                const isLive = session.status === "LIVE";
                const isDone = session.status === "COMPLETED";
                const isReady = session.status === "READY";
                const match = session.scorecard?.overallScore;
                const matchStyle = match != null ? sessionMatchStyles(match) : null;
                return (
                  <article
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void openSessionDetail(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void openSessionDetail(session.id);
                      }
                    }}
                    className="admin-card glow-card group flex cursor-pointer p-5 transition hover:shadow-[var(--shadow-glow)] md:p-6"
                  >
                    <div className="flex flex-1 gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary ring-1 ring-primary/25">
                        {getCandidateInitials(session.candidateName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground">
                          {session.candidateName ?? "Awaiting candidate"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {session.positionTitle ?? session.domain} · {formatSessionInviteCode(session)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {isLive ? (
                            <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-cyan-600 dark:text-cyan-300">
                              Live
                            </span>
                          ) : isDone ? (
                            <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-success">
                              Completed
                            </span>
                          ) : isReady ? (
                            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">
                              Ready
                            </span>
                          ) : (
                            <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                              {session.status}
                            </span>
                          )}
                          {isDone && match != null && matchStyle ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface/80 ring-1 ring-border">
                                <div
                                  className={`h-full rounded-full ${matchStyle.bar}`}
                                  style={{ width: `${Math.min(100, match)}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-black ${matchStyle.text}`}>
                                {match}% Match
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <MoreVertical className="h-5 w-5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
                  </article>
                );
              })}
            </div>
            {!recentSessions.length ? (
              <p className="px-1 text-sm text-muted-foreground">
                Load data to see sessions. Generate a code to create the first one.
              </p>
            ) : null}
          </section>
            </>
          ) : null}
        </div>

        <footer className="admin-footer mt-auto border-t py-8">
          <div className="mx-auto flex max-w-[76rem] flex-col items-center justify-between gap-4 px-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 md:flex-row">
            <span>© 2026 UHIRED. All rights reserved.</span>
            <div className="flex flex-wrap justify-center gap-6">
              <a href="/privacy" className="transition-colors hover:text-[#0f172a]">
                Privacy Policy
              </a>
              <a href="/terms" className="transition-colors hover:text-[#0f172a]">
                Terms of Service
              </a>
              <a href="#" className="font-bold text-[#0f172a] hover:underline">Security</a>
            </div>
          </div>
        </footer>
      </div>

      {editor ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => closeEditor()}
        >
          <div
            className={`admin-card w-full shadow-2xl ${
              editor.kind === "requirement"
                ? "flex max-h-[85vh] max-w-xl flex-col overflow-hidden"
                : editor.kind === "session"
                  ? "max-h-[78vh] max-w-xl overflow-y-auto p-4 sm:p-5"
                  : editor.kind === "candidate"
                    ? "max-h-[60vh] max-w-md overflow-y-auto p-4 sm:p-5"
                    : "max-h-[60vh] max-w-md overflow-y-auto p-4 sm:p-5"
            }`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {editor.kind === "requirement" ? (
              <div className="shrink-0 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-sm sm:px-6">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-lg font-extrabold text-[#1a3352]">Edit Requirement</h4>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-base font-extrabold text-[#1a3352]">
                  {editor.kind === "session"
                    ? "Edit Session"
                    : editor.kind === "candidate"
                      ? "Edit Candidate"
                      : "Edit Requirements"}
                </h4>
                <button type="button" onClick={() => closeEditor()} className="admin-btn-ghost px-2 py-1 text-xs">
                  Close
                </button>
              </div>
            )}

            {editor.kind === "session" ? (
              sessionEditLoading ? (
                <p className="py-8 text-center text-sm text-slate-500">Loading session details…</p>
              ) : sessionEditDetail ? (
                <form
                  className="space-y-3"
                  onSubmit={(e) => void saveSessionEdit(e, sessionEditDetail.id)}
                >
                  <div className="admin-code-panel">
                    <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                      <p>
                        <span className="text-slate-500">Status:</span>{" "}
                        <span className="font-bold text-[#1a3352]">{sessionEditDetail.status}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500">Code:</span>
                        <code className="admin-code-badge admin-code-badge-sm">
                          {formatSessionInviteCode(sessionEditDetail)}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="block space-y-1">
                      <span className="admin-label mb-1">Candidate name</span>
                      <input
                        name="candidateName"
                        defaultValue={sessionEditDetail.candidateName ?? ""}
                        placeholder="Candidate name"
                        className="admin-input py-2"
                      />
                    </label>
                    <label className="block space-y-1">
                      <span className="admin-label mb-1">Candidate email</span>
                      <input
                        name="candidateEmail"
                        type="email"
                        defaultValue={sessionEditDetail.candidateEmail ?? ""}
                        placeholder="candidate@company.com"
                        className="admin-input py-2"
                      />
                    </label>
                  </div>

                  {sessionEditDetail.status === "COMPLETED" ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                      Completed session — only candidate name and email can be updated.
                    </p>
                  ) : (
                    <>
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="admin-label mb-1">Position / role</span>
                          <input
                            name="positionTitle"
                            defaultValue={sessionEditDetail.positionTitle ?? ""}
                            placeholder="e.g. Senior HR Manager"
                            className="admin-input py-2"
                            required
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="admin-label mb-1">Domain</span>
                          <input
                            name="domain"
                            defaultValue={sessionEditDetail.domain}
                            placeholder="Domain"
                            className="admin-input py-2"
                            required
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="admin-label mb-1">Topic</span>
                          <input
                            name="topic"
                            defaultValue={sessionEditDetail.topic}
                            placeholder="Topic"
                            className="admin-input py-2"
                            required
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="admin-label mb-1">Duration (min)</span>
                          <input
                            name="durationMin"
                            type="number"
                            min={5}
                            max={120}
                            defaultValue={sessionEditDetail.durationMin}
                            className="admin-input py-2"
                            required
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="admin-label mb-1">Max optional Qs</span>
                          <input
                            name="maxOptionalQuestions"
                            type="number"
                            min={0}
                            max={20}
                            defaultValue={sessionEditDetail.maxOptionalQuestions}
                            className="admin-input py-2"
                          />
                        </label>
                      </div>

                      <label className="block space-y-1">
                        <span className="admin-label mb-1">Job description</span>
                        <textarea
                          name="jobDescription"
                          rows={2}
                          defaultValue={sessionEditDetail.jobDescription ?? ""}
                          placeholder="Job description..."
                          className="admin-input resize-y py-2"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="admin-label mb-1">Key skills (comma-separated)</span>
                        <input
                          name="keySkills"
                          defaultValue={formatSessionKeySkills(sessionEditDetail.keySkills)}
                          placeholder="e.g. communication, leadership"
                          className="admin-input py-2"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="admin-label mb-1">Mandatory questions (one per line)</span>
                        <textarea
                          name="mandatoryQuestions"
                          rows={2}
                          defaultValue={sessionMandatoryPrompts(sessionEditDetail)}
                          placeholder="One question per line"
                          className="admin-input resize-y py-2"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="admin-label mb-1">Optional questions (one per line)</span>
                        <textarea
                          name="optionalQuestions"
                          rows={2}
                          defaultValue={sessionOptionalPrompts(sessionEditDetail)}
                          placeholder="Optional questions..."
                          className="admin-input resize-y py-2"
                        />
                      </label>
                    </>
                  )}

                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button type="submit" className="admin-btn-primary px-4 py-2 text-xs">
                      Save changes
                    </button>
                    <button type="button" onClick={() => closeEditor()} className="admin-btn-ghost px-4 py-2 text-xs">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">Unable to load session.</p>
              )
            ) : null}

            {editor.kind === "candidate" && editingCandidate ? (
              <form
                className="space-y-3"
                onSubmit={(e) => void saveCandidateEdit(e, editingCandidate.candidateId)}
              >
                <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 ring-1 ring-slate-200/80">
                  <span>
                    Sessions: <strong className="text-[#1a3352]">{editingCandidate.sessionsCount}</strong>
                  </span>
                  <span>
                    Latest: <strong className="text-[#1a3352]">{editingCandidate.latestStatus}</strong>
                    {editingCandidate.latestScore != null ? (
                      <span className="ml-1 font-black text-[#00796b]">{editingCandidate.latestScore}%</span>
                    ) : null}
                  </span>
                </div>
                <label className="block space-y-1">
                  <span className="admin-label mb-1">Candidate name</span>
                  <input
                    name="candidateName"
                    defaultValue={editingCandidate.candidateName ?? ""}
                    placeholder="Candidate name"
                    className="admin-input py-2"
                    required
                  />
                </label>
                <label className="block space-y-1">
                  <span className="admin-label mb-1">Candidate email</span>
                  <input
                    name="candidateEmail"
                    type="email"
                    defaultValue={editingCandidate.candidateEmail ?? ""}
                    placeholder="candidate@company.com"
                    className="admin-input py-2"
                  />
                </label>
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button type="submit" className="admin-btn-primary px-4 py-2 text-xs">
                    Save changes
                  </button>
                  <button type="button" onClick={() => closeEditor()} className="admin-btn-ghost px-4 py-2 text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}

            {editor.kind === "requirement" && editingRequirement ? (
              <form
                className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6"
                onSubmit={(e) => void saveRequirementEdit(e, editingRequirement.requirementId)}
              >
                <div className="rounded-xl bg-slate-100/90 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200/60">
                  <span>
                    Sessions:{" "}
                    <strong className="font-bold text-[#1a3352]">{editingRequirement.sessionsCount}</strong>
                  </span>
                  <span className="mx-4 text-slate-300">|</span>
                  <span>
                    Invites:{" "}
                    <strong className="font-bold text-[#1a3352]">
                      {editingRequirement.candidateInvites?.length ?? 0}
                    </strong>
                  </span>
                </div>

                <label className="block space-y-1.5">
                  <span className="admin-label mb-0">Title</span>
                  <input
                    name="title"
                    defaultValue={editingRequirement.title ?? ""}
                    placeholder="e.g. HR Fundamentals"
                    className="w-full rounded-xl border-0 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="admin-label mb-0">Domain</span>
                    <input
                      name="domain"
                      defaultValue={editingRequirement.domain}
                      placeholder="Domain"
                      className="w-full rounded-xl border-0 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                      required
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="admin-label mb-0">Topic</span>
                    <input
                      name="topic"
                      defaultValue={editingRequirement.topic}
                      placeholder="Topic"
                      className="w-full rounded-xl border-0 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                      required
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="admin-label mb-0">Duration (min)</span>
                    <input
                      name="durationMin"
                      type="number"
                      min={5}
                      max={120}
                      defaultValue={editingRequirement.durationMin}
                      className="w-full rounded-xl border-0 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                      required
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="admin-label mb-0">Max optional Qs</span>
                    <input
                      name="maxOptionalQuestions"
                      type="number"
                      min={0}
                      max={20}
                      defaultValue={editingRequirement.maxOptionalQuestions}
                      className="w-full rounded-xl border-0 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                    />
                  </label>
                </div>

                <label className="block space-y-1.5">
                  <span className="admin-label mb-0">Job description</span>
                  <textarea
                    name="jobDescription"
                    defaultValue={editingRequirement.jobDescription ?? ""}
                    rows={3}
                    placeholder="Job description..."
                    className="w-full resize-y rounded-xl border-0 bg-slate-100/90 px-4 py-3 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="admin-label mb-0">Key skills (comma-separated)</span>
                  <input
                    name="keySkills"
                    defaultValue={
                      Array.isArray(editingRequirement.keySkills)
                        ? editingRequirement.keySkills.join(", ")
                        : ""
                    }
                    placeholder="e.g. communication, leadership"
                    className="w-full rounded-xl border-0 bg-slate-100/90 px-4 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="admin-label mb-0">Mandatory questions (one per line)</span>
                  <textarea
                    name="mandatoryQuestions"
                    defaultValue={editingRequirement.mandatoryQuestions.join("\n")}
                    rows={4}
                    placeholder="One question per line"
                    className="w-full resize-y rounded-xl border-0 bg-slate-100/90 px-4 py-3 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="admin-label mb-0">Optional questions (one per line)</span>
                  <textarea
                    name="optionalQuestions"
                    defaultValue={editingRequirement.optionalQuestions.join("\n")}
                    rows={3}
                    placeholder="Optional questions..."
                    className="w-full resize-y rounded-xl border-0 bg-slate-100/90 px-4 py-3 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-200/60 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
                  />
                </label>

                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    className="admin-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      <AdminCandidateDetailModal
        open={candidateViewer !== null || candidateViewerLoading}
        loading={candidateViewerLoading}
        detail={candidateViewer}
        onClose={closeCandidateViewer}
        onEdit={(candidateId) => setEditor({ kind: "candidate", recordId: candidateId })}
        onViewSession={(sessionId) => void openSessionDetail(sessionId)}
        onEditSession={(sessionId) => void openSessionEditor(sessionId)}
      />

      <AdminSessionDetailModal
        open={detailSession !== null || detailLoading}
        loading={detailLoading}
        session={detailSession}
        inviteCode={detailSession ? formatSessionInviteCode(detailSession) : ""}
        onClose={() => setDetailSession(null)}
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
        onCopyLegacyCode={(code) => void copyCode(code, "Legacy code copied.")}
        onOpenSession={(sessionId) => {
          setRequirementViewer(null);
          void openSessionDetail(sessionId);
        }}
      />
    </div>
  );
}

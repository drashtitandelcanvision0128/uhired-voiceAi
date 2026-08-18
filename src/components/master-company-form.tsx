"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Eye, EyeOff, Globe, KeyRound, Mail, Mic, User } from "lucide-react";
import { useToast } from "@/components/app-feedback";
import { MasterShell } from "@/components/master-shell";
import {
  MasterAlert,
  MasterSelect,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
} from "@/components/master-ui";

export type CompanyFormState = {
  companyId: string;
  companyName: string;
  domain: string;
  adminEmail: string;
  adminPasscode: string;
  interviewerName: string;
  interviewerVoiceGender: "MALE" | "FEMALE";
  isActive: boolean;
};

const EMPTY_FORM: CompanyFormState = {
  companyId: "",
  companyName: "",
  domain: "",
  adminEmail: "",
  adminPasscode: "",
  interviewerName: "",
  interviewerVoiceGender: "MALE",
  isActive: true,
};

type CompanyPayload = {
  id: string;
  companyName: string;
  domain: string;
  adminEmail: string;
  interviewerName: string;
  interviewerVoiceGender: "MALE" | "FEMALE";
  isActive: boolean;
  error?: string;
};

function normalizeDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

function stripWhitespace(value: string) {
  return value.replace(/\s+/g, "");
}

function FieldLabel({
  htmlFor,
  children,
  required,
  optional,
}: {
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
      <span>{children}</span>
      {required ? <span className="text-xs font-medium text-destructive">Required</span> : null}
      {optional ? <span className="text-xs font-medium text-muted-foreground">Optional</span> : null}
    </label>
  );
}

function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function FormSection({
  icon: Icon,
  iconClass,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
  iconClass: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="admin-card space-y-5 p-5 sm:p-6">
      <div className="flex gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function CompanyFormFields({
  form,
  onChange,
  isEditing,
  showPasscode,
  onTogglePasscode,
}: {
  form: CompanyFormState;
  onChange: (patch: Partial<CompanyFormState>) => void;
  isEditing: boolean;
  showPasscode: boolean;
  onTogglePasscode: () => void;
}) {
  return (
    <div className="space-y-4">
      <FormSection
        icon={Building2}
        iconClass="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
        title="Company"
        description="This is the client you are adding to Uhired."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="companyName" required>
              Company name
            </FieldLabel>
            <input
              id="companyName"
              name="companyName"
              autoComplete="organization"
              value={form.companyName}
              onChange={(event) => onChange({ companyName: event.target.value })}
              placeholder="Acme Hiring"
              className={masterInputClass}
            />
            <HelpText>Shown in your company list. Example: Acme Hiring.</HelpText>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="companyDomain" required>
              Website
            </FieldLabel>
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="companyDomain"
                name="companyDomain"
                autoComplete="off"
                value={form.domain}
                onChange={(event) => onChange({ domain: event.target.value })}
                onBlur={() => onChange({ domain: normalizeDomain(form.domain) })}
                placeholder="acme.com"
                className={`${masterInputClass} pl-10`}
              />
            </div>
            <HelpText>Only the site name, like acme.com. Do not paste a full link.</HelpText>
          </div>
        </div>
      </FormSection>

      <FormSection
        icon={KeyRound}
        iconClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
        title="How they sign in"
        description="Send these two details to the client. They enter them on the Company Login page."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="adminEmail" required>
              Work email
            </FieldLabel>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="adminEmail"
                name="company-admin-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={form.adminEmail}
                onChange={(event) => onChange({ adminEmail: stripWhitespace(event.target.value) })}
                placeholder="hiring@acme.com"
                className={`${masterInputClass} pl-10`}
              />
            </div>
            <HelpText>This is the email they type to log in. Use their work email, not yours.</HelpText>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="adminPasscode" required={!isEditing} optional={isEditing}>
              {isEditing ? "New passcode" : "Passcode"}
            </FieldLabel>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="adminPasscode"
                name="company-admin-passcode"
                type={showPasscode ? "text" : "password"}
                autoComplete="new-password"
                value={form.adminPasscode}
                onChange={(event) => onChange({ adminPasscode: stripWhitespace(event.target.value) })}
                placeholder={isEditing ? "Leave empty to keep the current one" : "Create a passcode they can remember"}
                className={`${masterInputClass} pr-11 pl-10`}
              />
              <button
                type="button"
                onClick={onTogglePasscode}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <HelpText>
              {isEditing
                ? "Leave empty unless you want to replace the current passcode."
                : "This works like a password. Share it with the client along with the email."}
            </HelpText>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/60 px-4 py-3">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => onChange({ isActive: event.target.checked })}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-semibold text-foreground">Allow this company to log in</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Keep this on for a live client. Turn it off if they should not access Uhired yet.
            </span>
          </span>
        </label>
      </FormSection>

      <FormSection
        icon={Mic}
        iconClass="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
        title="AI interviewer"
        description="What candidates hear during interviews for this company."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="interviewerName" optional>
              Interviewer first name
            </FieldLabel>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="interviewerName"
                name="interviewerName"
                autoComplete="off"
                value={form.interviewerName}
                onChange={(event) => onChange({ interviewerName: event.target.value })}
                placeholder="Alex"
                className={`${masterInputClass} pl-10`}
              />
            </div>
            <HelpText>A first name is enough. Example: Alex or Emma.</HelpText>
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="interviewerVoice" optional>
              Voice
            </FieldLabel>
            <MasterSelect
              value={form.interviewerVoiceGender}
              onValueChange={(value) => onChange({ interviewerVoiceGender: value as "MALE" | "FEMALE" })}
              options={[
                { value: "MALE", label: "Male voice" },
                { value: "FEMALE", label: "Female voice" },
              ]}
              aria-label="Interviewer voice"
            />
            <HelpText>Pick the voice that should speak to candidates.</HelpText>
          </div>
        </div>
      </FormSection>
    </div>
  );
}

export function MasterCompanyFormPage({
  mode,
  companyId,
}: {
  mode: "create" | "edit";
  companyId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEditing = mode === "edit";
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [showPasscode, setShowPasscode] = useState(false);

  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/master/companies/${companyId}`);
      const payload = (await res.json()) as CompanyPayload;
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "This company could not be loaded.");
        return;
      }
      setForm({
        companyId: payload.id,
        companyName: payload.companyName,
        domain: payload.domain,
        adminEmail: payload.adminEmail,
        adminPasscode: "",
        interviewerName: payload.interviewerName ?? "",
        interviewerVoiceGender: payload.interviewerVoiceGender ?? "MALE",
        isActive: payload.isActive,
      });
    } catch {
      setError("This company could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [companyId, router]);

  useEffect(() => {
    if (isEditing) void loadCompany();
  }, [isEditing, loadCompany]);

  function validate(): string | null {
    if (!form.companyName.trim()) return "Enter the company name.";
    if (!normalizeDomain(form.domain)) return "Enter the company website, like acme.com.";
    const adminEmail = stripWhitespace(form.adminEmail);
    const adminPasscode = stripWhitespace(form.adminPasscode);
    if (!adminEmail) return "Enter the work email they will use to log in.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      return "Enter a valid work email, like hiring@acme.com.";
    }
    if (!isEditing && !adminPasscode) {
      return "Create a passcode for the client to log in.";
    }
    return null;
  }

  async function saveCompany() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setSaving(true);
    try {
      const requestBody: Record<string, unknown> = {
        companyId: form.companyId || undefined,
        companyName: form.companyName.trim(),
        domain: normalizeDomain(form.domain),
        adminEmail: stripWhitespace(form.adminEmail).toLowerCase(),
        interviewerName: form.interviewerName.trim(),
        interviewerVoiceGender: form.interviewerVoiceGender,
        isActive: form.isActive,
      };
      const adminPasscode = stripWhitespace(form.adminPasscode);
      if (adminPasscode) {
        requestBody.adminPasscode = adminPasscode;
      }

      const res = await fetch("/api/master/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = (await res.json()) as { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "The company could not be saved. Check the fields and try again.");
        return;
      }
      toast.success(isEditing ? "Company updated." : "Company created. Share the email and passcode with the client.");
      router.push(isEditing ? "/master/companies?notice=updated" : "/master/companies?notice=created");
    } catch {
      setError("The company could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MasterShell
      title={isEditing ? "Edit company" : "Add a company"}
      subtitle={
        isEditing
          ? "Change this client's name, login details, or interviewer."
          : "Set up one client. They log in with a work email and a passcode."
      }
      topActions={
        <Link href="/master/companies" className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 !py-2.5`}>
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
      }
    >
      <div className="w-full space-y-4">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        {loading ? (
          <div className="admin-card rounded-2xl px-4 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">Loading company…</p>
            <p className="mt-1 text-sm text-muted-foreground">Fetching the latest details.</p>
          </div>
        ) : (
          <>
            <CompanyFormFields
              form={form}
              isEditing={isEditing}
              showPasscode={showPasscode}
              onTogglePasscode={() => setShowPasscode((current) => !current)}
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
            />

            <div className="admin-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {isEditing
                  ? "Save when you are done. The client keeps the same login unless you set a new passcode."
                  : "After you create this, send the work email and passcode to the client."}
              </p>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                <Link href="/master/companies" className="admin-btn-ghost !px-5 !py-2.5">
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={() => void saveCompany()}
                  className={masterBtnPrimary}
                  disabled={saving}
                >
                  {saving ? "Saving..." : isEditing ? "Save changes" : "Create company"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </MasterShell>
  );
}

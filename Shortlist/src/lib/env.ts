import "server-only";
import { z } from "zod";
import type { CompanyMemberRole } from "@prisma/client";
import { getAppEnvironment, type AppEnvironment } from "@/lib/app-environment";
import { isElevenLabsTtsEnabled, resolveVoiceTtsProvider } from "@/lib/voice-tts";

const optionalString = z.string().optional();

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
  APP_ENV: z.enum(["development", "staging", "production"]).optional(),
  NEXT_PUBLIC_APP_URL: optionalString,
  VERCEL: optionalString,
  VERCEL_ENV: optionalString,

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: optionalString,
  DATABASE_CONNECTION_LIMIT: optionalString,
  DATABASE_POOL_TIMEOUT: optionalString,

  ADMIN_PORTAL_KEY: optionalString,
  MASTER_ADMIN_KEY: optionalString,
  MASTER_ADMIN_EMAIL: optionalString,
  MASTER_ADMIN_PASSWORD: optionalString,
  MASTER_SESSION_SECRET: optionalString,
  COMPANY_SESSION_SECRET: optionalString,
  CANDIDATE_INTERVIEW_SESSION_SECRET: optionalString,

  OPENAI_API_KEY: optionalString,
  SCORING_MODE: optionalString,
  SCORING_MODEL: optionalString,
  EMBEDDING_MODEL: optionalString,
  VOICE_TTS_PROVIDER: optionalString,
  ELEVENLABS_API_KEY: optionalString,
  ELEVENLABS_VOICE_ID_MALE: optionalString,
  ELEVENLABS_VOICE_ID_FEMALE: optionalString,
  ELEVENLABS_MODEL_ID: optionalString,

  RAZORPAY_KEY_ID: optionalString,
  RAZORPAY_KEY_SECRET: optionalString,
  RAZORPAY_WEBHOOK_SECRET: optionalString,
  PRACTICE_BASE_PRICE_RUPEES: optionalString,

  VIDEO_STORAGE_PROVIDER: optionalString,
  AWS_REGION: optionalString,
  AWS_S3_BUCKET: optionalString,
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_S3_ENDPOINT: optionalString,

  EMAIL_PROVIDER: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalString,
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_PASSWORD: optionalString,
  SMTP_FROM_EMAIL: optionalString,
  SMTP_FROM_NAME: optionalString,
  SMTP_FROM: optionalString,
  SMTP_DELIVERY_MODE: optionalString,
  SMTP_SEND_DELAY_MS: optionalString,
  SMTP_MAX_RETRIES: optionalString,
  SUPPORT_EMAIL: optionalString,
  INVITE_EMAIL_BASE_URL: optionalString,
  EMAIL_LINK_BASE_URL: optionalString,
  CONTACT_TO_EMAIL: optionalString,

  SUPABASE_URL: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  SUPABASE_STORAGE_BUCKET: optionalString,

  DATA_RETENTION_DAYS_VIDEO: optionalString,
  DATA_RETENTION_DAYS_TRANSCRIPT: optionalString,
  DATA_RETENTION_DAYS_PRACTICE: optionalString,

  COMPANY_LOGO_PATH: optionalString,
  COMPANY_INVITE_SECRET: optionalString,
  SES_CONFIGURATION_SET: optionalString,

  FIELD_ENCRYPTION_KEY: optionalString,
  REDIS_URL: optionalString,

  COMPANY_OIDC_ISSUER: optionalString,
  COMPANY_OIDC_CLIENT_ID: optionalString,
  COMPANY_OIDC_CLIENT_SECRET: optionalString,
  COMPANY_OIDC_REDIRECT_URI: optionalString,
  COMPANY_OIDC_SCOPES: optionalString,
  COMPANY_OIDC_AUTO_PROVISION: optionalString,
  PHASE_7B_ENABLED: optionalString,
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_RAZORPAY_KEY_ID: optionalString,
  NEXT_PUBLIC_APP_URL: optionalString,
  NEXT_PUBLIC_INTERVIEW_DURATION_SEC: optionalString,
});

function formatEnvIssues(issues: z.ZodIssue[]) {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
}

function parseOidcAutoProvisionRole(raw: string | undefined): CompanyMemberRole | null {
  const value = raw?.trim().toUpperCase();
  if (value === "RECRUITER" || value === "HIRING_MANAGER" || value === "VIEWER") {
    return value;
  }
  return null;
}

function parseServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${formatEnvIssues(parsed.error.issues)}`);
  }
  return parsed.data;
}

function parsePublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_INTERVIEW_DURATION_SEC: process.env.NEXT_PUBLIC_INTERVIEW_DURATION_SEC,
  });
  if (!parsed.success) {
    throw new Error(`Invalid public environment:\n${formatEnvIssues(parsed.error.issues)}`);
  }
  return parsed.data;
}

function requireInProduction(
  appEnv: AppEnvironment,
  label: string,
  value: string | undefined,
): string | undefined {
  if (appEnv === "production" && !value?.trim()) {
    throw new Error(`${label} is required in production (APP_ENV=production).`);
  }
  return value?.trim() || undefined;
}

function buildEnv() {
  const server = parseServerEnv();
  const publicEnv = parsePublicEnv();
  const appEnv = getAppEnvironment();
  const nodeEnv = server.NODE_ENV ?? "development";
  const isProduction = appEnv === "production";

  const databaseUrl = server.DATABASE_URL.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const openAiKey = requireInProduction(appEnv, "OPENAI_API_KEY", server.OPENAI_API_KEY);
  const companySessionSecret =
    server.COMPANY_SESSION_SECRET?.trim() || server.ADMIN_PORTAL_KEY?.trim() || "";
  const masterSessionSecret =
    server.MASTER_SESSION_SECRET?.trim() || server.MASTER_ADMIN_KEY?.trim() || "";
  const candidateSessionSecret =
    server.CANDIDATE_INTERVIEW_SESSION_SECRET?.trim() ||
    server.COMPANY_SESSION_SECRET?.trim() ||
    server.ADMIN_PORTAL_KEY?.trim() ||
    "";

  if (isProduction) {
    requireInProduction(appEnv, "COMPANY_SESSION_SECRET or ADMIN_PORTAL_KEY", companySessionSecret);
    requireInProduction(appEnv, "MASTER_SESSION_SECRET or MASTER_ADMIN_KEY", masterSessionSecret);
  }

  return {
    appEnv,
    nodeEnv,
    isProduction,
    isVercel: Boolean(server.VERCEL),
    databaseUrl,
    directUrl: server.DIRECT_URL?.trim() || databaseUrl,
    databaseConnectionLimit: server.DATABASE_CONNECTION_LIMIT?.trim() || "15",
    databasePoolTimeout: server.DATABASE_POOL_TIMEOUT?.trim() || "30",

    publicAppUrl: publicEnv.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
    razorpayPublicKeyId: publicEnv.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || "",
    interviewDurationSecOverride: Number(publicEnv.NEXT_PUBLIC_INTERVIEW_DURATION_SEC?.trim() || "0"),

    adminPortalKey: server.ADMIN_PORTAL_KEY?.trim() || "",
    masterAdminKey: server.MASTER_ADMIN_KEY?.trim() || "",
    masterAdminEmail: server.MASTER_ADMIN_EMAIL?.trim().toLowerCase() || "",
    masterAdminPassword: server.MASTER_ADMIN_PASSWORD?.trim() || "",
    companySessionSecret,
    masterSessionSecret,
    candidateInterviewSessionSecret: candidateSessionSecret,

    openAiApiKey: openAiKey || "",
    scoringMode: server.SCORING_MODE?.trim() || "rubric",
    scoringModel: server.SCORING_MODEL?.trim() || "gpt-4.1-mini",
    embeddingModel: server.EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
    voiceTtsProvider: resolveVoiceTtsProvider(server.VOICE_TTS_PROVIDER),
    elevenlabsApiKey: server.ELEVENLABS_API_KEY?.trim() || "",
    elevenlabsVoiceIdMale: server.ELEVENLABS_VOICE_ID_MALE?.trim() || "",
    elevenlabsVoiceIdFemale: server.ELEVENLABS_VOICE_ID_FEMALE?.trim() || "",
    elevenlabsModelId: server.ELEVENLABS_MODEL_ID?.trim() || "eleven_turbo_v2_5",
    useElevenLabsTts: isElevenLabsTtsEnabled(
      resolveVoiceTtsProvider(server.VOICE_TTS_PROVIDER),
      server.ELEVENLABS_API_KEY?.trim() || "",
    ),

    razorpayKeyId: server.RAZORPAY_KEY_ID?.trim() || "",
    razorpayKeySecret: server.RAZORPAY_KEY_SECRET?.trim() || "",
    razorpayWebhookSecret: server.RAZORPAY_WEBHOOK_SECRET?.trim() || "",
    practiceBasePriceRupees: Number(server.PRACTICE_BASE_PRICE_RUPEES?.trim() || "25"),

    videoStorageProvider: server.VIDEO_STORAGE_PROVIDER?.trim() || "local",
    awsRegion: server.AWS_REGION?.trim() || "ap-south-1",
    awsS3Bucket: server.AWS_S3_BUCKET?.trim() || "",
    awsAccessKeyId: server.AWS_ACCESS_KEY_ID?.trim() || "",
    awsSecretAccessKey: server.AWS_SECRET_ACCESS_KEY?.trim() || "",
    awsS3Endpoint: server.AWS_S3_ENDPOINT?.trim() || "",

    emailProvider: server.EMAIL_PROVIDER?.trim().toLowerCase() || "",
    smtpHost: server.SMTP_HOST?.trim() || "",
    smtpPort: Number(server.SMTP_PORT?.trim() || "2525"),
    smtpUser: server.SMTP_USER?.trim() || "",
    smtpPass: server.SMTP_PASS?.trim() || server.SMTP_PASSWORD?.trim() || "",
    smtpFromEmail: server.SMTP_FROM_EMAIL?.trim() || "",
    smtpFromName: server.SMTP_FROM_NAME?.trim() || "",
    smtpFrom: server.SMTP_FROM?.trim() || "",
    smtpDeliveryMode: server.SMTP_DELIVERY_MODE?.trim().toLowerCase() || "",
    smtpSendDelayMs: Number(server.SMTP_SEND_DELAY_MS?.trim() || "1500"),
    smtpMaxRetries: Number(server.SMTP_MAX_RETRIES?.trim() || "5"),
    supportEmail: server.SUPPORT_EMAIL?.trim() || "",
    inviteEmailBaseUrl: server.INVITE_EMAIL_BASE_URL?.trim() || "",
    emailLinkBaseUrl: server.EMAIL_LINK_BASE_URL?.trim() || "",
    contactToEmail: server.CONTACT_TO_EMAIL?.trim() || server.SUPPORT_EMAIL?.trim() || "",

    supabaseUrl: server.SUPABASE_URL?.trim() || "",
    supabaseServiceRoleKey: server.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
    supabaseStorageBucket: server.SUPABASE_STORAGE_BUCKET?.trim() || "uhired-videos",

    dataRetentionDaysVideo: Number(server.DATA_RETENTION_DAYS_VIDEO?.trim() || "30"),
    dataRetentionDaysTranscript: Number(server.DATA_RETENTION_DAYS_TRANSCRIPT?.trim() || "90"),
    dataRetentionDaysPractice: Number(server.DATA_RETENTION_DAYS_PRACTICE?.trim() || "180"),

    companyLogoPath: server.COMPANY_LOGO_PATH?.trim() || "",
    companyInviteSecret:
      server.COMPANY_INVITE_SECRET?.trim() || companySessionSecret,
    sesConfigurationSet: server.SES_CONFIGURATION_SET?.trim() || "",
    fieldEncryptionKey: server.FIELD_ENCRYPTION_KEY?.trim() || "",
    redisUrl: server.REDIS_URL?.trim() || "",

    companyOidcIssuer: server.COMPANY_OIDC_ISSUER?.trim().replace(/\/+$/, "") || "",
    companyOidcClientId: server.COMPANY_OIDC_CLIENT_ID?.trim() || "",
    companyOidcClientSecret: server.COMPANY_OIDC_CLIENT_SECRET?.trim() || "",
    companyOidcRedirectUri: server.COMPANY_OIDC_REDIRECT_URI?.trim() || "",
    companyOidcScopes: server.COMPANY_OIDC_SCOPES?.trim() || "openid email profile",
    companyOidcAutoProvisionRole: parseOidcAutoProvisionRole(server.COMPANY_OIDC_AUTO_PROVISION),
    phase7bEnabled: server.PHASE_7B_ENABLED?.trim().toLowerCase() === "true",
  };
}

export const env = buildEnv();

export type EmailVerificationStatus = "valid" | "invalid_syntax" | "invalid_domain" | "disposable";

export type EmailVerificationResult = {
  email: string;
  valid: boolean;
  status: EmailVerificationStatus;
  message: string;
};

export function verificationStatusLabel(status: EmailVerificationStatus): string {
  switch (status) {
    case "valid":
      return "Verified";
    case "invalid_syntax":
      return "Incorrect format";
    case "invalid_domain":
      return "Domain does not exist";
    case "disposable":
      return "Temporary email";
    default:
      return "Unknown";
  }
}

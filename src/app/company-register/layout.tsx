import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Company Registration",
  description: "Create your Uhired AI company workspace for AI voice interviews and structured hiring.",
};

export default function CompanyRegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

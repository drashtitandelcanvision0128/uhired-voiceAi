import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Company Login",
  description: "Sign in to your Uhired AI company workspace to manage AI voice interviews and hiring.",
};

export default function CompanyLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your Uhired AI workspace to launch AI voice interviews, automate screening, and shortlist candidates.",
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}

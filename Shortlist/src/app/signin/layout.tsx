import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Uhired AI to run AI voice interviews, review evaluations, and manage your hiring pipeline.",
};

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}

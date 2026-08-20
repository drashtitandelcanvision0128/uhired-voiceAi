import { BrandLogo } from "@/components/brand-logo";

type AdminPortalLogoProps = {
  title?: string;
  subtitle?: string;
};

/** Sidebar brand lockup — black Uhired mark on every portal. */
export function AdminPortalLogo({ title = "Uhired", subtitle }: AdminPortalLogoProps) {
  return (
    <BrandLogo
      href={false}
      variant="theme"
      markSize={32}
      title={title}
      subtitle={subtitle}
      withAiSuffix={false}
    />
  );
}

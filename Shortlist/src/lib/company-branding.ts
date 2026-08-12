export type CompanyBranding = {
  brandDisplayName?: string | null;
  brandPrimaryColor?: string | null;
  brandLogoUrl?: string | null;
};

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function normalizeBrandPrimaryColor(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX_COLOR.test(withHash) ? withHash.toLowerCase() : null;
}

export function resolveBrandDisplayName(
  branding: CompanyBranding,
  fallbackCompanyName: string | null | undefined,
): string {
  const custom = branding.brandDisplayName?.trim();
  if (custom) return custom;
  return fallbackCompanyName?.trim() || "Uhired";
}

export function buildBrandingCssVars(branding: CompanyBranding): Record<string, string> {
  const primary = normalizeBrandPrimaryColor(branding.brandPrimaryColor);
  if (!primary) return {};
  return {
    "--brand-primary": primary,
    "--primary": primary,
  };
}

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const BRAND_LOGO_SRC = "/brand/logo-white.png";

type BrandLogoVariant = "black" | "white" | "theme";

type BrandLogoMarkProps = {
  variant?: BrandLogoVariant;
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogoMark({
  variant = "black",
  size = 32,
  className,
  priority = false,
}: BrandLogoMarkProps) {
  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt="Uhired"
        fill
        sizes={`${size}px`}
        priority={priority}
        className={cn(
          "object-contain",
          variant === "theme" && "invert dark:invert-0",
          variant === "black" && "invert",
        )}
      />
    </span>
  );
}

type BrandLogoProps = {
  href?: string | false;
  variant?: BrandLogoVariant;
  markSize?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
  title?: string;
  subtitle?: string;
  withAiSuffix?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  href = "/",
  variant = "black",
  markSize = 32,
  showWordmark = true,
  wordmarkClassName,
  className,
  title = "Uhired",
  subtitle,
  withAiSuffix = true,
  priority,
}: BrandLogoProps) {
  const content = (
    <>
      <BrandLogoMark variant={variant} size={markSize} priority={priority} />
      {showWordmark ? (
        subtitle ? (
          <span className="min-w-0">
            <span
              className={cn(
                "block truncate text-sm font-semibold tracking-tight text-foreground",
                wordmarkClassName,
              )}
            >
              {title}
            </span>
            <p className="text-muted-foreground truncate text-[11px]">{subtitle}</p>
          </span>
        ) : (
          <span className={cn("font-display text-lg font-bold tracking-tight", wordmarkClassName)}>
            {title}
            {withAiSuffix ? (
              <>
                {" "}
                <span className="text-gradient">AI</span>
              </>
            ) : null}
          </span>
        )
      ) : null}
    </>
  );

  const sharedClass = cn("flex min-w-0 items-center gap-2.5 no-underline", className);

  if (href) {
    return (
      <Link href={href} className={sharedClass} aria-label="Uhired AI home">
        {content}
      </Link>
    );
  }

  return <div className={sharedClass}>{content}</div>;
}

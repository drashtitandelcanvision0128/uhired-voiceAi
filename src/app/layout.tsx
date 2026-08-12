import type { Metadata } from "next";
import { AppFeedbackProvider } from "@/components/app-feedback";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";
import { getThemeInitScript } from "@/lib/site-theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Uhired — AI Mock Interview Practice & Hiring Platform",
    template: "%s | Uhired",
  },
  description:
    "Practice mock interviews with an AI interview coach for PM, engineering, data science, and more. Uhired helps candidates build confidence and companies run structured AI interviews.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#050816" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Uhired" />
        <link rel="apple-touch-icon" href="/marketing/hero-features-grid.png" />
        <script dangerouslySetInnerHTML={{ __html: getThemeInitScript() }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <AppFeedbackProvider>
            <PwaRegister />
            {children}
          </AppFeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

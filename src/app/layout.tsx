import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { I18nProvider } from "@/components/i18n-provider";
import { loadMessages } from "@/i18n/messages";
import { type Locale, type Messages, defaultLocale, locales } from "@/i18n/config";
import { AppToast } from "@/components/app-toast";
import { BottomNav } from "@/components/bottom-nav";
import { GlassFilterDefs } from "@/components/glass-filter-defs";
import { LiquidGlassManager } from "@/components/liquid-glass-manager";
import { NavigationHistory } from "@/components/navigation-history";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ThemeController } from "@/components/theme-controller";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import { isCoverImageProxyEnabled } from "@/lib/cover-image";
import { getServerFeatureFlags } from "@/lib/feature-flags";
import { getConfiguredNeodbHostname } from "@/lib/neodb-instance";
import { getDefaultThemeColor } from "@/lib/theme";
import {
  SITE_PUBLIC_ORIGIN,
  getNoIndexRobots,
  getSiteVerification,
} from "@/lib/seo";
import { siteConfig } from "@/site.config";
import { HomeTrendingBootstrap } from "./(home)/home-trending-bootstrap";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const locale = resolveLocale(await cookies());
    const messages = await loadMessages(locale);

    return {
      metadataBase: new URL(SITE_PUBLIC_ORIGIN),
      title: siteConfig.name,
      description: getMessage(messages, "app.description"),
      robots: getNoIndexRobots(),
      verification: getSiteVerification(),
      appleWebApp: {
        capable: true,
        title: siteConfig.name,
      },
    };
  } catch {
    return {
      metadataBase: new URL(SITE_PUBLIC_ORIGIN),
      title: siteConfig.name,
      description: siteConfig.productDescription,
      robots: getNoIndexRobots(),
      verification: getSiteVerification(),
      appleWebApp: {
        capable: true,
        title: siteConfig.name,
      },
    };
  }
}

export const viewport: Viewport = {
  themeColor: getDefaultThemeColor().primary,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = resolveLocale(
    await cookies(),
    (await headers()).get("x-app-about-locale"),
  );
  const messages = await loadMessages(locale);
  const featureFlags = getServerFeatureFlags();
  const defaultThemeColor = getDefaultThemeColor();

  return (
    <html
      lang={locale}
      className="h-full antialiased"
      style={
        {
          "--theme-primary": defaultThemeColor.primary,
          "--theme-primary-hover": defaultThemeColor.primaryHover,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} messages={messages}>
          <FeatureFlagsProvider value={featureFlags}>
            <HomeTrendingBootstrap
              coverHost={getConfiguredNeodbHostname()}
              isCoverProxyEnabled={isCoverImageProxyEnabled()}
            />
            <GlassFilterDefs />
            <LiquidGlassManager />
            <ThemeController />
            <ServiceWorkerRegister />
            <NavigationHistory />
            {children}
            <Analytics />
            <SpeedInsights />
            <BottomNav />
            <AppToast />
          </FeatureFlagsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

function resolveLocale(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  requestedLocale?: string | null,
): Locale {
  if (
    requestedLocale &&
    (locales as readonly string[]).includes(requestedLocale)
  ) {
    return requestedLocale as Locale;
  }

  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  if (
    cookieLocale &&
    (locales as readonly string[]).includes(cookieLocale)
  ) {
    return cookieLocale as Locale;
  }

  return defaultLocale;
}

function getMessage(messages: Messages, key: string): string {
  const parts = key.split(".");
  let current: unknown = messages;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return key;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : key;
}

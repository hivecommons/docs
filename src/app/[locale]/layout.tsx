import type { Metadata } from "next";
import localFont from "next/font/local";

import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/settings";
import { ThemeProvider } from "next-themes";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import "../globals.css";

// Self-hosted fonts (see src/fonts) to avoid fetching from fonts.googleapis.com at build time.
const inter = localFont({
  src: [
    {
      path: "../../fonts/ibm-plex-sans-400-600-normal.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "../../fonts/ibm-plex-sans-400-600-italic.woff2",
      weight: "400 600",
      style: "italic",
    },
  ],
  variable: "--font-inter",
});

const fraunces = localFont({
  src: [
    { path: "../../fonts/fraunces-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-fraunces",
});

const jetbrainsMono = localFont({
  src: [
    {
      path: "../../fonts/jetbrains-mono-100-800.woff2",
      weight: "100 800",
      style: "normal",
    },
  ],
  variable: "--font-jetbrains-mono",
});

const SITE_URL = "https://docs.hivecommons.dev";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  const title = t("title");
  const description = t("description");

  return {
    title,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: `/${locale}`,
    },
    openGraph: {
      type: "website",
      locale: locale === "en" ? "en_US" : locale,
      url: `${SITE_URL}/${locale}`,
      siteName: "Hive Commons",
      title,
      description,
      images: [
        {
          url: "/hive-commons-og.png",
          width: 1200,
          height: 630,
          alt: "Hive Commons",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/hive-commons-og.png"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;

  const isLocale = (val: string): val is Locale =>
    (locales as readonly string[]).includes(val);

  if (!isLocale(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <GoogleAnalytics />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

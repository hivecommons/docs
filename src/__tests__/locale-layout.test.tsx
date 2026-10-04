/**
 * Coverage for the localized root layout (src/app/[locale]/layout.tsx),
 * previously 0%: `generateMetadata` (per-locale canonical, Open Graph locale
 * mapping, Twitter card, robots) and `RootLayout` (unknown-locale guard that
 * must 404 before any messages load, `<html lang>`, font variables, the
 * provider stack). These decide what search engines index for every landing
 * page locale and whether an unknown `/xx` route renders or 404s.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const { getMessages, getTranslations, notFound, providerSpy } = vi.hoisted(
  () => ({
    getMessages: vi.fn(),
    getTranslations: vi.fn(),
    notFound: vi.fn(),
    providerSpy: vi.fn(),
  })
);

vi.mock("../app/globals.css", () => ({}));

vi.mock("next/font/local", () => ({
  default: (opts: { variable: string }) => ({
    variable: opts.variable,
    className: `${opts.variable}-class`,
  }),
}));

vi.mock("next-intl/server", () => ({ getMessages, getTranslations }));

vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({
    messages,
    children,
  }: {
    messages: unknown;
    children: ReactNode;
  }) => {
    providerSpy(messages);
    return <div data-testid="intl">{children}</div>;
  },
}));

vi.mock("next/navigation", () => ({ notFound }));

vi.mock("next-themes", () => ({
  ThemeProvider: ({
    children,
    ...props
  }: {
    children: ReactNode;
    attribute?: string;
    defaultTheme?: string;
    enableSystem?: boolean;
  }) => (
    <div
      data-testid="theme"
      data-attribute={props.attribute}
      data-default={props.defaultTheme}
    >
      {children}
    </div>
  ),
}));

vi.mock("@/components/GoogleAnalytics", () => ({
  default: () => <script data-testid="ga" />,
}));

const SITE_URL = "https://docs.hivecommons.dev";
const MESSAGES = { metadata: { title: "T", description: "D" } };

class NotFoundSignal extends Error {}

async function loadLayout() {
  return import("../app/[locale]/layout");
}

async function metadataFor(locale: string) {
  const { generateMetadata } = await loadLayout();
  return generateMetadata({ params: Promise.resolve({ locale }) });
}

async function renderFor(
  locale: string,
  children: ReactNode = <main>body</main>
) {
  const { default: RootLayout } = await loadLayout();
  return renderToStaticMarkup(
    await RootLayout({ children, params: Promise.resolve({ locale }) })
  );
}

beforeEach(() => {
  getTranslations
    .mockReset()
    .mockImplementation(async ({ locale, namespace }) => {
      const table: Record<string, string> = {
        title: `Hive Commons (${locale})`,
        description: `Description for ${locale} in ${namespace}`,
      };
      return (key: string) => table[key] ?? `missing:${key}`;
    });
  getMessages.mockReset().mockResolvedValue(MESSAGES);
  notFound.mockReset().mockImplementation(() => {
    throw new NotFoundSignal("NEXT_NOT_FOUND");
  });
  providerSpy.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("[locale]/layout generateMetadata", () => {
  it("asks next-intl for the metadata namespace of the requested locale", async () => {
    await metadataFor("ja");
    expect(getTranslations).toHaveBeenCalledWith({
      locale: "ja",
      namespace: "metadata",
    });
  });

  it("maps en to the en_US Open Graph locale and leaves other locales as-is", async () => {
    const en = await metadataFor("en");
    const ja = await metadataFor("ja");
    const zhTW = await metadataFor("zh-TW");
    expect(en.openGraph).toMatchObject({ locale: "en_US" });
    expect(ja.openGraph).toMatchObject({ locale: "ja" });
    expect(zhTW.openGraph).toMatchObject({ locale: "zh-TW" });
  });

  it("builds locale-specific canonical and Open Graph URLs under the site origin", async () => {
    const md = await metadataFor("de");
    expect(md.metadataBase?.href).toBe(`${SITE_URL}/`);
    expect(md.alternates).toEqual({ canonical: "/de" });
    expect(md.openGraph).toMatchObject({
      type: "website",
      url: `${SITE_URL}/de`,
      siteName: "Hive Commons",
    });
  });

  it("uses the translated title and description for the page, Open Graph and Twitter", async () => {
    const md = await metadataFor("fr");
    expect(md.title).toBe("Hive Commons (fr)");
    expect(md.description).toBe("Description for fr in metadata");
    expect(md.openGraph).toMatchObject({
      title: md.title,
      description: md.description,
    });
    expect(md.twitter).toMatchObject({
      card: "summary_large_image",
      title: md.title,
      description: md.description,
      images: ["/hive-commons-og.png"],
    });
  });

  it("ships a 1200x630 Open Graph image and allows indexing", async () => {
    const md = await metadataFor("en");
    const images = (md.openGraph as { images: Array<Record<string, unknown>> })
      .images;
    expect(images).toEqual([
      {
        url: "/hive-commons-og.png",
        width: 1200,
        height: 630,
        alt: "Hive Commons",
      },
    ]);
    expect(md.robots).toEqual({ index: true, follow: true });
  });
});

describe("[locale]/layout RootLayout", () => {
  it("404s an unknown locale before loading any messages", async () => {
    await expect(renderFor("xx")).rejects.toBeInstanceOf(NotFoundSignal);
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getMessages).not.toHaveBeenCalled();
  });

  it("treats locale codes case-sensitively, exactly as configured", async () => {
    // "SC" is a configured locale; "sc" and "EN" are not.
    await expect(renderFor("SC")).resolves.toContain('lang="SC"');
    await expect(renderFor("sc")).rejects.toBeInstanceOf(NotFoundSignal);
    await expect(renderFor("EN")).rejects.toBeInstanceOf(NotFoundSignal);
  });

  it("renders <html lang> for every configured locale without calling notFound", async () => {
    const { locales } = await import("@/i18n/settings");
    for (const locale of locales) {
      const html = await renderFor(locale);
      expect(html).toContain(`<html lang="${locale}"`);
    }
    expect(notFound).not.toHaveBeenCalled();
    expect(getMessages).toHaveBeenCalledTimes(locales.length);
  });

  it("applies all three self-hosted font variables and antialiasing on <body>", async () => {
    const html = await renderFor("en");
    const body = html.match(/<body class="([^"]*)"/);
    expect(body).not.toBeNull();
    const classes = body![1].split(/\s+/);
    expect(classes).toEqual(
      expect.arrayContaining([
        "--font-inter",
        "--font-fraunces",
        "--font-jetbrains-mono",
        "antialiased",
      ])
    );
  });

  it("wraps children in GA, a dark-default class-attribute ThemeProvider and the intl provider", async () => {
    const html = await renderFor("es", <main data-testid="child">hola</main>);
    expect(html).toContain('data-testid="ga"');
    expect(html).toMatch(
      /data-testid="theme" data-attribute="class" data-default="dark"[^>]*>[\s\S]*data-testid="intl"[^>]*>[\s\S]*data-testid="child"/
    );
    expect(providerSpy).toHaveBeenCalledWith(MESSAGES);
  });
});

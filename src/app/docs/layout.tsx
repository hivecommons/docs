import type { Metadata } from 'next'
import { DocsNavbar, DocsFooter } from '@/components/docs/index'
import { DocsProvider } from '@/components/docs/DocsProvider'
import { MobileOverlay } from '@/components/docs/MobileOverlay'
import { IBM_Plex_Sans, Fraunces, JetBrains_Mono } from "next/font/google"
import { Suspense } from 'react'
import { ThemeProvider } from "next-themes"
import "../globals.css"

const inter = IBM_Plex_Sans({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
})

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600"],
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

const SITE_URL = 'https://docs.hivecommons.dev'
const SITE_TITLE = 'Hive Commons Docs - AI Agent Collaboration Projects'
const SITE_DESCRIPTION =
  'Documentation for Hive Commons projects that help AI coding agents and maintainers work together: Hive, Spektacular, hotshot, pluk, promptargs, rationguard, and dibs.'

const INTEGRATION_NAMES = [
  'Claude Code',
  'GitHub Copilot CLI',
  'Goose',
  'OpenAI Codex CLI',
  'Pi',
  'IBM Bob',
  'Aider',
  'Gemini CLI',
  'Google Antigravity CLI',
  'OpenCode',
  'Kilo Code',
  'Muse Code',
  'Oh My Pi',
  'vLLM',
  'llm-d',
  'LiteLLM',
  'IBM watsonx.ai',
  'OpenRouter',
  'Anthropic',
  'OpenAI',
  'DeepSeek',
]

const INFRA_SPONSORS = [
  { '@type': 'Organization', name: 'Akamai', url: 'https://www.linode.com/' },
  { '@type': 'Organization', name: 'Oracle Cloud', url: 'https://www.oracle.com/cloud/cloud-native/kubernetes-engine/' },
  { '@type': 'Organization', name: 'Cloudflare', url: 'https://www.cloudflare.com/' },
  { '@type': 'Organization', name: 'GitHub Copilot', url: 'https://github.com/features/copilot' },
  { '@type': 'Organization', name: 'Bluehost', url: 'https://www.bluehost.com/' },
]

const DOCS_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Hive',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Linux, macOS',
    license: 'https://www.apache.org/licenses/LICENSE-2.0',
    url: 'https://hive.hivecommons.dev/',
    codeRepository: 'https://github.com/hivecommons/hive',
    keywords: INTEGRATION_NAMES.join(', '),
    featureList: [
      'Drives supported agent CLI backends including Claude Code, GitHub Copilot CLI, Goose, OpenAI Codex CLI, IBM Bob, Gemini CLI and more.',
      'Routes inference through supported engines and gateways including vLLM, llm-d, LiteLLM, IBM watsonx.ai, OpenRouter, Anthropic, OpenAI and DeepSeek.',
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Hive Commons',
    url: 'https://hivecommons.dev/',
    sponsor: INFRA_SPONSORS,
    funder: INFRA_SPONSORS,
  },
]

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: '%s | Hive Commons Docs',
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: '/docs',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: `${SITE_URL}/docs`,
    siteName: 'Hive Commons',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/hive-commons-og.png',
        width: 1200,
        height: 630,
        alt: 'Hive Commons',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/hive-commons-og.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

type Props = {
  children: React.ReactNode
}

export default async function DocsLayout({ children }: Props) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(DOCS_JSON_LD) }}
        />
      </head>
      <body className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <DocsProvider>
            <div className="flex flex-col min-h-screen">
              <Suspense fallback={<div className="h-16" />}>
                <DocsNavbar />
              </Suspense>
              <div className="flex flex-1 relative">
                <MobileOverlay />
                {children}
              </div>
              <DocsFooter />
            </div>
          </DocsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

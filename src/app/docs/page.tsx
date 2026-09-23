import { redirect } from 'next/navigation'

export const dynamic = 'force-static'

export default function DocsPage() {
  redirect('/docs/hive/overview/introduction')
}

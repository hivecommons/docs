import fs from 'fs'
import path from 'path'

const DATA_PATH = path.join(process.cwd(), 'data', 'meeting-recordings.json')
const FEED_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCIA3fKJFv2nLoG6vKK65xLg'
const CHANNEL_ID = 'UCIA3fKJFv2nLoG6vKK65xLg'
const TITLE_RE = /community meeting|community call|meeting recording/i

type Recording = {
  id: string
  title: string
  publishedAt: string
  updatedAt?: string
  url: string
  thumbnail: string
  description?: string
  duration?: string
}

type Store = {
  updatedAt: string
  source: string
  channelId: string
  recordings: Recording[]
}

function textBetween(input: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(input)
  return match?.[1]?.trim()
}

function attr(input: string, tag: string, name: string): string | undefined {
  const match = new RegExp(`<${tag}[^>]*\\s${name}="([^"]+)"[^>]*>`).exec(input)
  return match?.[1]
}

function decodeXml(input = ''): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function parseFeed(xml: string): Recording[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []
  return entries.flatMap(entry => {
    const id = textBetween(entry, 'yt:videoId')
    const title = decodeXml(textBetween(entry, 'title'))
    if (!id || !title || !TITLE_RE.test(title)) return []

    return [{
      id,
      title,
      publishedAt: textBetween(entry, 'published') ?? '',
      updatedAt: textBetween(entry, 'updated'),
      url: attr(entry, 'link', 'href') ?? `https://www.youtube.com/watch?v=${id}`,
      thumbnail: attr(entry, 'media:thumbnail', 'url')?.replace('https://i1.ytimg.com/', 'https://i.ytimg.com/') ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      description: decodeXml(textBetween(entry, 'media:description')),
    }]
  })
}

function readExisting(): Store {
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as Store
  } catch {
    return { updatedAt: new Date(0).toISOString(), source: FEED_URL, channelId: CHANNEL_ID, recordings: [] }
  }
}

async function main() {
  const existing = readExisting()
  let fetched: Recording[] = []

  try {
    const response = await fetch(FEED_URL)
    if (!response.ok) throw new Error(`YouTube feed returned ${response.status}`)
    fetched = parseFeed(await response.text())
  } catch (error) {
    console.warn(`meeting recordings feed unavailable; keeping committed data: ${error instanceof Error ? error.message : String(error)}`)
  }

  const byId = new Map<string, Recording>()
  for (const recording of existing.recordings) byId.set(recording.id, recording)
  for (const recording of fetched) byId.set(recording.id, { ...byId.get(recording.id), ...recording })

  const recordings = [...byId.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  const existingStable = JSON.stringify(existing.recordings)
  const nextStable = JSON.stringify(recordings)

  if (existingStable === nextStable && existing.source === FEED_URL && existing.channelId === CHANNEL_ID) {
    console.log(`meeting recordings: ${existing.recordings.length} (unchanged)`)
    return
  }

  const next: Store = {
    updatedAt: new Date().toISOString(),
    source: FEED_URL,
    channelId: CHANNEL_ID,
    recordings,
  }

  fs.writeFileSync(DATA_PATH, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`meeting recordings: ${next.recordings.length}`)
}

void main()

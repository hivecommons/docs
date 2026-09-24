export type MeetingException = {
  date: string
  reason: string
}

export type MeetingScheduleConfig = {
  timeZone: string
  isoWeekday: number
  localTime: { hour: number; minute: number }
  durationMinutes: number
  exceptions: MeetingException[]
}

export type UpcomingMeeting = {
  date: Date
  localDate: string
}

const DATE_PARTS = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const
const MS_PER_DAY = 86_400_000

export function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => DATE_PARTS.includes(part.type as typeof DATE_PARTS[number]))
      .map(part => [part.type, Number(part.value)])
  ) as Record<typeof DATE_PARTS[number], number>

  return { ...parts, hour: parts.hour === 24 ? 0 : parts.hour }
}

export function zonedTimeToDate(date: string, hour: number, minute: number, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number)
  let utc = Date.UTC(year, month - 1, day, hour, minute)

  for (let i = 0; i < 3; i += 1) {
    const parts = getTimeZoneParts(new Date(utc), timeZone)
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0)
    utc += wanted - asUtc
  }

  return new Date(utc)
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + days))
  return next.toISOString().slice(0, 10)
}

export function isoWeekInfo(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const isoWeekday = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - isoWeekday)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7)
  return { isoYear, week, isoWeekday }
}

export function getLocalDateInTimeZone(now: Date, timeZone: string) {
  const parts = getTimeZoneParts(now, timeZone)
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-')
}

export function getUpcomingOddIsoWeekMeetings(
  config: MeetingScheduleConfig,
  count: number,
  now = new Date(),
): UpcomingMeeting[] {
  const cancelled = new Set(config.exceptions.map(item => item.date))
  const upcoming: UpcomingMeeting[] = []
  let localDate = addDays(getLocalDateInTimeZone(now, config.timeZone), -1)
  let scannedDays = 0

  while (upcoming.length < count && scannedDays < 370 * 3) {
    const info = isoWeekInfo(localDate)
    if (info.isoWeekday === config.isoWeekday && info.week % 2 === 1 && !cancelled.has(localDate)) {
      const date = zonedTimeToDate(localDate, config.localTime.hour, config.localTime.minute, config.timeZone)
      const end = date.getTime() + config.durationMinutes * 60_000
      if (end >= now.getTime()) {
        upcoming.push({ date, localDate })
      }
    }
    localDate = addDays(localDate, 1)
    scannedDays += 1
  }

  return upcoming
}

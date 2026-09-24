import { describe, expect, it } from 'vitest'
import { getUpcomingOddIsoWeekMeetings, isoWeekInfo, type MeetingScheduleConfig } from '@/lib/communityMeetingsSchedule'

const config: MeetingScheduleConfig = {
  timeZone: 'America/New_York',
  isoWeekday: 4,
  localTime: { hour: 10, minute: 0 },
  durationMinutes: 30,
  exceptions: [],
}

describe('community meeting odd ISO week recurrence', () => {
  it('treats 2026-09-24 as an odd ISO week meeting day', () => {
    expect(isoWeekInfo('2026-09-24')).toMatchObject({ isoYear: 2026, week: 39, isoWeekday: 4 })

    const [next] = getUpcomingOddIsoWeekMeetings(config, 1, new Date('2026-09-24T11:59:00Z'))
    expect(next.localDate).toBe('2026-09-24')
  })

  it('allows back-to-back meetings across ISO week 53 and week 1', () => {
    expect(isoWeekInfo('2026-12-31')).toMatchObject({ isoYear: 2026, week: 53, isoWeekday: 4 })
    expect(isoWeekInfo('2027-01-07')).toMatchObject({ isoYear: 2027, week: 1, isoWeekday: 4 })

    const meetings = getUpcomingOddIsoWeekMeetings(config, 2, new Date('2026-12-30T15:00:00Z'))
    expect(meetings.map(meeting => meeting.localDate)).toEqual(['2026-12-31', '2027-01-07'])
  })

  it('can cancel a generated odd-week date with an exception', () => {
    const meetings = getUpcomingOddIsoWeekMeetings(
      { ...config, exceptions: [{ date: '2026-12-31', reason: 'holiday break' }] },
      2,
      new Date('2026-12-30T15:00:00Z'),
    )
    expect(meetings.map(meeting => meeting.localDate)).toEqual(['2027-01-07', '2027-01-21'])
  })

  it('keeps the active meeting as next until the meeting window ends', () => {
    const [during] = getUpcomingOddIsoWeekMeetings(config, 1, new Date('2026-09-24T14:15:00Z'))
    const [after] = getUpcomingOddIsoWeekMeetings(config, 1, new Date('2026-09-24T14:31:00Z'))

    expect(during.localDate).toBe('2026-09-24')
    expect(after.localDate).toBe('2026-10-08')
  })
})

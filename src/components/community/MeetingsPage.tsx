'use client'

import { useEffect, useState } from 'react'
import recordingsData from '../../../data/meeting-recordings.json'
import { COMMUNITY_MEETINGS } from '@/config/community-meetings'
import { getUpcomingOddIsoWeekMeetings, type UpcomingMeeting } from '@/lib/communityMeetingsSchedule'

type Recording = {
  id: string
  title: string
  publishedAt: string
  url: string
  thumbnail: string
  description?: string
  duration?: string
}

const UPCOMING_COUNT = 4

function formatMeetingDate(date: Date, dateStyle: Intl.DateTimeFormatOptions['dateStyle'] = 'full') {
  return new Intl.DateTimeFormat(undefined, {
    weekday: dateStyle === 'full' ? 'long' : 'short',
    year: 'numeric',
    month: dateStyle === 'full' ? 'long' : 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: COMMUNITY_MEETINGS.timeZone,
    timeZoneName: 'short',
  }).format(date)
}

function formatLocalDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

function calendarHref(date: Date) {
  const start = date.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const end = new Date(date.getTime() + COMMUNITY_MEETINGS.durationMinutes * 60_000)
    .toISOString()
    .replace(/[-:]|\.\d{3}/g, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: COMMUNITY_MEETINGS.title,
    dates: `${start}/${end}`,
    ctz: COMMUNITY_MEETINGS.timeZone,
    details: `Agenda: ${COMMUNITY_MEETINGS.agendaUrl}\nGroup: ${COMMUNITY_MEETINGS.googleGroupUrl}\nJoin: ${COMMUNITY_MEETINGS.meetingUrl}`,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function RecordingCard({ recording, active, onPlay }: { recording: Recording; active: boolean; onPlay: () => void }) {
  const title = recording.title
  const published = new Date(recording.publishedAt)

  return (
    <article className="hc-meeting-recording">
      <div className="hc-meeting-videoShell">
        {active ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${recording.id}?autoplay=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button className="hc-meeting-videoButton" type="button" onClick={onPlay} aria-label={`Play ${title}`}>
            <img src={recording.thumbnail} alt="" loading="lazy" />
            <span className="hc-meeting-play" aria-hidden="true">▶</span>
          </button>
        )}
      </div>
      <div className="hc-meeting-recordingBody">
        <h3>{title}</h3>
        <p>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(published)}</p>
        {recording.duration ? <p>{recording.duration}</p> : null}
        <a href={COMMUNITY_MEETINGS.recordingsUrl} target="_blank" rel="noreferrer">Watch on YouTube</a>
      </div>
    </article>
  )
}

export function MeetingsPage() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null)
  const [upcoming, setUpcoming] = useState<UpcomingMeeting[]>([])
  useEffect(() => {
    setUpcoming(getUpcomingOddIsoWeekMeetings(COMMUNITY_MEETINGS, UPCOMING_COUNT))
  }, [])
  const next = upcoming[0]
  const recordings = (recordingsData.recordings as Recording[]).filter(recording =>
    new RegExp(COMMUNITY_MEETINGS.recordingTitlePattern, 'i').test(recording.title)
  )

  return (
    <div className="hc-meetings-page">
      <section className="hc-meeting-hero">
        <p className="hc-meeting-kicker">Bi-weekly community call</p>
        <h2>Meet the people building Hive Commons.</h2>
        <p>
          The Hive Commons community meeting happens on {COMMUNITY_MEETINGS.weekday}s in odd-numbered ISO weeks at{' '}
          {COMMUNITY_MEETINGS.timeLabel}. Join the Google group to receive calendar invites during the week of
          the next meeting, then use the shared agenda to add topics or notes.
        </p>
        <div className="hc-meeting-actions">
          <a className="hc-meeting-primary" href={COMMUNITY_MEETINGS.googleGroupUrl} target="_blank" rel="noreferrer">
            Join hivecommons-dev for invites
          </a>
          <a href={COMMUNITY_MEETINGS.agendaUrl} target="_blank" rel="noreferrer">Agenda and notes</a>
          <a href={COMMUNITY_MEETINGS.calendarWebUrl} target="_blank" rel="noreferrer">Public calendar</a>
        </div>
      </section>

      <section className="hc-meeting-grid" aria-label="Meeting schedule">
        <article className="hc-meeting-next">
          <p className="hc-meeting-kicker">Next meeting</p>
          {next ? (
            <>
              <h2>{formatMeetingDate(next.date)}</h2>
              <p>In your local time: {formatLocalDate(next.date)}</p>
              <div className="hc-meeting-actions">
                <a className="hc-meeting-primary" href={COMMUNITY_MEETINGS.inviteUrl} target="_blank" rel="noreferrer">Join meeting</a>
                <a href={calendarHref(next.date)} target="_blank" rel="noreferrer">Add this date</a>
              </div>
            </>
          ) : (
            <p>The next date is being calculated from the public calendar recurrence.</p>
          )}
        </article>

        <article className="hc-meeting-upcoming">
          <h2>Upcoming</h2>
          <ol>
            {upcoming.map(meeting => (
              <li key={meeting.localDate}>
                <span>{formatMeetingDate(meeting.date, 'medium')}</span>
                <small>{formatLocalDate(meeting.date)}</small>
              </li>
            ))}
          </ol>
        </article>
      </section>

      <section className="hc-meeting-details">
        <h2>How it self-sustains</h2>
        <ul>
          <li>Dates are computed in {COMMUNITY_MEETINGS.timeZone} as the meeting weekday in every odd-numbered ISO week, so DST stays correct.</li>
          <li>The source calendar is available as <a href={COMMUNITY_MEETINGS.calendarIcsUrl}>public iCal</a>.</li>
          <li>Recordings are refreshed from the Hive Commons YouTube channel feed and merged into committed JSON by a scheduled workflow.</li>
        </ul>
      </section>

      <section className="hc-meeting-recordings" aria-labelledby="recordings-heading">
        <div className="hc-meeting-sectionHead">
          <div>
            <p className="hc-meeting-kicker">Past recordings</p>
            <h2 id="recordings-heading">Watch without leaving the docs</h2>
          </div>
          <a href={COMMUNITY_MEETINGS.recordingsUrl} target="_blank" rel="noreferrer">All recordings</a>
        </div>

        {recordings.length > 0 ? (
          <div className="hc-meeting-recordingGrid">
            {recordings.map(recording => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                active={activeVideo === recording.id}
                onPlay={() => setActiveVideo(recording.id)}
              />
            ))}
          </div>
        ) : (
          <div className="hc-meeting-empty">Recordings will appear here after each meeting.</div>
        )}
      </section>
    </div>
  )
}

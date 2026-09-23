import { describe, it, expect } from 'vitest'
import {
  RADAR_AXIS_COUNT,
  RADAR_DIMENSIONS,
  computeRadarScores,
  radarPoint,
  type RadarTopicCluster,
} from '../lib/radar'

describe('RADAR_DIMENSIONS', () => {
  it('declares exactly RADAR_AXIS_COUNT dimensions', () => {
    expect(RADAR_DIMENSIONS).toHaveLength(RADAR_AXIS_COUNT)
  })

  it('keywords are lowercase so case-insensitive matching works', () => {
    for (const dim of RADAR_DIMENSIONS) {
      for (const kw of dim.keywords) {
        expect(kw).toBe(kw.toLowerCase())
      }
    }
  })
})

describe('computeRadarScores', () => {
  it('returns all zeros for empty or missing topics', () => {
    expect(computeRadarScores([])).toEqual(new Array(RADAR_AXIS_COUNT).fill(0))
    expect(
      computeRadarScores(null as unknown as RadarTopicCluster[])
    ).toEqual(new Array(RADAR_AXIS_COUNT).fill(0))
  })

  it('returns a score vector of RADAR_AXIS_COUNT normalized to [0,1]', () => {
    const scores = computeRadarScores([
      { name: 'dashboard layout', issue_count: 3 },
      { name: 'rbac auth token', issue_count: 5 },
    ])
    expect(scores).toHaveLength(RADAR_AXIS_COUNT)
    for (const s of scores) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
    expect(Math.max(...scores)).toBe(1)
  })

  it('matches topics case-insensitively', () => {
    const lower = computeRadarScores([{ name: 'dashboard', issue_count: 2 }])
    const upper = computeRadarScores([{ name: 'DASHBOARD', issue_count: 2 }])
    expect(upper).toEqual(lower)
  })

  it('scores a security-only topic on the Security axis, not Dashboard', () => {
    const securityIdx = RADAR_DIMENSIONS.findIndex((d) => d.label === 'Security')
    const dashboardIdx = RADAR_DIMENSIONS.findIndex((d) => d.label === 'Dashboard')
    const scores = computeRadarScores([{ name: 'rbac', issue_count: 4 }])
    expect(scores[securityIdx]).toBe(1)
    expect(scores[dashboardIdx]).toBe(0)
  })

  it('weights dimensions by issue_count and match strength', () => {
    const testingIdx = RADAR_DIMENSIONS.findIndex((d) => d.label === 'Testing')
    const scores = computeRadarScores([
      { name: 'coverage', issue_count: 10 },
      { name: 'rbac', issue_count: 1 },
    ])
    // Testing dominates, so it normalizes to 1 and Security is fractional.
    expect(scores[testingIdx]).toBe(1)
    const securityIdx = RADAR_DIMENSIONS.findIndex((d) => d.label === 'Security')
    expect(scores[securityIdx]).toBeCloseTo(0.1, 5)
  })

  it('handles topics matching no dimension without dividing by zero', () => {
    const scores = computeRadarScores([{ name: 'zzzz-unmatched', issue_count: 100 }])
    expect(scores).toEqual(new Array(RADAR_AXIS_COUNT).fill(0))
  })

  it('splits multi-word topic names on whitespace and commas', () => {
    const testingIdx = RADAR_DIMENSIONS.findIndex((d) => d.label === 'Testing')
    const scores = computeRadarScores([
      { name: 'e2e,playwright coverage', issue_count: 1 },
    ])
    expect(scores[testingIdx]).toBe(1)
  })
})

describe('radarPoint', () => {
  const CENTER = 100
  const RADIUS = 50

  it('places axis 0 straight up from the center', () => {
    const p = radarPoint(0, 1, RADIUS, CENTER)
    expect(p.x).toBeCloseTo(CENTER, 5)
    expect(p.y).toBeCloseTo(CENTER - RADIUS, 5)
  })

  it('a zero score sits at the center regardless of axis', () => {
    for (let axis = 0; axis < RADAR_AXIS_COUNT; axis++) {
      const p = radarPoint(axis, 0, RADIUS, CENTER)
      expect(p.x).toBeCloseTo(CENTER, 5)
      expect(p.y).toBeCloseTo(CENTER, 5)
    }
  })

  it('scales linearly with score', () => {
    const full = radarPoint(2, 1, RADIUS, CENTER)
    const half = radarPoint(2, 0.5, RADIUS, CENTER)
    expect(half.x - CENTER).toBeCloseTo((full.x - CENTER) / 2, 5)
    expect(half.y - CENTER).toBeCloseTo((full.y - CENTER) / 2, 5)
  })

  it('all full-score points lie on the circle of the given radius', () => {
    for (let axis = 0; axis < RADAR_AXIS_COUNT; axis++) {
      const p = radarPoint(axis, 1, RADIUS, CENTER)
      const dist = Math.hypot(p.x - CENTER, p.y - CENTER)
      expect(dist).toBeCloseTo(RADIUS, 5)
    }
  })

  it('axis RADAR_AXIS_COUNT wraps around to axis 0', () => {
    const p0 = radarPoint(0, 1, RADIUS, CENTER)
    const pWrap = radarPoint(RADAR_AXIS_COUNT, 1, RADIUS, CENTER)
    expect(pWrap.x).toBeCloseTo(p0.x, 5)
    expect(pWrap.y).toBeCloseTo(p0.y, 5)
  })
})

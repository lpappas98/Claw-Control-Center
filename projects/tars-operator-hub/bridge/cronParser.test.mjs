import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'
import { CronParser } from './cronParser.mjs'

describe('CronParser', () => {
  describe('parse', () => {
    it('should parse valid cron expressions', () => {
      const result = CronParser.parse('0 9 * * *')
      assert.ok(result.minute.has(0))
      assert.ok(result.hour.has(9))
    })

    it('should throw on invalid field count', () => {
      assert.throws(() => CronParser.parse('0 9 *'), /must have 5 fields/)
    })

    it('should throw on empty string', () => {
      assert.throws(() => CronParser.parse(''), /non-empty string/)
    })

    it('should parse asterisk as all values', () => {
      const result = CronParser.parse('* * * * *')
      assert.equal(result.minute.size, 60)
      assert.equal(result.hour.size, 24)
      assert.equal(result.day.size, 31)
      assert.equal(result.month.size, 12)
      assert.equal(result.weekday.size, 7)
    })

    it('should parse step expressions', () => {
      const result = CronParser.parse('*/15 * * * *')
      assert.ok(result.minute.has(0))
      assert.ok(result.minute.has(15))
      assert.ok(result.minute.has(30))
      assert.ok(result.minute.has(45))
    })

    it('should parse range expressions', () => {
      const result = CronParser.parse('0 9-17 * * *')
      assert.equal(result.hour.size, 9)
      assert.ok(result.hour.has(9))
      assert.ok(result.hour.has(17))
    })

    it('should parse list expressions', () => {
      const result = CronParser.parse('0 9,12,17 * * *')
      assert.equal(result.hour.size, 3)
      assert.ok(result.hour.has(9))
      assert.ok(result.hour.has(12))
      assert.ok(result.hour.has(17))
    })

    it('should parse day of week', () => {
      const result = CronParser.parse('0 9 * * 1-5')
      assert.equal(result.weekday.size, 5)
      assert.ok(result.weekday.has(1))
      assert.ok(result.weekday.has(5))
      assert.ok(!result.weekday.has(0))
      assert.ok(!result.weekday.has(6))
    })

    it('should parse combined step and range', () => {
      const result = CronParser.parse('*/30 */4 * * *')
      assert.ok(result.minute.has(0))
      assert.ok(result.minute.has(30))
      assert.ok(result.hour.has(0))
      assert.ok(result.hour.has(4))
      assert.ok(result.hour.has(8))
    })
  })

  describe('nextRun', () => {
    it('should calculate next daily run', () => {
      const now = new Date('2026-02-14T08:30:00Z')
      const next = CronParser.nextRun('0 9 * * *', now)
      assert.equal(next.getHours(), 9)
      assert.equal(next.getMinutes(), 0)
      assert.equal(next.getSeconds(), 0)
    })

    it('should skip to next day if time has passed', () => {
      const now = new Date('2026-02-14T10:00:00Z')
      const next = CronParser.nextRun('0 9 * * *', now)
      assert.equal(next.getDate(), 15)
    })

    it('should handle every hour', () => {
      const now = new Date('2026-02-14T10:30:00Z')
      const next = CronParser.nextRun('0 * * * *', now)
      assert.equal(next.getHours(), 11)
      assert.equal(next.getMinutes(), 0)
    })

    it('should handle every N minutes', () => {
      const now = new Date('2026-02-14T10:05:00Z')
      const next = CronParser.nextRun('*/15 * * * *', now)
      assert.equal(next.getMinutes(), 15)
    })

    it('should handle weekday restrictions', () => {
      const mondayNoon = new Date('2026-02-16T12:00:00Z')
      const next = CronParser.nextRun('0 12 * * 1-5', mondayNoon)
      const weekday = next.getDay()
      assert.ok(weekday >= 1 && weekday <= 5)
    })

    it('should use current time if no reference given', () => {
      const next = CronParser.nextRun('0 * * * *')
      assert.ok(next instanceof Date)
      assert.ok(next.getTime() > Date.now())
    })

    it('should round down to minute precision', () => {
      const now = new Date('2026-02-14T10:05:37.123Z')
      const next = CronParser.nextRun('0 * * * *', now)
      assert.equal(next.getSeconds(), 0)
      assert.equal(next.getMilliseconds(), 0)
    })
  })

  describe('matches', () => {
    it('should match exact time', () => {
      const time = new Date('2026-02-14T09:00:00Z')
      assert.ok(CronParser.matches('0 9 * * *', time))
    })

    it('should not match wrong hour', () => {
      const time = new Date('2026-02-14T10:00:00Z')
      assert.ok(!CronParser.matches('0 9 * * *', time))
    })

    it('should match weekday constraint', () => {
      const monday = new Date('2026-02-16T12:00:00Z')
      assert.ok(CronParser.matches('0 12 * * 1', monday))
    })

    it('should not match non-matching weekday', () => {
      const sunday = new Date('2026-02-15T12:00:00Z')
      assert.ok(!CronParser.matches('0 12 * * 1-5', sunday))
    })
  })

  describe('describe', () => {
    it('should generate human-readable descriptions', () => {
      const desc = CronParser.describe('0 9 * * *')
      assert.ok(desc.includes('9'))
      assert.ok(desc.includes('0'))
    })

    it('should describe daily cron', () => {
      const desc = CronParser.describe('0 9 * * *')
      assert.ok(typeof desc === 'string')
      assert.ok(desc.length > 0)
    })

    it('should describe multiple hours', () => {
      const desc = CronParser.describe('0 9,12,17 * * *')
      assert.ok(desc.includes('9') || desc.includes('12') || desc.includes('17'))
    })
  })

  describe('common patterns', () => {
    it('should parse daily 9am', () => {
      const result = CronParser.parse('0 9 * * *')
      assert.ok(result.minute.has(0))
      assert.ok(result.hour.has(9))
      assert.equal(result.day.size, 31)
      assert.equal(result.month.size, 12)
      assert.equal(result.weekday.size, 7)
    })

    it('should parse every Monday at 9am', () => {
      const result = CronParser.parse('0 9 * * 1')
      assert.equal(result.weekday.size, 1)
      assert.ok(result.weekday.has(1))
    })

    it('should parse every 2 hours', () => {
      const result = CronParser.parse('0 */2 * * *')
      assert.equal(result.hour.size, 12)
    })

    it('should parse first day of month at 9am', () => {
      const result = CronParser.parse('0 9 1 * *')
      assert.equal(result.day.size, 1)
      assert.ok(result.day.has(1))
    })

    it('should parse December 25 at 6pm', () => {
      const result = CronParser.parse('0 18 25 12 *')
      assert.ok(result.day.has(25))
      assert.ok(result.month.has(12))
      assert.ok(result.hour.has(18))
    })
  })

  describe('error handling', () => {
    it('should throw on invalid minute value', () => {
      assert.throws(() => CronParser.parse('60 * * * *'), /Invalid value/)
    })

    it('should throw on invalid hour value', () => {
      assert.throws(() => CronParser.parse('0 24 * * *'), /Invalid value/)
    })

    it('should throw on invalid step', () => {
      assert.throws(() => CronParser.parse('*/0 * * * *'), /Invalid step/)
    })

    it('should throw on invalid range', () => {
      assert.throws(() => CronParser.parse('0 17-9 * * *'), /Invalid range/)
    })

    it('should throw on non-numeric value', () => {
      assert.throws(() => CronParser.parse('abc * * * *'), /Invalid value/)
    })
  })
})

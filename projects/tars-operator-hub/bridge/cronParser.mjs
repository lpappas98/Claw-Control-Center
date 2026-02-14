/**
 * Cron Expression Parser & Next Run Calculator
 * Supports 5-field cron expressions: minute hour day month weekday
 */

export class CronParser {
  /**
   * Parse a cron expression and validate it
   * @param {string} expression - Cron expression (5 fields)
   * @throws {Error} if invalid
   * @returns {{minute, hour, day, month, weekday}}
   */
  static parse(expression) {
    if (!expression || typeof expression !== 'string') {
      throw new Error('Cron expression must be a non-empty string')
    }

    const fields = expression.trim().split(/\s+/)
    if (fields.length !== 5) {
      throw new Error('Cron expression must have 5 fields: minute hour day month weekday')
    }

    const [minField, hourField, dayField, monthField, weekdayField] = fields

    return {
      minute: this.parseField(minField, 0, 59, 'minute'),
      hour: this.parseField(hourField, 0, 23, 'hour'),
      day: this.parseField(dayField, 1, 31, 'day'),
      month: this.parseField(monthField, 1, 12, 'month'),
      weekday: this.parseField(weekdayField, 0, 6, 'weekday'), // 0 = Sunday
    }
  }

  /**
   * Parse a single field in a cron expression
   * @param {string} field
   * @param {number} min
   * @param {number} max
   * @param {string} fieldName
   * @returns {Set<number>}
   */
  static parseField(field, min, max, fieldName) {
    const set = new Set()

    if (field === '*') {
      for (let i = min; i <= max; i++) {
        set.add(i)
      }
      return set
    }

    if (field.includes('/')) {
      const [baseField, step] = field.split('/')
      const stepNum = parseInt(step, 10)
      
      if (isNaN(stepNum) || stepNum <= 0) {
        throw new Error(`Invalid step in ${fieldName}: ${field}`)
      }

      let start = min
      if (baseField !== '*') {
        start = parseInt(baseField, 10)
        if (isNaN(start) || start < min || start > max) {
          throw new Error(`Invalid range start in ${fieldName}: ${field}`)
        }
      }

      for (let i = start; i <= max; i += stepNum) {
        set.add(i)
      }
      return set
    }

    if (field.includes('-')) {
      const [startStr, endStr] = field.split('-')
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
        throw new Error(`Invalid range in ${fieldName}: ${field}`)
      }

      for (let i = start; i <= end; i++) {
        set.add(i)
      }
      return set
    }

    if (field.includes(',')) {
      const parts = field.split(',')
      for (const part of parts) {
        const num = parseInt(part.trim(), 10)
        if (isNaN(num) || num < min || num > max) {
          throw new Error(`Invalid value in ${fieldName}: ${part}`)
        }
        set.add(num)
      }
      return set
    }

    const num = parseInt(field, 10)
    if (isNaN(num) || num < min || num > max) {
      throw new Error(`Invalid value in ${fieldName}: ${field}`)
    }
    set.add(num)

    return set
  }

  /**
   * Calculate the next run time from a cron expression and optional reference time
   * @param {string} expression - Cron expression
   * @param {Date|number} [fromTime] - Start from this time (default: now)
   * @returns {Date} Next run time
   */
  static nextRun(expression, fromTime = null) {
    const parsed = this.parse(expression)
    
    let current = fromTime ? new Date(fromTime) : new Date()
    current.setSeconds(0)
    current.setMilliseconds(0)

    // Increment by 1 minute to ensure we don't pick the same minute
    current = new Date(current.getTime() + 60000)

    // Search up to 4 years in the future
    const maxIterations = 4 * 365 * 24 * 60
    let iterations = 0

    while (iterations < maxIterations) {
      const minute = current.getMinutes()
      const hour = current.getHours()
      const day = current.getDate()
      const month = current.getMonth() + 1
      const weekday = current.getDay()

      if (
        parsed.minute.has(minute) &&
        parsed.hour.has(hour) &&
        parsed.day.has(day) &&
        parsed.month.has(month) &&
        parsed.weekday.has(weekday)
      ) {
        return new Date(current)
      }

      current = new Date(current.getTime() + 60000)
      iterations++
    }

    throw new Error('Could not calculate next run time within reasonable time frame')
  }

  /**
   * Check if a given time matches a cron expression
   * @param {string} expression - Cron expression
   * @param {Date|number} time - Time to check
   * @returns {boolean}
   */
  static matches(expression, time) {
    const parsed = this.parse(expression)
    const date = new Date(time)

    const minute = date.getMinutes()
    const hour = date.getHours()
    const day = date.getDate()
    const month = date.getMonth() + 1
    const weekday = date.getDay()

    return (
      parsed.minute.has(minute) &&
      parsed.hour.has(hour) &&
      parsed.day.has(day) &&
      parsed.month.has(month) &&
      parsed.weekday.has(weekday)
    )
  }

  /**
   * Get human-readable description of a cron expression
   * @param {string} expression
   * @returns {string}
   */
  static describe(expression) {
    const parsed = this.parse(expression)

    const describeSet = (set, min, max, names = null) => {
      if (set.size === max - min + 1) return 'every'
      if (set.size === 1) {
        const val = Array.from(set)[0]
        return names ? names[val] : String(val)
      }
      const arr = Array.from(set).sort((a, b) => a - b)
      if (names) return arr.map(v => names[v]).join(', ')
      return arr.join(', ')
    }

    const minutes = describeSet(parsed.minute, 0, 59)
    const hours = describeSet(parsed.hour, 0, 23)
    const days = describeSet(parsed.day, 1, 31)
    const months = describeSet(parsed.month, 1, 12, {
      1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
      7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
    })
    const weekdays = describeSet(parsed.weekday, 0, 6, {
      0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat'
    })

    return `At ${minutes}:${hours} on day ${days} of ${months} (${weekdays})`
  }
}

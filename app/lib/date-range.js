function pad2 (n) {
  return String(n).padStart(2, '0')
}

function toDateString (date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function startOfMonth ({ year, month }) {
  return new Date(year, month, 1)
}

function endOfMonth ({ year, month }) {
  return new Date(year, month + 1, 0)
}

function currentMonth () {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() }
}

// "2026-07" -> { year: 2026, month: 6 }, zero-indexed to match Date. Returns null for
// anything malformed, so callers can fall back to the current month.
function parseMonthParam (value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null
  const [year, monthNumber] = value.split('-').map(Number)
  if (monthNumber < 1 || monthNumber > 12) return null
  return { year, month: monthNumber - 1 }
}

function monthKey ({ year, month }) {
  return `${year}-${pad2(month + 1)}`
}

function monthLabel ({ year, month }) {
  return new Date(year, month, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function shiftMonths ({ year, month }, delta) {
  const date = new Date(year, month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

function listRecentMonths (count, from = currentMonth()) {
  const months = []
  let cursor = from
  for (let i = 0; i < count; i++) {
    months.push(cursor)
    cursor = shiftMonths(cursor, -1)
  }
  return months
}

module.exports = {
  toDateString,
  startOfMonth,
  endOfMonth,
  currentMonth,
  parseMonthParam,
  monthKey,
  monthLabel,
  shiftMonths,
  listRecentMonths
}

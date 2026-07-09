function formatDate (isoString) {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('en-GB', { month: 'short' })
  const year = String(date.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

function formatDateTime (isoString) {
  if (!isoString) return 'Unknown'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${formatDate(isoString)} ${hours}:${minutes}`
}

function formatMonth (yyyyMm) {
  if (!yyyyMm) return 'Unknown'
  const [year, month] = yyyyMm.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return `${date.toLocaleString('en-GB', { month: 'short' })}-${year.slice(-2)}`
}

module.exports = { formatDate, formatDateTime, formatMonth }

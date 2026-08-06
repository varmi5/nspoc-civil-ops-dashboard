const STATUS = {
  LIVE: 'live',
  UNAVAILABLE: 'unavailable',
  NOT_CONNECTED: 'not-connected'
}

const PRECEDENCE = [STATUS.NOT_CONNECTED, STATUS.UNAVAILABLE, STATUS.LIVE]

// Combines several sub-fetch statuses into one page-level status: not-connected beats
// unavailable beats live, so a page is only "live" once every one of its sources is.
function worstStatus (...statuses) {
  return PRECEDENCE.find((candidate) => statuses.includes(candidate)) || STATUS.LIVE
}

module.exports = { STATUS, worstStatus }

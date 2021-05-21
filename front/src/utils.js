// deepcopy for JSON-ifiables, but faster than JSON.parse . JSON.stringify
const cpy = (x) => {
  if (typeof x === "object") {
    if (x instanceof Array) {
      return x.map(cpy)
    } else {
      const result = {}
      for (let key in x) {
        result[key] = cpy(x[key])
      }
      return result
    }
  } else return x
}

let formatDate, unFormatDate
{
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const getOrdinal = (i) => {
    const j = i % 10,
      k = i % 100
    if (j == 1 && k != 11) return i + "st"
    if (j == 2 && k != 12) return i + "nd"
    if (j == 3 && k != 13) return i + "rd"
    return i + "th"
  }

  formatDate = (date) =>
    `${monthNames[date.getMonth()]} ${getOrdinal(
      date.getDate()
    )}, ${date.getFullYear()}`

  unFormatDate = (string) => {
    const match = string.match(/([a-zA-Z]+) ([0-9]{1,2})(?:st|nd|rd|th), ([0-9]{4})/)
    if (match && monthNames.includes(match[1])) {
      return new Date()
    }
  }
}

const formatTime = (date) => {
  return date.getHours() + ":" + date.getMinutes()
}

// const formatDateId = (date) => `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`
const formatDateYMD = (date) => `${date.getFullYear()}-${formatInt(date.getMonth() + 1, 2)}-${formatInt(date.getDate(), 2)}`

const truncateElipsis = (text, limit = 40) => {
  if (text.length > limit)
    return text.substring(0, limit - 3) + "..."
  return text
}

const getTomorrowDateString = () => {
  return formatDate(new Date(Date.now() + 86400000))
}

const getYesterdayDateString = () => {
  return formatDate(new Date(Date.now() - 86400000))
}

const getLastWeekDateString = () => {
  const obj = new Date(Date.now())
  obj.setDate(obj.getDate() - 7)
  return formatDate(obj)
}

const getNextWeekDateString = () => {
  const obj = new Date(Date.now())
  obj.setDate(obj.getDate() + 7)
  return formatDate(obj)
}

const formatInt = (int, digits) => {
  const raw = int.toString()
  return ("0".repeat(digits - raw.length) + raw)
}

const clamp = (x, min, max) => Math.max(min, Math.min(x, max))


// firefox rounds to 1ms. rounding is supposedly to protect against Specter and related vulnerabilities
const ustime = () => {
  const p = Math.floor((performance.timing.navigationStart + performance.now()) * 1000)
  console.log(p)
  return p
}

const pushToArrInObj = (obj, key, val) => {
  if (obj[key] === undefined) {
    obj[key] = [val]
  } else obj[key].push(val)
}

const kebabToCamel = (str) =>
  str.replaceAll(/-([a-z])/g, (_match, letter) => letter.toUpperCase())

const camelToKebab = (str) =>
  str.replaceAll(/([a-z])([A-Z])/g, (_match, lower, upper) => lower + "-" + upper.toLowerCase())

const stripWhitespace = (str) => {
  const startMatch = str.match(/^[ \t\r\n]+/)
  const endMatch = str.match(/[ \t\r\n]+$/)
  const startIdx = startMatch ? startMatch[0].length : 0
  const endIdx = endMatch ? endMatch[0].length : str.length
  return str.substring(startIdx, endIdx)
}

const shuffle = (arr) => {
  for (let i = 0; i < arr.length; i++) {
    const sidx = i + Math.floor(Math.random() * (arr.length - i))
    const tmp = arr[i]
    arr[i] = arr[sidx]
    arr[sidx] = tmp
  }
}
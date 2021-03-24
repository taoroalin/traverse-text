const CHARS_64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFJHIJKLMNOPQRSTUVWXYZ"
const CHARS_16 = "0123456789ABCDEF"

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

const formatDate = (date) =>
  `${monthNames[date.getMonth()]} ${getOrdinal(
    date.getDate()
  )}, ${date.getFullYear()}`

const formatTime = (date) => {
  return date.getHours() + ":" + date.getMinutes()
}

const unFormatDate = (string) => {
  const match = string.match(/([a-zA-Z]+) ([0-9]{1,2})(?:st|nd|rd|th), ([0-9]{4})/)
  if (match && monthNames.includes(match[1])) {
    return new Date()
  }
}

// const formatDateId = (date) => `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`
const formatDateYMD = (date) => `${date.getFullYear()}-${formatInt(date.getMonth() + 1, 2)}-${formatInt(date.getDate(), 2)}`

const truncateElipsis = (text, limit = 40) => {
  if (text.length > limit) {
    return text.substring(0, limit - 3) + "..."
  }
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


// this is v slow, 7M dates / s
// not using bit shifts here because this needs to work with 64 bit ints and JS doesn't expose 64 bit bit-shifts
const intToBase64 = (int) => {
  if (int === undefined) return
  let str = ""
  while (int > 0) {
    str = "" + CHARS_64[int % 64] + str
    int = Math.floor(int / 64)
  }
  return str
}

const base64ToInt = (str) => {
  let result = 0
  for (let i = 0; i < str.length; i++) {
    result += CHARS_64.indexOf(str[i]) * Math.pow(64, (str.length - i - 1))
  }
  return result
}

// console.log(intToBase64(Date.now()))
// console.log(Date.now())
// console.log(base64ToInt(intToBase64(Date.now())))

// firefox rounds to 1ms. rounding is supposedly to protect against Specter and related vulnerabilities
const ustime = () => {
  const p = Math.floor((performance.timing.navigationStart + performance.now()) * 1000)
  console.log(p)
  return p
}

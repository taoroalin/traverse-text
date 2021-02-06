// idk whether this is "random enough"
// it is highly performance inneficient but i don't need to call this many times
const chars64 = "-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFJHIJKLMNOPQRSTUVWXYZ"
const createUID = () => {
  result = ""
  for (let i = 0; i < 9; i++) {
    result += chars64[Math.floor(Math.random() * 64)]
  }
  return result
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

const truncateElipsis = (text,limit = 40) => {
  if (text.length > limit) {
    return text.substring(0,limit - 3) + "..."
  }
  return text
}

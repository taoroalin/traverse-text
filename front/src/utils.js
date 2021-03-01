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

const unFormatDate = (string) => {
  const match = string.match(/([a-zA-Z]+) ([0-9]{1,2})(?:st|nd|rd|th), ([0-9]{4})/)
  if (match && monthNames.includes(match[1])) {
    return new Date()
  }
}

const truncateElipsis = (text,limit = 40) => {
  if (text.length > limit) {
    return text.substring(0,limit - 3) + "..."
  }
  return text
}

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
];

const getOrdinal = (number) => {
  if (number === 1) return number + "st";
  if (number === 2) return number + "nd";
  if (number === 3) return number + "rd";
  return number + "th";
};

const formatDate = (date) =>
  `${monthNames[date.getMonth()]} ${getOrdinal(
    date.getDate()
  )}, ${date.getFullYear()}`;



const inlineCommandReplaceString = (string, offset = 0) => {
  sessionState.position = editingCommandElement.firstChild.startIdx + string.length + offset
  editingCommandElement.innerText = string
  setFocusedBlockString(focusBlockBody.innerText)
}

// inline commands are completely different than commands. They're things the user can do to the current block they're editing
const inlineCommands = {
  todo: () => {
    const position = editingCommandElement.firstChild.startIdx + 8
    editingCommandElement.remove()
    let string = focusBlockBody.innerText
    string = "[[TODO]]" + string
    sessionState.position = position
    setFocusedBlockString(string)
  },
  "page link": () => {
    inlineCommandReplaceString("[[]]", -2)
  },
  today: () => {
    inlineCommandReplaceString("[[" + formatDate(new Date(Date.now())) + "]]")
  },
  "current time": () => {
    const now = new Date(Date.now())
    inlineCommandReplaceString(formatTime(now))
  },
  tomorrow: () => {
    inlineCommandReplaceString("[[" + getTomorrowDateString() + "]]")
  },
  yesterday: () => {
    inlineCommandReplaceString("[[" + getYesterdayDateString() + "]]")
  },
  "next week": () => {
    inlineCommandReplaceString("[[" + getNextWeekDateString() + "]]")
  },
  "last week": () => {
    inlineCommandReplaceString("[[" + getLastWeekDateString() + "]]")
  },
  bold: () => {
    inlineCommandReplaceString("****", -2)
  },
  italic: () => {
    inlineCommandReplaceString("____", -2)
  },
  highlight: () => {
    inlineCommandReplaceString("^^^^", -2)
  }
}

let commandSearchCache = []
const matchInlineCommand = (string) => {
  commandSearchCache = []
  let regex
  try {
    regex = newSearchRegex(string)
  } catch (e) {
    return commandSearchCache
  }
  for (let command in inlineCommands) {
    if (command.match(regex)) {
      commandSearchCache.push({ string: command })
    }
  }
  return commandSearchCache
}

const execInlineCommand = () => {
  inlineCommandList.style.display = "none"
  inlineCommands[focusSuggestion.dataset.string]()
}

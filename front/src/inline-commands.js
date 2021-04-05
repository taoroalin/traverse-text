

const inlineCommandReplaceString = (string, offset = 0) => {
  sessionState.position = editingCommandElement.firstChild.startIdx + string.length + offset
  editingCommandElement.innerText = string
  setFocusedBlockString(focusBlockBody.innerText)
}

const inlineCommandPrefixString = (prefix, removeRegex = undefined) => {
  let position = editingCommandElement.startIdx + prefix.length
  editingCommandElement.remove()
  let string = focusBlockBody.innerText // @removeinnertext
  if (removeRegex) {
    const match = string.match(removeRegex)
    if (match) {
      string = string.substring(match[0].length)
      position -= match[0].length
    }
  }
  string = prefix + string
  sessionState.position = position
  setFocusedBlockString(string)
}

// inline commands are completely different than commands. They're things the user can do to the current block they're editing
const inlineCommands = {
  TODO: () => {
    inlineCommandPrefixString("{{#TODO}}", /^{{(#TODO|#DONE|\[\[TODO\]\]|\[\[DONE\]\])}}/)
  },
  "page link": () => {
    inlineCommandReplaceString("[[]]", -2)
  },
  today: () => {
    inlineCommandReplaceString("[[" + formatDate(new Date(Date.now())) + "]]")
  },
  video: () => {
    inlineCommandReplaceString("{{#video: }}", -2)
  },
  query: () => {
    inlineCommandReplaceString("{{#query: }}", -2)
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
  "header 1": () => {
    inlineCommandPrefixString("# ", /^#{1,3} /)
  },
  "header 2": () => {
    inlineCommandPrefixString("## ", /^#{1,3} /)
  },
  "header 3": () => {
    inlineCommandPrefixString("### ", /^#{1,3} /)
  },
  bold: () => {
    inlineCommandReplaceString("****", -2)
  },
  italic: () => {
    inlineCommandReplaceString("____", -2)
  },
  highlight: () => {
    inlineCommandReplaceString("^^^^", -2)
  },
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

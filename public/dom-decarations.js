const getTemp = (str) => document.getElementById(str).content.firstElementChild

// Templates
const pageTemplate = getTemp("page")
const blockTemplate = getTemp("block")
const backrefsListTemplate = getTemp("backrefs-list")
const blockFocusFrameTemplate = getTemp("block-focus-frame")
const pageBreakTemplate = getTemp("page-break")
const suggestionTemplate = getTemp("autocomplete__suggestion")
const searchResultTemplate = getTemp("search-result")

// Block parsing Templates
const pageRefTemplate = getTemp("page-ref")
const tagTemplate = getTemp("tag")
const urlTemplate = getTemp("url")
const blockRefTemplate = getTemp("block-ref")
const boldTemplate = getTemp("bold")
const italicTemplate = getTemp("italic")
const highlightTemplate = getTemp("highlight")
const literalTemplate = getTemp("literal")

// Singleton elements
const pageFrame = document.getElementById("page-frame")
const pageFrameOuter = document.getElementById("page-frame-outer")
const searchInput = document.getElementById("search-input")
const downloadButton = document.getElementById("download-button")
const autocompleteList = document.getElementById("autocomplete-list")
const terminalElement = document.getElementById("terminal")
const searchResultList = document.getElementById("search-result-list")


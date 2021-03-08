let editingTemplateExpander = null

let editingLink = null
let editingTitle = null
let focusNode = null
let focusOffset = null

let focusBlock = null

let focusSuggestion = null
let focusSearchResult = null

let sessionState = { pageFrame: "dailyNotes",focusId: null,scroll: 0,position: null }

let dragSelectStartBlock = null
let dragSelect = null

let clipboardData = null

const SEARCH_RESULT_LENGTH = 12


// Singleton elements
const pageFrame = document.getElementById("page-frame")
const pageFrameOuter = document.getElementById("page-frame-outer")
const searchInput = document.getElementById("search-input")
const downloadButton = document.getElementById("download-button")
const terminalElement = document.getElementById("terminal")

const searchResultList = document.getElementById("search-result-list")
searchResultList.dataset.templateName = "search-result"

const autocompleteList = document.getElementById("autocomplete-list")
autocompleteList.dataset.templateName = "autocomplete__suggestion"

const templateList = document.getElementById("template-list")
templateList.dataset.templateName = "template__suggestion"

const switchToLogin = document.getElementById("switch-to-login")
const switchToSignup = document.getElementById("switch-to-signup")
const signupElement = document.getElementById("signup")
const signupButton = document.getElementById("signup-button")
const loginElement = document.getElementById("login")

const getTemp = (str) => document.getElementById(str).content.firstElementChild

// Templates
const pageTemplate = getTemp("page")
const blockTemplate = getTemp("block")
const backrefListTemplate = getTemp("backref-list")
const blockFocusFrameTemplate = getTemp("block-focus-frame")
const pageBreakTemplate = getTemp("page-break")
const suggestionTemplate = getTemp("autocomplete__suggestion")
const searchResultTemplate = getTemp("search-result")
const templateSuggestionTemplate = getTemp("template__suggestion")
const breadcrumbBlockTemplate = getTemp("breadcrumb-block")
const breadcrumbPageTemplate = getTemp("breadcrumb-page")
const backrefFrameTemplate = getTemp("backref-frame")
const notificationTemplate = getTemp("notification")

// Block parsing Templates
const pageRefTemplate = getTemp("page-ref")

// login/signup
const loginForm = document.getElementById("login-form")
const loginEmailElement = document.getElementById("login-email")
const loginPasswordElement = document.getElementById("login-password")
const signupForm = document.getElementById("signup-form")

const signupUsernameElement = document.getElementById("signup-username")
const signupEmailElement = document.getElementById("signup-email")
const signupPasswordElement = document.getElementById("signup-password")

// de-OOP-ing apis
const textEncoder = new TextEncoder()

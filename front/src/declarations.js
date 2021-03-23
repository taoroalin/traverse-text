// Cursor info. Raw info stored in JSON, DOM elements cached in lots of random vars
let sessionState = { pageFrame: "dailyNotes", focusId: null, scroll: 0, position: null }

// these two stored for re-focusing dom nodes after they're moved
let focusNode = null
let focusOffset = null

// accessing current block
let focusBlock = null
let focusBlockBody = null

// accessing current editing spans
let editingTemplateExpander = null
let editingCommandElement = null
let editingLink = null
let editingTitle = null

let focusSuggestion = null

let dragSelectStartBlock = null
let dragSelect = null
let clipboardData = null


const SEARCH_RESULT_LENGTH = 12

const elById = (str) => document.getElementById(str)
const getTemp = (str) => elById(str).content.firstElementChild

// Singleton elements
const pageFrame = elById("page-frame")
const pageFrameOuter = elById("page-frame-outer")
const searchInput = elById("search-input")
const downloadButton = elById("download-button")
const terminalElement = elById("terminal")

const searchResultList = elById("search-result-list")
searchResultList.dataset.templateName = "search-result"

const autocompleteList = elById("autocomplete-list")
autocompleteList.dataset.templateName = "autocomplete__suggestion"

const inlineCommandList = elById("command-list")
inlineCommandList.dataset.templateName = "command__suggestion"

const templateList = elById("template-list")
templateList.dataset.templateName = "template__suggestion"

const switchToLogin = elById("switch-to-login")
const switchToSignup = elById("switch-to-signup")
const signupElement = elById("signup")
const signupButton = elById("signup-button")
const loginElement = elById("login")

const signOutButton = elById("signout-button")
const reallyWantToLeaveElement = elById("really-want-to-leave")

const uploadInput = elById('upload-input')

const appElement = elById('app')


// Templates
const pageTemplate = getTemp("page")
const blockTemplate = getTemp("block")
const backrefListTemplate = getTemp("backref-list")
const blockFocusFrameTemplate = getTemp("block-focus-frame")
const searchResultTemplate = getTemp("search-result")
const breadcrumbBlockTemplate = getTemp("breadcrumb-block")
const breadcrumbPageTemplate = getTemp("breadcrumb-page")
const backrefFrameTemplate = getTemp("backref-frame")
const notificationTemplate = getTemp("notification")

// Block parsing Templates
const pageRefTemplate = getTemp("page-ref")
const imageEmbedTemplate = getTemp("image-embed")
const computeFailedTemplate = getTemp("compute-failed")
const todoCheckboxTemplate = getTemp("todo-checkbox")
const videoEmbedTemplate = getTemp("video-embed")

// login/signup
const loginForm = elById("login-form")
const loginEmailElement = elById("login-email")
const loginPasswordElement = elById("login-password")
const signupForm = elById("signup-form")

const signupUsernameElement = elById("signup-username")
const signupEmailElement = elById("signup-email")
const signupPasswordElement = elById("signup-password")

const textEncoder = new TextEncoder()

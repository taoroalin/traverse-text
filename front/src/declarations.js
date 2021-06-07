let store = null
let user = null
let sessionState = null
let otherStores = {}
let masterCommitInProgress = []

const nodeJsServerUrl = location.protocol + "//" + location.hostname + ":8756"
const goServerUrl = location.protocol + "//" + location.hostname + ":3000"

//~frontskip
document.title = "Local Traverse Text"
//~


let editInFlight = false

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

let focusSuggestion = null

let dragSelectStartBlock = null
let dragSelect = null
let clipboardData = null


const SEARCH_RESULT_LENGTH = 12
const UNDO_EDITS_TO_KEEP = 50
const UNDO_EDITS_SLACK = 20
const SAVE_DEBOUNCE = 150

const textEncoder = new TextEncoder()

let applyUserSettingsToDom = null
const allHtml = `<div id="app">
  <div id="top-bar" style="margin-top:-43px">
    <div id="top-bar-left">
      
    </div>
    <input id="search-input" placeholder="search" tabindex="-1">
    <div id="top-bar-right">
      
    </div>

    <svg id="top-hamburger" width="25" height="25">
      <circle cx="12.5" cy="6" r="2.1" fill="var(--bullet)" />
      <circle cx="12.5" cy="12.5" r="2.1" fill="var(--bullet)" />
      <circle cx="12.5" cy="19" r="2.1" fill="var(--bullet)" />
    </svg>
    <div id="options-frame" style="display:none">
      <input id="create-new-store" placeholder="Create new graph">
    </div>
  </div>

  <div id="top-bar-hidden-hitbox" style="position:fixed;height:20px;width:100%;display:none;"></div>



  <div id="terminal" contenteditable="true" style="display:none"></div>

  <div id="page-frame-outer">
    <div id="page-frame">

    </div>
  </div>

  <!-- inline styles on this site are all edited directly by js -->
  <div id="autocomplete-list" style="display:none"></div>
  <div id="command-list" style="display:none"></div>
  <div id="search-result-list" style="display:none"></div>
  <div id="template-list" style="display:none"></div>

  <div id="login" style="display:none">
    <p>Login</p>
    <form id="login-form">
      <input type="email" id="login-email" placeholder="email">
      <input type="password" id="login-password" placeholder="password">
      <input type="submit" style="height:0px" tabindex="-1">
    </form>
    <button id="switch-to-signup">Sign up</button>
    <button class="exit-to-main">Back</button>
  </div>

  <div id="signup" style="display:none">
    <p>Sign up</p>
    <form id="signup-form">
      <input type="email" id="signup-email" placeholder="email">
      <input type="text" id="signup-username" placeholder="username">
      <input type="password" id="signup-password" placeholder="password">
      <input type="submit" style="height:0px" tabindex="-1">
    </form>
    <button id="switch-to-login">Login</button>
    <button class="exit-to-main">Back</button>
  </div>

  <div id="really-want-to-leave" class="really-want-to" style="display:none">
    Your data will be lost if you sign out now
    <button>Continue</button>
  </div>
</div>

<title>Micro Roam</title>


<template id="page">
  <div class="page">
    <h1 class="page__title" contenteditable="true" tabindex="-1"></h1>

    <div class="page__body">

    </div>
    <div class="page__backlinks">

    </div>
  </div>
</template>

<template id="block">
  <div class="block">
    <svg class="block__bullet" width="20" height="20">
      <circle cx="10" cy="10.5" r="3" fill="var(--bullet)" />
    </svg>
    <div class="block__body" contenteditable="true" tabindex="-1"></div>
    <div class="block__children">

    </div>
  </div>
</template>

<template id="backref-list">
  <div class="backref-list">
    <div class="backref-list__title">Linked References</div>
    <div class="backref-list__body"></div>
  </div>
</template>

<template id="query-frame">
  <div class="query-frame"></div>
</template>

<template id="block-focus-frame">
  <div class="block-focus-frame">
    <div class="block-focus-frame__breadcrumb"></div>
    <div class="block-focus-frame__body"></div>
    <div class="block-focus-frame__backlinks"></div>
  </div>
</template>

<template id="backref-frame">
  <div class="backref-frame">
    <div class="backref-frame__breadcrumb"></div>
    <div class="backref-frame__body"></div>
  </div>
</template>

<template id="page-ref">
  <span class="page-ref"><span class="page-ref__brackets"></span><span class="page-ref__body"></span><span
      class="page-ref__brackets"></span></span>
</template>

<template id="image-embed">
  <img class="image-embed">
</template>

<template id="compute-failed">
  <span class="compute-failed"><span class="compute-failed__brackets"></span><span
      class="compute-failed__body"></span><span class="compute-failed__brackets"></span></span>
</template>

<template id="todo-checkbox">
  <input type="checkbox" class="todo-checkbox">
</template>

<template id="video-embed">
  <iframe class="video-embed" width="560" height="315" title="YouTube video player" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen></iframe>
</template>

<template id="breadcrumb-page">
  <span class="breadcrumb-page"></span>
</template>

<template id="notification">
  <div class="notification"></div>
</template>

<template id="breadcrumb-block">
  <span class="breadcrumb-block"><span class="breadcrumb-block__arrow">-></span><span
      class="breadcrumb-block__body"></span></span>
</template>

<template id="autocomplete__suggestion">
  <div class="autocomplete__suggestion"></div>
</template>

<template id="command__suggestion">
  <div class="command__suggestion"></div>
</template>

<template id="template__suggestion">
  <div class="template__suggestion"></div>
</template>

<template id="search-result">
  <div class="search-result"></div>
</template>`

const topButtons = {}

{
  const topButtonNames = ["Report Issue", "Help", "Daily Notes", "Upload", "Download", "Signup", "Signout", "Login"]
  for (let name of topButtonNames) {
    topButtons[name] = document.createElement('button')
    topButtons[name].innerText = name
    topButtons[name].tabindex = -1
  }
}

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
const allFrame = elById("html")

allFrame.innerHTML = allHtml


document.body.className = user.s.theme

const topBar = document.getElementById("top-bar")
const topBarHiddenHitbox = document.getElementById("top-bar-hidden-hitbox")

if (user.s.topBar === 'visible') {
  topBar.style.marginTop = "0px"
  topBarHiddenHitbox.style.display = "none"
}
setTimeout(() => topBar.className = "top-bar-transition", 200)


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

const createNewStoreElement = elById('create-new-store')
const topHamburgerElement = elById('top-hamburger')
const optionsFrame = elById('options-frame')

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
const queryFrameTemplate = getTemp("query-frame")

// login/signup
const loginForm = elById("login-form")
const loginEmailElement = elById("login-email")
const loginPasswordElement = elById("login-password")
const signupForm = elById("signup-form")

const signupUsernameElement = elById("signup-username")
const signupEmailElement = elById("signup-email")
const signupPasswordElement = elById("signup-password")

const textEncoder = new TextEncoder()

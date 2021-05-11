/**
Why do I have all my HTML inside my JS, you may wonder?
it's because I don't want the DOM to render before the JS loads.
Loading JS, making dynamic DOM can happen in 200ms,
so I don't want to waste time rendering a loading screen or anything beforehand.
If I have visible HTML inside my DOM, that will be style-calculated before the JS is compiled
(that's just how browser priority works) and the page load will be delayed by a few ms.
This way I add static DOM immediately before dynamic DOM, and they're both rendered together

This could be moved to an HTML file (to improve IDE support, clean up code) by inlining an html file in build.js, or by finding an option to tell the browser that the JS is more important than the DOM
 */
const allHtml = `<div id="app">
  <div id="top-bar" style="margin-top:-43px">
    <div id="top-bar-left">

    </div>
    <input id="search-input" placeholder="search" tabindex="-1">
    <div id="top-bar-right">

    </div>

    <svg id="top-connect" width="25" height="25">
      <line x1="12.5" y1="20" x2="21" y2="9" stroke="var(--bullet)" />
      <line x1="12.5" y1="20" x2="4" y2="9" stroke="var(--bullet)" />
      <line x1="12.5" y1="20" x2="12.5" y2="5" stroke="var(--bullet)" />

      <circle cx="4" cy="9" r="3.5" stroke="var(--bullet)" fill="var(--background)" />
      <circle cx="12.5" cy="5" r="3.5" stroke="var(--bullet)" fill="var(--background)" />
      <circle cx="21" cy="9" r="3.5" stroke="var(--bullet)" fill="var(--background)" />

      <circle cx="12.5" cy="20" r="4.5" stroke="var(--bullet)" fill="var(--background)" />
      <circle cx="12.5" cy="20" r="2.5" fill="var(--bullet)" />
    </svg>

    <svg id="top-hamburger" width="25" height="25">
      <circle cx="12.5" cy="5" r="2.5" fill="var(--bullet)" />
      <circle cx="12.5" cy="13" r="2.5" fill="var(--bullet)" />
      <circle cx="12.5" cy="21" r="2.5" fill="var(--bullet)" />
    </svg>

  </div>

  <div id="top-bar-hidden-hitbox" style="position:fixed;height:20px;width:100%;display:none;"></div>


  <div id="terminal" contenteditable="true" style="display:none"></div>

  <div id="page-frame-outer">
    <div id="page-frame">

    </div>
  </div>

  <div id="options-frame" style="display:none">
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

<template id="templates-container" style="display:none;">
  <div class="page">
    <h1 class="page__title" contenteditable="true" tabindex="-1"></h1>

    <div class="page__body">

    </div>
    <div class="page__backlinks">

    </div>
  </div>

  <div class="block">
    <svg class="block__bullet" width="20" height="20">
      <circle cx="10" cy="10.5" r="3" fill="var(--bullet)" />
    </svg>
    <div class="block__body" tabindex="-1"></div>
    <div class="block__after-body"></div>
    <div class="block__children">

    </div>
  </div>

  <div class="backref-list">
    <div class="backref-list__title">Linked References</div>
    <div class="backref-list__body"></div>
  </div>

  <div class="query-frame"></div>

  <div class="block-focus-frame">
    <div class="block-focus-frame__breadcrumb"></div>
    <div class="block-focus-frame__body"></div>
    <div class="block-focus-frame__backlinks"></div>
  </div>

  <div class="backref-frame">
    <div class="backref-frame__breadcrumb"></div>
    <div class="backref-frame__body"></div>
  </div>

  <span class="page-ref"><span class="page-ref__brackets"></span><span class="page-ref__graphname"></span><span
      class="page-ref__body"></span><span class="page-ref__brackets"></span></span>

  <span class="tag"><span class="tag__graph-name"></span><span class="tag__body"></span></span>

  <img class="image-embed">

  <span class="compute-failed"><span class="compute-failed__brackets"></span><span
      class="compute-failed__body"></span><span class="compute-failed__brackets"></span></span>

  <span class="alias"><span class="alias__visible"></span><span class="alias__hidden"></span></span>

  <input type="checkbox" class="todo-checkbox">

  <iframe class="video-embed" width="560" height="315" title="YouTube video player" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen></iframe>

  <span class="breadcrumb-page"></span>

  <div class="notification"></div>

  <span class="breadcrumb-block"><span class="breadcrumb-block__arrow">-></span><span
      class="breadcrumb-block__body"></span></span>

  <div class="autocomplete__suggestion"></div>

  <div class="command__suggestion"></div>

  <div class="template__suggestion"></div>

  <div class="search-result"></div>

  <canvas class="overview" width="400" width="300"></canvas>
</template>`
const allFrame = document.getElementById("html")
allFrame.innerHTML = allHtml


const templates = {}
for (let template of document.getElementById("templates-container").content.children) {
  // convert ids to camel case because it allows . syntax, which is slightly faster and prettier
  templates[kebabToCamel(template.className)] = template
}

const idElements = {}
for (let uniqueElement of document.querySelectorAll("[id]")) {
  idElements[kebabToCamel(uniqueElement.id)] = uniqueElement
}


const topButtons = {}

let topButtonNames = ["Help", "Daily Notes", "Report Issue", "Sign Up", "Sign Out", "Login", "Upload", "Download", "Create New Graph"]
for (let name of topButtonNames) {
  topButtons[name] = document.createElement('button')
  topButtons[name].innerText = name
  topButtons[name].tabindex = -1
}

topButtons["Create New Graph"] = document.createElement('input')
topButtons["Create New Graph"].placeholder = "Create New Graph"
topButtons["Create New Graph"].id = "create-new-store"
topButtons["Create New Graph"].type = "text"
topButtons["Create New Graph"].size = 15

const disconnectedFileInput = document.createElement('input')
disconnectedFileInput.type = "file"

topButtonNames = Object.keys(topButtons)

let toShowOnTopBar = ["Daily Notes", "Report Issue", "Sign Up", "Upload",]

const layoutTopBar = () => {
  const split = Math.floor(toShowOnTopBar.length / 2)
  for (let i = 0; i < split; i++) {
    idElements.topBarLeft.appendChild(topButtons[toShowOnTopBar[i]])
  }
  for (let i = split; i < toShowOnTopBar.length; i++) {
    idElements.topBarRight.appendChild(topButtons[toShowOnTopBar[i]])
  }
  for (let name of topButtonNames) {
    if (!toShowOnTopBar.includes(name)) {
      idElements.optionsFrame.appendChild(topButtons[name])
    }
  }
}
layoutTopBar()


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

// Singleton elements


document.body.className = user.s.theme


if (user.s.topBar === 'visible') {
  idElements.topBar.style.marginTop = "0px"
  idElements.topBarHiddenHitbox.style.display = "none"
}
setTimeout(() => idElements.topBar.className = "top-bar-transition", 200)


const textEncoder = new TextEncoder()

const colorThemeOrder = ["light", "purple", "green", "dark"]

idElements.searchResultList.templateElement = templates.searchResult
idElements.autocompleteList.templateElement = templates.autocomplete__suggestion
idElements.commandList.templateElement = templates.command__suggestion
idElements.templateList.templateElement = templates.template__suggestion
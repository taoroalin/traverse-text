// Templates
const pageTemplate = document.getElementById("page").content.firstElementChild
const blockTemplate = document.getElementById("block").content.firstElementChild
const backrefsListTemplate = document.getElementById("backrefs-list").content.firstElementChild
const blockFocusFrameTemplate = document.getElementById("block-focus-frame").content.firstElementChild
const pageBreakTemplate = document.getElementById("page-break").content.firstElementChild
const suggestionTemplate = document.getElementById("autocomplete__suggestion").content.firstElementChild

// Singleton elements
const pageFrame = document.getElementById("page-frame")
const pageFrameOuter = document.getElementById("page-frame-outer")
const searchInput = document.getElementById("search-input")
const downloadButton = document.getElementById("download-button")
const autocompleteList = document.getElementById("autocomplete-list")
const terminalElement = document.getElementById("terminal")

// App state transitions
const gotoMethods = {
  pageTitle: (title) => {
    let existingPage = store.pagesByTitle[title]
    if (existingPage === undefined) {
      existingPage = runCommand("createPage",title)
    }
    renderPage(pageFrame,existingPage)
  },
  block: (uid) => {
    const blockFocusFrame = blockFocusFrameTemplate.cloneNode(true)
    pageFrame.appendChild(blockFocusFrame)
    renderBlock(blockFocusFrame,uid)
    const backRefs = store.blocks[uid].backRefs
    if (backRefs) {
      const backrefsListElement = backrefsListTemplate.cloneNode(true)
      blockFocusFrame.appendChild(backrefsListElement)
      for (let backref of backRefs) {
        renderBlock(backrefsListElement.children[1],backref)
      }
    }
  },
  dailyNotes: () => {
    pageFrameOuter.addEventListener("scroll",dailyNotesInfiniteScrollListener)
    oldestLoadedDailyNoteDate = new Date(Date.now())
    let numNotesLoaded = 0
    if (store.pagesByTitle[formatDate(oldestLoadedDailyNoteDate)] === undefined) {
      runCommand("createPage",formatDate(oldestLoadedDailyNoteDate))
    }
    for (let i = 0; i < 366; i++) {
      const daysNotes = store.pagesByTitle[formatDate(oldestLoadedDailyNoteDate)]
      if (daysNotes) {
        renderPage(pageFrame,daysNotes)
        pageFrame.appendChild(pageBreakTemplate.cloneNode(true))
        numNotesLoaded += 1
        if (numNotesLoaded > 4) {
          break
        }
      }
      oldestLoadedDailyNoteDate.setDate(
        oldestLoadedDailyNoteDate.getDate() - 1
      )
    }
  },
  suggestion: (suggestionNode) => {
    if (suggestionNode.dataset.title)
      gotoPageTitle(suggestionNode.dataset.title)
    else
      gotoBlock(suggestionNode.dataset.id)
  }
}

const goto = (...command) => { // no this is not an instruction pointer goto. This just switches the current page
  history.pushState(command,"Micro Roam") // todo make title change
  gotoNoHistory(...command)
}

const gotoNoHistory = (...command) => {
  // clear screen
  autocompleteList.style.display = "none"
  oldestLoadedDailyNoteDate = null
  pageFrameOuter.removeEventListener("scroll",dailyNotesInfiniteScrollListener)
  pageFrameOuter.scrollTop = 0
  pageFrame.innerHTML = ""
  searchInput.value = ""

  gotoMethods[command[0]](command.slice(1))
}

const gotoReplaceHistory = (...command) => {
  gotoNoHistory(...command)
  history.replaceState(command,"Micro Roam")
}

window.addEventListener("popstate",(event) => {
  console.log(event.state)
  if (event.state) gotoNoHistory(...event.state)
})

// Rendering ----------------------------------------------------------------------------------------------------------

const renderPage = (parentNode,uid) => {
  const page = store.pages[uid]
  const element = pageTemplate.cloneNode(true)
  const title = element.firstElementChild
  const body = element.children[1]
  body.dataset.id = uid
  element.dataset.id = uid

  title.innerText = page.title

  let children = page.children
  if (!children || children.length === 0) { // todo set standards for when lists can be empty to reduce ambiguity
    runCommand("createBlock",uid,0)
    children = page.children
  }
  for (let child of children) {
    renderBlock(body,child)
  }

  if (page.backRefs.length > 0) {
    const backrefsListElement = backrefsListTemplate.cloneNode(true)
    element.children[2].appendChild(backrefsListElement)
    for (let backref of page.backRefs) {
      renderBlock(backrefsListElement.children[1],backref)
    }
  }

  parentNode.appendChild(element)
  return element
}

const renderBlock = (parentNode,uid,idx) => {
  const element = blockTemplate.cloneNode(true)
  const body = element.children[1]
  const childrenContainer = element.children[2]
  element.dataset.id = uid
  childrenContainer.dataset.id = uid
  body.dataset.id = uid
  element.dataset.childIdx = idx || parentNode.children.length

  const string = store.blocks[uid].string
  if (string) {
    renderBlockBody(body,string)
  }

  const children = store.blocks[uid].children
  if (children) {
    for (let child of children) {
      renderBlock(childrenContainer,child)
    }
  }

  if (idx !== undefined) {
    parentNode.insertBefore(element,parentNode.children[idx])
  } else {
    parentNode.appendChild(element)
  }
  return element
}


// Event Listener Helpers -----------------------------------------------------------------------------------------------

const updateCursorInfo = () => {
  focusedNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset
  focusedBlock = focusedNode && focusedNode.parentNode.closest(".block")
  focusedBlockBody = focusedBlock && focusedBlock.children[1]
  cursorPositionInBlock = focusedBlock && getCursorPositionInBlock()
  editingLink = focusedBlock && getCurrentLink()
  editingTitle = editingLink && ((editingLink.className === "tag" && editingLink.innerText.substring(1)) || (editingLink.className === "page-ref" && editingLink.children[1].innerText))
}

const getCursorPositionInBlock = () => {
  const selection = getSelection()
  const focusNode = selection.focusNode
  if (focusNode.className === "block__body") {
    const jankReturn = focusedBlock.innerText.length * (focusOffset !== 0) // todo make this less jank
    return jankReturn
  } else {
    let position = selection.focusOffset
    if (focusNode.startIdx) position += focusNode.startIdx
    return position
  }
}

const getCurrentLink = () => {
  const pageRefs = focusedBlockBody.querySelectorAll(".page-ref")
  const tags = focusedBlockBody.querySelectorAll(".tag")
  let result = null
  for (let tag of tags) {
    if (tag.childNodes[0].endIdx >= cursorPositionInBlock && tag.childNodes[0].startIdx < cursorPositionInBlock) {
      result = tag
    }
  }
  for (let ref of pageRefs) {
    if (ref.children[1].childNodes[0].endIdx >= cursorPositionInBlock && ref.children[1].childNodes[0].startIdx < cursorPositionInBlock) {
      result = ref
    }
  }
  return result
}

const dailyNotesInfiniteScrollListener = () => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    for (let i = 0; i < 100; i++) {
      oldestLoadedDailyNoteDate.setDate(oldestLoadedDailyNoteDate.getDate() - 1)
      const daysNotes = store.pagesByTitle[formatDate(oldestLoadedDailyNoteDate)]
      if (daysNotes) {
        renderPage(pageFrame,daysNotes)
        break
      }
    }
  }
}

const downloadHandler = () => {
  console.log("download")
  const json = storeToRoamJSON(store)
  const data = new Blob([json],{ type: 'text/json' })
  const url = URL.createObjectURL(data)
  downloadButton.setAttribute('href',url)
  downloadButton.setAttribute('download',`${store.graphName}-micro-roam.json`)
}

const renderBlockBodyWithCursor = (blockBody,string,position) => {
  if (position >= string.length) string += " "
  blockBody.innerHTML = ""
  const refTitles = renderBlockBody(blockBody,string)

  const scanElement = (element) => {
    for (let el of element.childNodes) {
      if (el.nodeName === "#text") {
        if (el.textContent && position >= el.startIdx && position < el.startIdx + el.textContent.length) {
          scanResult = el
          try {
            getSelection().collapse(el,position - el.startIdx) // this does the thing correctly, but then throws an error, which I catch? todo investigate
            return el
          } catch (error) {
            return el
          }
        }
      } else {
        const z = scanElement(el)
        if (z) return z
      }
    }
  }
  scanElement(blockBody)
  return refTitles
}


// TODO make focusBlockStart ect get past the last 1 char
const focusBlockEnd = (blockNode) => {
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.appendChild(temp)
  getSelection().collapse(temp,0)
  temp.remove()
}

const focusBlockStart = (blockNode) => {
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.insertBefore(temp,body.firstChild)
  getSelection().collapse(temp,0)
  temp.remove()
}

const autocomplete = () => {
  const bid = focusedBlock.dataset.id
  const selected = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`)
  const origString = store.blocks[bid].string
  if (editingLink.className === "tag") {
    const textNode = editingLink.childNodes[0]
    if (/[^\/a-zA-Z0-9_-]/.test(selected.dataset.title)) { // this is exact inverse of regex test for tag token, to see if this must be a tag
      const string = origString.slice(0,textNode.startIdx) + "[[" + selected.dataset.title + "]]" + origString.slice(textNode.endIdx)
      const refTitles = renderBlockBodyWithCursor(focusedBlockBody,string,textNode.startIdx + selected.dataset.title.length + 4)
      runCommand("writeBlock",bid,string,refTitles)
    } else {
      const string = origString.slice(0,textNode.startIdx) + "#" + selected.dataset.title + origString.slice(textNode.endIdx)
      const refTitles = renderBlockBodyWithCursor(focusedBlockBody,string,textNode.startIdx + selected.dataset.title.length + 1)
      runCommand("writeBlock",bid,string,refTitles)
    }
  } else {
    const textNode = editingLink.children[1].childNodes[0]
    const string = origString.slice(0,textNode.startIdx) + selected.dataset.title + origString.slice(textNode.endIdx)
    const refTitles = renderBlockBodyWithCursor(focusedBlockBody,string,textNode.startIdx + selected.dataset.title.length + 2)
    runCommand("writeBlock",bid,string,refTitles)
  }
  autocompleteList.style.display = "none"
}

const indentFocusedBlock = () => {
  const bid = focusedBlock.dataset.id
  const olderSibling = focusedBlock.previousSibling
  if (olderSibling && olderSibling.dataset && olderSibling.dataset.id) {
    runCommand("moveBlock",bid,olderSibling.dataset.id)
    olderSibling.children[2].appendChild(focusedBlock)
    getSelection().collapse(focusedNode,focusOffset)
  }
}

const dedentFocusedBlock = () => {
  const bid = focusedBlock.dataset.id
  const parent = focusedBlock.parentNode.parentNode
  if (parent) {
    const grandparentChildren = parent.parentNode
    const grandparent = parent.parentNode.parentNode
    const grandparentId = grandparent.dataset.id
    const cousin = parent.nextSibling
    if (grandparentId) {
      if (cousin) {
        grandparentChildren.insertBefore(focusedBlock,cousin)
      } else {
        grandparentChildren.appendChild(focusedBlock)
      }
      runCommand("moveBlock",bid,grandparentId,parent.dataset.childIdx + 1)
      getSelection().collapse(focusedNode,focusOffset)
    }
  }
}

// Global event listeners that switch on active element, as a possibly more performant, simpler option than propagating through multiple event handlers

// Event listener functions that can't be written inline because multiple triggers / disconnect / reconnect

document.addEventListener("input",(event) => {
  updateCursorInfo()
  if (focusedBlock) {
    const blockBody = focusedBlockBody
    const id = blockBody.parentNode.dataset.id
    if (blockBody.innerText === " " || blockBody.innerText === "") {
      runCommand("writeBlock",id,"",[])
      return
    }
    // reparse block and insert cursor into correct position while typing

    let string = blockBody.innerText
    store.blocks[id].string = string // todo commit changes on word boundaries

    const refTitles = renderBlockBodyWithCursor(blockBody,string,cursorPositionInBlock)
    runCommand("writeBlock",id,string,refTitles)

    updateCursorInfo()

    // Autocomplete
    // could do this here, or in scanElement, or in renderBlockBody
    if (editingTitle) {
      const matchingTitles = titleExactFullTextSearch(editingTitle)
      if (matchingTitles.length > 0) {
        autocompleteList.innerHTML = ""
        for (let i = 0; i < Math.min(matchingTitles.length,10); i++) {
          const suggestion = suggestionTemplate.cloneNode(true)
          if (i === 0) {
            suggestion.dataset.selected = "true"
          }
          if (matchingTitles[i].title) {
            suggestion.dataset.id = matchingTitles[i].id
            suggestion.dataset.title = matchingTitles[i].title
            suggestion.innerText = truncateElipsis(matchingTitles[i].title,50)
          }
          else {
            suggestion.dataset.id = matchingTitles[i].id
            suggestion.dataset.string = matchingTitles[i].string
            suggestion.innerText = truncateElipsis(matchingTitles[i].string,50)
          }
          autocompleteList.appendChild(suggestion)
        }
        autocompleteList.style.display = "block"
        autocompleteList.style.top = editingLink.getBoundingClientRect().bottom
        autocompleteList.style.left = editingLink.getBoundingClientRect().left
      } else {
        autocompleteList.style.display = "none"
      }
    } else {
      autocompleteList.style.display = "none"
    }


  } else if (event.target.id === "search-input") {

    const matchingTitles = exactFullTextSearch(event.target.value)

    if (matchingTitles.length > 0) {
      autocompleteList.innerHTML = ""
      for (let i = 0; i < Math.min(matchingTitles.length,10); i++) {
        const suggestion = suggestionTemplate.cloneNode(true)
        if (i === 0) {
          suggestion.dataset.selected = "true"
        }
        if (matchingTitles[i].title) {
          suggestion.dataset.title = matchingTitles[i].title
          suggestion.innerText = truncateElipsis(matchingTitles[i].title,50)
        } else {
          suggestion.dataset.string = matchingTitles[i].string
          suggestion.dataset.id = matchingTitles[i].id
          suggestion.innerText = truncateElipsis(matchingTitles[i].string,50)
        }
        autocompleteList.appendChild(suggestion)
      }
      autocompleteList.style.display = "block"
      autocompleteList.style.top = searchInput.getBoundingClientRect().bottom
      autocompleteList.style.left = searchInput.getBoundingClientRect().left
    } else {
      autocompleteList.style.display = "none"
    }
  }
})

document.addEventListener("keydown",(event) => {
  updateCursorInfo()

  if (event.key === "Tab" && autocompleteList.style.display !== "none" && focusedBlock) {
    autocomplete()
    event.preventDefault()
    // Check for global shortcut keys
  } else if (event.key === "Escape") {
    autocompleteList.style.display = "none"
    event.preventDefault()
  } else if (event.key === "z" && event.ctrlKey && !event.shiftKey) {

  } else if (event.key === "d" && event.ctrlKey) {
    document.getElementById("upload-input").click()
    event.preventDefault()
  } else if (event.key === "s" && event.ctrlKey && event.shiftKey) {
    downloadHandler()
    event.preventDefault()
  } else if (event.key === "s" && event.ctrlKey) {
    saveWorker.postMessage(["save",store])
    event.preventDefault()
  } else if (event.key === "m" && event.ctrlKey) {
    if (document.body.className === "light") {
      user.theme = "dark"
      saveUser()
    } else {
      user.theme = "light"
      saveUser()
    }
    event.preventDefault()
  } else if (event.key === "d" && event.altKey) {
    goto("dailyNotes")
    event.preventDefault()
  } else if (event.ctrlKey && event.key === "u") {
    searchInput.focus()
    event.preventDefault()
  } else if (event.ctrlKey && event.key === "o") {
    if (editingLink && editingLink.className === "page-ref")
      goto("pageTitle",editingLink.children[1].innerText)
    if (editingLink && editingLink.className === "tag")
      goto("pageTitle",editingLink.innerText.substring(1))
    event.preventDefault()
  } else if (autocompleteList.style.display !== "none") {
    const selected = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`)
    if (selected) {
      const newSelected = (event.key === "ArrowUp" && selected.previousSibling) || (event.key === "ArrowDown" && selected.nextSibling)
      if (newSelected) {
        newSelected.dataset.selected = "true"
        delete selected.dataset.selected
        event.preventDefault()
      }
    }
  } else if (event.key === "i" && event.ctrlKey && event.altKey) {
    if (terminalElement.style.display === "none") {
      terminalElement.style.display = "block"
      terminalElement.focus()
      event.preventDefault()
    } else {
      terminalElement.style.display = "none"
    }

    // Check for actions based on active element
  } else if (focusedBlock) {
    let blocks
    let newActiveBlock
    const bid = focusedBlock.dataset.id
    switch (event.key) {
      case "Enter":
        if (event.shiftKey) {

        } else {
          const parent = blockOrPageFromId(store.blocks[bid].parent)
          let idx = parent.children.indexOf(bid)
          if (!event.ctrlKey) {
            idx += 1
          }
          const newBlockUid = runCommand("createBlock",store.blocks[bid].parent,idx)
          renderBlock(focusedBlock.parentNode,newBlockUid,idx)
          getSelection().collapse(focusedNode,focusOffset)
        }
        break
      case "Tab":
        if (event.shiftKey) {
          dedentFocusedBlock()
        } else {
          indentFocusedBlock()
        }
        event.preventDefault()
        break
      case "Backspace":
        if (cursorPositionInBlock === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) - 1]
          focusedBlock.remove()
          focusBlockEnd(newActiveBlock)
          runCommand("deleteBlock",bid)
          event.preventDefault()
        }
        break
      case "ArrowDown":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blocks[bid].parent
          const parentElement = focusedBlock.parentNode
          const currentIdx = blockOrPageFromId(parentId).children.indexOf(bid)
          if (focusedBlock.nextSibling) {
            runCommand("moveBlock",bid,parentId,currentIdx + 1)
            if (focusedBlock.nextSibling.nextSibling) {
              parentElement.insertBefore(focusedBlock,focusedBlock.nextSibling.nextSibling)
            } else parentElement.appendChild(focusedBlock)
            getSelection().collapse(focusedNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) + 1]
          focusBlockStart(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowUp":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blocks[bid].parent
          const parentElement = focusedBlock.parentNode
          const currentIdx = blockOrPageFromId(parentId).children.indexOf(bid)
          if (focusedBlock.previousSibling) {
            runCommand("moveBlock",bid,parentId,currentIdx - 1)
            parentElement.insertBefore(focusedBlock,focusedBlock.previousSibling)
            getSelection().collapse(focusedNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) - 1]
          focusBlockEnd(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowLeft":
        if (event.shiftKey && event.altKey) {
          dedentFocusedBlock()
        } else if (cursorPositionInBlock === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) - 1]
          if (newActiveBlock) focusBlockEnd(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowRight":
        if (event.shiftKey && event.altKey) {
          indentFocusedBlock()
        } else if (cursorPositionInBlock === focusedBlockBody.innerText.length) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusedBlock) + 1]
          if (newActiveBlock) focusBlockStart(newActiveBlock)
          event.preventDefault()
        }
        break
    }
  } else if (
    document.activeElement &&
    document.activeElement.id === "search-input"
  ) {
    if (event.key === "Enter") {
      goto("pageTitle",event.target.value)
      event.preventDefault()
      return
    } else if (event.key === "Tab") {
      console.log("goto suggestion")
      const selected = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`)
      if (selected) {
        goto("suggestion",selected)
        return
      }
    }
  } else if (terminalElement.style.display !== "none") {
    if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      eval(event.target.innerText)
      if (!event.ctrlKey) {
        terminalElement.style.display = "none"
        terminalElement.innerHTML = ""
      }
    }
  }
})

document.addEventListener("click",(event) => {

  updateCursorInfo()

  const closestBullet = event.target.closest(".block__bullet")
  if (event.target.className === "page-ref__body") {
    goto("pageTitle",event.target.innerText)
  } else if (closestBullet) {
    goto("block",closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    goto("block",event.target.dataset.id)
  } else if (event.target.closest(".tag")) {
    goto("pageTitle",event.target.closest(".tag").innerText.substring(1))
  } else if (event.target.id === "download-button") {
    downloadHandler()
  } else if (event.target.id === "upload-button") {
    document.getElementById("upload-input").click()
  } else if (event.target.id === "daily-notes-button") {
    goto("dailyNotes")
  } else if (event.target.className === "autocomplete__suggestion") {
    if (focusNode.parentNode === searchInput) { // todo actually know what user is doing globally
      goto("suggestion",event.target)
    } else {
      autocomplete()
    }
  } else if (event.target.className === "url") { // using spans with event handlers as links because they play nice with contenteditable
    const link = document.createElement("a")
    link.target = "_blank"
    link.href = event.target.innerText
    link.click()
  }
})

document.getElementById('upload-input').addEventListener('change',(event) => {
  const file = event.target.files[0]
  graphName = file.name.substring(0,file.name.length - 5)
  file.text().then((text) => {
    store = roamJsonToStore(graphName,text)
    user.graphName = graphName
    saveUser()
    goto("dailyNotes")
    setTimeout(() => saveWorker.postMessage(["save",store]),0)
  })
})

// Finally starting the program after everything's compiled

const saveWorker = new Worker('/worker.js')

saveWorker.postMessage(["user",user])

if (w) {
  gotoReplaceHistory("dailyNotes")
  setTimeout(() => saveWorker.postMessage(["save",store]),0)
} else {
  w = true
}

// const t = performance.now()
// for (let i = 0; i < 1000000; i++) {
//   true || (1 === undefined)
// }
// console.log(`took ${performance.now() - t}`)

const test = () => {
  const testScriptNode = document.createElement("script")
  testScriptNode.src = "test.js"
  document.body.appendChild(testScriptNode)
}

const reset = () => {
  const r = indexedDB.deleteDatabase("microroam")
  localStorage.removeItem("user")
  window.location.href = window.location.href
}

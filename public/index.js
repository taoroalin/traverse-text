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

// App state transitions
const gotoBlack = () => {
  autocompleteList.style.display = "none"
  oldestLoadedDailyNoteDate = null
  pageFrameOuter.removeEventListener("scroll",dailyNotesInfiniteScrollListener)
  pageFrameOuter.scrollTop = 0
  pageFrame.innerHTML = ""
  searchInput.value = ""
}

const gotoPageTitle = (title) => {
  let existingPage = store.pagesByTitle[title]
  if (existingPage === undefined) {
    existingPage = newUid()
    runCommand("createPage",existingPage,title)
  }
  gotoBlack()
  renderPage(pageFrame,existingPage)
}

const gotoDailyNotes = () => {
  gotoBlack()
  pageFrameOuter.addEventListener("scroll",dailyNotesInfiniteScrollListener)
  oldestLoadedDailyNoteDate = new Date(Date.now())
  let numNotesLoaded = 0
  if (store.pagesByTitle[formatDate(oldestLoadedDailyNoteDate)] === undefined) {
    const newPageId = `${oldestLoadedDailyNoteDate.getMonth()}-${oldestLoadedDailyNoteDate.getDate()}-${oldestLoadedDailyNoteDate.getFullYear()}`
    runCommand("createPage",newPageId,formatDate(oldestLoadedDailyNoteDate))
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
}

// todo make this page look ok
const gotoBlock = (uid) => {
  gotoBlack()
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
}

const gotoSuggestion = (suggestionNode) => {
  if (suggestionNode.dataset.title)
    gotoPageTitle(suggestionNode.dataset.title)
  else
    gotoBlock(suggestionNode.dataset.id)
}


// Rendering
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
    const newBlockId = newUid()
    runCommand("createBlock",newBlockId,uid,0)
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

// Global event listeners that switch on active element, as a possibly more performant, simpler option than propagating through multiple event handlers

// Event listener functions that can't be written inline because multiple triggers / disconnect / reconnect

const dailyNotesInfiniteScrollListener = () => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    oldestLoadedDailyNoteDate.setDate(oldestLoadedDailyNoteDate.getDate() - 1)
    const daysNotes = store.pagesByTitle[formatDate(oldestLoadedDailyNoteDate)]
    if (daysNotes)
      renderPage(pageFrame,daysNotes)
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
  blockBody.innerHTML = ""
  renderBlockBody(blockBody,string)

  const scanElement = (element) => {
    for (let el of element.childNodes) {
      if (el.nodeName === "#text") {
        if (el.textContent && position >= el.startIdx && position < el.startIdx + el.textContent.length) {
          console.log(`pos ${position} si ${el.startIdx}`)
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
  return scanElement(blockBody)
}

document.addEventListener("input",(event) => {
  const blockBody = event.target.closest(".block__body")

  if (blockBody) {
    const id = blockBody.parentNode.dataset.id
    if (blockBody.innerText === " " || blockBody.innerText === "") {
      runCommand("writeBlock",id,"")
      return
    }
    // reparse block and insert cursor into correct position while typing
    const position = cursorPositionInBlock()

    const originalString = store.blocks[id].string
    const curTextNode = getSelection().focusNode
    console.log(`start ${curTextNode.startIdx} end ${curTextNode.endIdx}`)
    let string = blockBody.innerText
    store.blocks[id].string = string // todo commit changes on word boundaries
    runCommand("writeBlock",id,string)

    if (blockBody.innerText.length === position)
      string += " "

    renderBlockBodyWithCursor(blockBody,string,position).parentNode


    // Autocomplete
    // could do this here, or in scanElement, or in renderBlockBody
    const pageRefs = blockBody.querySelectorAll(".page-ref")
    const tags = blockBody.querySelectorAll(".tag")
    let titleString = null
    let alignElement = null
    for (let tag of tags) {
      if (tag.childNodes[0].endIdx >= position && tag.childNodes[0].startIdx < position) {
        titleString = tag.innerText.substring(1)
        alignElement = tag
      }
    }
    for (let ref of pageRefs) {
      if (ref.children[1].childNodes[0].endIdx >= position && ref.children[1].childNodes[0].startIdx < position) {
        titleString = ref.children[1].innerText
        alignElement = ref
      }
    }
    if (titleString) {
      console.log(`found title string ${titleString}`)
      const matchingTitles = titleExactFullTextSearch(titleString)
      console.log(matchingTitles)
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
        autocompleteList.style.top = alignElement.getBoundingClientRect().bottom
        autocompleteList.style.left = alignElement.getBoundingClientRect().left
      } else {
        autocompleteList.style.display = "none"
      }
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

// DOM util                              -------------------------------------

const cursorPositionInBlock = () => {
  const selection = getSelection()
  const focusNode = selection.focusNode
  let position = selection.focusOffset
  if (focusNode.startIdx) position += focusNode.startIdx
  return position
}

// TODO make focusBlockStart ect get past the last 1 char
const focusBlockEnd = (blockNode) => {
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.appendChild(temp)
  window.getSelection().collapse(temp,0)
  // temp.innerText = ""
}

const focusBlockStart = (blockNode) => {
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.insertBefore(temp,body.firstChild)
  window.getSelection().collapse(temp,0)
}

// more event listeners                    ------------------------------------------

document.addEventListener("keydown",(event) => {
  // Check for global shortcut keys

  if (event.key === "Escape") {
    autocompleteList.style.display = "none"
    event.preventDefault()
    return
  }

  if (event.key === "z" && event.ctrlKey && !event.shiftKey) {

  } else if (event.key === "d" && event.ctrlKey) {
    document.getElementById("upload-input").click()
    event.preventDefault()
    return
  }
  if (event.key === "s" && event.ctrlKey && event.shiftKey) {
    downloadHandler()
    event.preventDefault()
    return
  }
  if (event.key === "s" && event.ctrlKey) {
    saveWorker.postMessage(["save",store])
    event.preventDefault()
    return
  }
  if (event.key === "m" && event.ctrlKey) {
    if (document.body.className === "light") {
      user.theme = "dark"
      saveUser()
    } else {
      user.theme = "light"
      saveUser()
    }
    event.preventDefault()
    return
  }
  if (event.key === "d" && event.altKey) {
    gotoDailyNotes()
    event.preventDefault()
    return
  }
  if (event.ctrlKey && event.key === "u") {
    searchInput.focus()
    event.preventDefault()
    return
  }

  if (event.ctrlKey && event.key === "o") {
    const closestPageRef = getSelection().focusNode.parentNode.closest(".page-ref")
    if (closestPageRef)
      gotoPageTitle(closestPageRef.children[1].innerText)
    const closestTag = getSelection().focusNode.parentNode.closest(".tag")
    if (closestTag)
      gotoPageTitle(closestTag.innerText.substring(1))
    event.preventDefault()
    return
  }
  if (autocompleteList.style.display !== "none") {
    const selected = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`)
    if (selected) {
      const newSelected = (event.key === "ArrowUp" && selected.previousSibling) || (event.key === "ArrowDown" && selected.nextSibling)
      if (newSelected) {
        newSelected.dataset.selected = "true"
        delete selected.dataset.selected
        event.preventDefault()
        return
      }
    }
  }
  // Check for actions based on active element
  const closestBlock = document.activeElement.closest(".block")
  if (closestBlock
  ) {
    let blocks
    let newActiveBlock
    const bid = closestBlock.dataset.id
    switch (event.key) {
      case "Enter":
        if (event.shiftKey) {

        } else {
          let idx = parseInt(closestBlock.dataset.childIdx)
          if (!event.ctrlKey) {
            idx += 1
          }
          const newBlockUid = newUid()
          runCommand("createBlock",newBlockUid,store.blocks[bid].parent,idx)
          const newBlock = renderBlock(closestBlock.parentNode,newBlockUid,idx)
          newBlock.children[1].focus()
        }
        break
      case "Tab":
        const selected = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`)
        if (autocompleteList.style.display !== "none" && selected) {
          console.log("completing")
          const closestTag = getSelection().focusNode.parentNode.closest(".tag")
          const closestPageRef = getSelection().focusNode.parentNode.closest(".page-ref__body")
          const origString = store.blocks[bid].string
          const focusNode = getSelection().focusNode
          if (closestTag) {
            if (/[^\/a-zA-Z0-9_-]/.test(selected.dataset.title)) { // this is exact inverse of regex test for tag token, to see if this must be a tag
              const string = origString.slice(0,focusNode.startIdx) + "[[" + selected.dataset.title + "]]" + origString.slice(focusNode.endIdx)
              runCommand("writeBlock",bid,string)
              renderBlockBodyWithCursor(closestBlock.children[1],string,focusNode.startIdx + getSelection().focusOffset)
            } else {
              const string = origString.slice(0,focusNode.startIdx) + "#" + selected.dataset.title + origString.slice(focusNode.endIdx)
              runCommand("writeBlock",bid,string)
              renderBlockBodyWithCursor(closestBlock.children[1],string,focusNode.startIdx + getSelection().focusOffset)
            }
            event.preventDefault()
          } else if (closestPageRef) {
            const string = origString.slice(0,focusNode.startIdx) + selected.dataset.title + origString.slice(focusNode.endIdx)
            runCommand("writeBlock",bid,string)
            renderBlockBodyWithCursor(closestBlock.children[1],string,focusNode.startIdx + getSelection().focusOffset)
            event.preventDefault()
          }
        } else if (event.shiftKey) {
          const parent = closestBlock.parentNode.parentNode
          if (parent) {
            const grandparentChildren = parent.parentNode
            const grandparent = parent.parentNode.parentNode
            const grandparentId = grandparent.dataset.id
            const cousin = parent.nextSibling
            if (grandparentId) {
              const focusNode = window.getSelection().focusNode
              const focusOffset = window.getSelection().focusOffset
              if (cousin) {
                grandparentChildren.insertBefore(closestBlock,cousin)
              } else {
                grandparentChildren.appendChild(closestBlock)
              }
              runCommand("moveBlock",bid,grandparentId,parent.dataset.childIdx + 1)
              window.getSelection().collapse(focusNode,focusOffset)
            }
          }
        } else {
          const olderSibling = closestBlock.previousSibling
          if (olderSibling && olderSibling.dataset && olderSibling.dataset.id) {
            const focusNode = window.getSelection().focusNode
            const focusOffset = window.getSelection().focusOffset
            runCommand("moveBlock",bid,olderSibling.dataset.id)
            olderSibling.children[2].appendChild(closestBlock)
            window.getSelection().collapse(focusNode,focusOffset)
          }
        }
        event.preventDefault()
        break
      case "Backspace":
        if (cursorPositionInBlock() === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(closestBlock) - 1]
          focusBlockEnd(newActiveBlock)
          closestBlock.remove()
          runCommand("deleteBlock",bid)
        }
        break
      case "ArrowDown":
        blocks = Array.from(document.querySelectorAll(".block"))
        newActiveBlock = blocks[blocks.indexOf(closestBlock) + 1]
        focusBlockStart(newActiveBlock)
        break
      case "ArrowUp":
        blocks = Array.from(document.querySelectorAll(".block"))
        newActiveBlock = blocks[blocks.indexOf(closestBlock) - 1]
        focusBlockEnd(newActiveBlock)
        break
      case "ArrowLeft":
        if (cursorPositionInBlock() === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(closestBlock) - 1]
          focusBlockEnd(newActiveBlock)
        }
        break
      case "ArrowRight":
        if (
          cursorPositionInBlock() ===
          closestBlock.children[1].innerText.length
        ) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(closestBlock) + 1]
          focusBlockStart(newActiveBlock)
        }
        break
    }
  } else if (
    document.activeElement &&
    document.activeElement.id === "search-input"
  ) {
    if (event.key === "Enter") {
      gotoPageTitle(event.target.value)
      event.preventDefault()
      return
    } else if (event.key === "Tab") {
      console.log("goto suggestion")
      const selected = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`)
      if (selected) {
        gotoSuggestion(selected)
        return
      }
    }
  }
})

document.addEventListener("click",(event) => {
  const closestBullet = event.target.closest(".block__bullet")
  if (event.target.className === "page-ref__body") {
    gotoPageTitle(event.target.innerText)
  } else if (closestBullet) {
    gotoBlock(closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    gotoBlock(event.target.dataset.id)
  } else if (event.target.closest(".tag")) {
    gotoPageTitle(event.target.closest(".tag").innerText.substring(1))
  } else if (event.target.id === "download-button") {
    downloadHandler()
  } else if (event.target.id === "upload-button") {
    document.getElementById("upload-input").click()
  } else if (event.target.id === "daily-notes-button") {
    gotoDailyNotes()
  } else if (event.target.className === "autocomplete__suggestion") {
    gotoSuggestion(event.target)
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
    gotoDailyNotes()
    setTimeout(() => saveWorker.postMessage(["save",store]),0)
  })
})

const saveWorker = new Worker('/worker.js')


if (w) {
  gotoDailyNotes()
  setTimeout(() => saveWorker.postMessage(["save",store]),0)
} else {
  w = true
}

// const t = performance.now()
// for (let i = 0; i < 1000000; i++) {
//   getSelection()
// }
// console.log(`took ${performance.now() - t}`)

const test = () => {
  const testScriptNode = document.createElement("script")
  testScriptNode.src = "test.js"
  document.body.appendChild(testScriptNode)
}
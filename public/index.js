/*

where can the cursor be?
MainFrame
Sidebar

when I add embeds, they will be an extra prop in active page, for instance {focusedBlock:blockId, embeddedFocusedBlock:{id,position}}
*/

const initialDailyNotes = 5

/**
What if I set the session state directly & rendered session state instead of functions?
goto({pageFrame:{type:"pageTitle", title:"Welcome to Micro Roam"}})?
 */
const renderersPageFrame = {

  // each one of these takes a terse command and a session state, and expands that command 

  pageTitle: () => {
    let existingPage = store.pagesByTitle[sessionState.pageFrameTitle]
    if (existingPage === undefined) {
      existingPage = runCommand("createPage",sessionState.title)
    }
    renderPage(pageFrame,existingPage)
  },
  block: () => {
    const blockFocusFrame = blockFocusFrameTemplate.cloneNode(true)
    pageFrame.appendChild(blockFocusFrame)
    renderBlock(blockFocusFrame,sessionState.pageFrameId)
    const backRefs = store.blocks[sessionState.pageFrameId].backRefs
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
    for (let i = 0; i < 1000; i++) {
      const daysNotes = store.pagesByTitle[formatDate(oldestLoadedDailyNoteDate)]
      if (daysNotes) {
        renderPage(pageFrame,daysNotes)
        pageFrame.appendChild(pageBreakTemplate.cloneNode(true))
        numNotesLoaded += 1
        if (numNotesLoaded >= initialDailyNotes) {
          break
        }
      }
      oldestLoadedDailyNoteDate.setDate(
        oldestLoadedDailyNoteDate.getDate() - 1
      )
    }
    if (numNotesLoaded < initialDailyNotes) pageFrame.lastChild.remove()
  }
}

const sessionStateCommands = {
  dailyNotes: () => {
    sessionState.pageFrame = "dailyNotes"
  },
  pageTitle: (title) => {
    sessionState.pageFrame = "pageTitle"
    sessionState.pageFrameTitle = title
  },
  block: (id) => {
    sessionState.pageFrame = "block"
    sessionState.pageFrameId = id
  }
}

const renderSessionState = () => {
  // clear screen
  autocompleteList.style.display = "none"
  searchResultList.style.display = "none"
  oldestLoadedDailyNoteDate = null
  pageFrameOuter.removeEventListener("scroll",dailyNotesInfiniteScrollListener)
  pageFrameOuter.scrollTop = 0
  pageFrame.innerHTML = ""
  searchInput.value = ""

  // render state
  renderersPageFrame[sessionState.pageFrame]()

  if (sessionState.isFocused) {
    focusIdPosition()
  }

  pageFrameOuter.scrollTop = sessionState.scroll
}

const gotoNoHistory = (...command) => {

  updateCursorInfo()

  sessionStateCommands[command[0]](...command.slice(1))

  renderSessionState()

  pageFrameOuter.scrollTop = 0
}

const goto = (...command) => {
  sessionState.scroll = pageFrameOuter.scrollTop
  const oldSessionState = JSON.parse(JSON.stringify(sessionState))
  gotoNoHistory(...command)
  setTimeout(() => {
    history.replaceState(oldSessionState,"Micro Roam")
    // todo use page title, in more places than just this because apparently it's not often supported
    history.pushState(sessionState,"Micro Roam")
  },0)
}

const gotoReplaceHistory = (...command) => {
  gotoNoHistory(...command)
  history.replaceState(sessionState,"Micro Roam")
}

window.addEventListener("popstate",(event) => {
  console.log(event.state)
  if (event.state) {
    sessionState = event.state
    renderSessionState()
  }
})

const focusIdPosition = () => {
  focusedBlockBody = document.querySelector(`.block[data-id="${sessionState.focusId}"]>.block__body`)

  const scanElement = (element) => {
    for (let el of element.childNodes) {
      if (el.nodeName === "#text") {
        if (el.textContent && sessionState.position >= el.startIdx && sessionState.position < el.startIdx + el.textContent.length) {
          scanResult = el
          try {
            getSelection().collapse(el,sessionState.position - el.startIdx) // this does the thing correctly, but then throws an error, which I catch? todo investigate
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
  scanElement(focusedBlockBody)
}

const renderBlockBodyWithCursor = (string) => {
  focusedBlockBody.innerHTML = ""
  focusedBlockBody.style.display = "none"
  const result = renderBlockBody(focusedBlockBody,string)
  focusedBlockBody.style.display = "block"
  focusIdPosition()
  return result
}

const updateCursorInfo = () => {
  focusedNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset
  if (focusedNode) {
    focusedBlock = focusedNode.parentNode.closest(".block")
    if (focusedBlock) {

      sessionState.isFocused = true
      sessionState.position = getCursorPositionInBlock()
      sessionState.focusId = focusedNode.parentNode.closest(".block").dataset.id

      focusedBlockBody = focusedBlock.children[1]
      editingLink = focusedBlock && getCurrentLink()
      editingTitle = editingLink && ((editingLink.className === "tag" && editingLink.innerText.substring(1)) || (editingLink.className === "page-ref" && editingLink.children[1].innerText))
    } else {
      sessionState.isFocused = false
    }
  } else {
    sessionState.isFocused = false
  }
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


// start the save worker
const saveWorker = new Worker('/worker.js')

saveWorker.postMessage(["user",user])

saveWorker.onmessage = (event) => {
  const data = event.data[1]
  const operation = event.data[0]
  if (operation === "ping") {
    console.log(`ping took ${performance.now() - pingstime}`)
  }

}


// Finally starting the program after everything's compiled
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
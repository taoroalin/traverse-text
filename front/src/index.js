const initialDailyNotes = 5

const renderSessionState = () => {

  // clear screen
  searchResultList.style.display = "none"
  pageFrameOuter.removeEventListener("scroll",dailyNotesInfiniteScrollListener)
  pageFrame.innerHTML = ""
  searchInput.value = ""

  // render state
  switch (sessionState.pageFrame) {
    case "pageTitle":
      let existingPage = store.pagesByTitle[sessionState.pageFrameTitle]
      if (existingPage === undefined) {
        existingPage = runCommand("createPage",sessionState.pageFrameTitle)
      }
      renderPage(pageFrame,existingPage)
      break
    case "block":
      const blockFocusFrame = blockFocusFrameTemplate.cloneNode(true)
      pageFrame.appendChild(blockFocusFrame)
      renderBreadcrumb(blockFocusFrame.children[0],sessionState.pageFrameId)
      renderBlock(blockFocusFrame.children[1],sessionState.pageFrameId)
      const backRefs = store.blocks[sessionState.pageFrameId].backRefs
      if (backRefs) {
        backRefs.sort((a,b) => store.blocks[b]["edit-time"] - store.blocks[a]["edit-time"])
        const backrefsListElement = backrefListTemplate.cloneNode(true)
        blockFocusFrame.children[2].appendChild(backrefsListElement)
        for (let backref of backRefs) {
          renderBlock(backrefsListElement.children[1],backref)
        }
      }
      break
    case "dailyNotes":
      pageFrameOuter.addEventListener("scroll",dailyNotesInfiniteScrollListener)
      sessionState.oldestDate = new Date(Date.now())
      let numNotesLoaded = 0
      if (store.pagesByTitle[formatDate(sessionState.oldestDate)] === undefined) {
        runCommand("createPage",formatDate(sessionState.oldestDate))
      }
      for (let i = 0; i < 1000; i++) {
        const daysNotes = store.pagesByTitle[formatDate(sessionState.oldestDate)]
        if (daysNotes) {
          renderPage(pageFrame,daysNotes)
          pageFrame.appendChild(pageBreakTemplate.cloneNode(true))
          numNotesLoaded += 1
          if (numNotesLoaded >= initialDailyNotes) {
            break
          }
        }
        sessionState.oldestDate.setDate(
          sessionState.oldestDate.getDate() - 1
        )
      }
      if (numNotesLoaded < initialDailyNotes) pageFrame.lastChild.remove()
      break
  }

  if (sessionState.isFocused) {
    focusIdPosition()
  }

  pageFrameOuter.scrollTop = sessionState.scroll || 0
}

const gotoNoHistory = (commandName,...command) => {
  switch (commandName) {
    case "dailyNotes":
      sessionState.pageFrame = "dailyNotes"
      break
    case "pageTitle":
      sessionState.pageFrame = "pageTitle"
      sessionState.pageFrameTitle = command[0]
      break
    case "block":
      sessionState.pageFrame = "block"
      sessionState.pageFrameId = command[0]
      break
  }

  renderSessionState()
}

const goto = (...command) => {
  sessionState.scroll = pageFrameOuter.scrollTop // used to have updatecursorinfo here, think I don't need it?

  const oldSessionState = JSON.parse(JSON.stringify(sessionState))

  sessionState.isFocused = false
  sessionState.scroll = 0
  gotoNoHistory(...command)
  setTimeout(() => {
    history.replaceState(oldSessionState,"Micro Roam")
    // todo use page title, in more places than just this because apparently here's not often supported
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
  focusBlockBody = document.querySelector(`.block[data-id="${sessionState.focusId}"]>.block__body`)

  const scanElement = (element) => {
    for (let el of element.childNodes) {
      if (el.nodeName === "#text") {
        if (el.textContent && sessionState.position >= el.startIdx && sessionState.position < el.startIdx + el.textContent.length) {
          scanResult = el
          try {
            // this does the thing correctly, but then throws an error, which I catch? todo investigate
            getSelection().collapse(el,sessionState.position - el.startIdx)
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
  scanElement(focusBlockBody)
}

const setFocusedBlockString = (string) => {
  focusBlockBody.innerHTML = ""
  const refTitles = renderBlockBody(focusBlockBody,string)
  focusIdPosition()
  updateCursorInfo()
  runCommand("writeBlock",sessionState.focusId,string,refTitles)
}

// todo call this less. right now it's called twice as much as necessary, costing 0.3ms per keystroke and making code ugly
// todo also get rid of this entirely. it's a complete mess
const updateCursorInfo = () => {

  focusNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset

  focusSuggestion = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`) || templateList.querySelector(`.template__suggestion[data-selected="true"]`)

  if (focusNode) {
    focusBlock = focusNode.parentNode.closest(".block")
    if (focusBlock) {

      sessionState.isFocused = true
      sessionState.focusId = focusBlock.dataset.id

      if (focusNode.className === "block__body") {
        sessionState.position = focusBlock.innerText.length * (focusOffset !== 0) // todo make this less jank
      } else {
        sessionState.position = focusOffset
        if (focusNode.startIdx) sessionState.position += focusNode.startIdx
      }
      focusBlockBody = focusBlock.children[1]

      editingLink = undefined
      const pageRefs = focusBlockBody.querySelectorAll(".page-ref")
      const tags = focusBlockBody.querySelectorAll(".tag")
      for (let tag of tags) {
        if (tag.childNodes[0].endIdx >= sessionState.position && tag.childNodes[0].startIdx < sessionState.position) {
          editingLink = tag
        }
      }
      for (let ref of pageRefs) {
        if (ref.children[1].childNodes[0].endIdx >= sessionState.position && ref.children[1].childNodes[0].startIdx < sessionState.position) {
          editingLink = ref
        }
      }
      editingTitle = editingLink && ((editingLink.className === "tag" && editingLink.innerText.substring(1)) || (editingLink.className === "page-ref" && editingLink.children[1].innerText))

      editingTemplateExpander = undefined
      const templateExpanders = focusBlockBody.querySelectorAll(".template-expander")
      for (let temp of templateExpanders) {
        if (temp.childNodes[0].endIdx >= sessionState.position && temp.childNodes[0].startIdx < sessionState.position) {
          editingTemplateExpander = temp
        }
      }

    } else
      sessionState.isFocused = false

  } else
    sessionState.isFocused = false

}

const parseStackTrace = (string) => {
  const result = []
  const matches = string.matchAll(/([^ ]+) \(([^\)]+):([0-9]+):([0-9]+)\)(?:\n|$)/g)
  for (let match of matches) {
    result.push({ function: match[1],file: match[2],line: match[3],column: match[4] })
  }
  return result
}

window.onerror = (message,url,lineNumber,columnNumber,error) => {
  const errorInfo = { line: lineNumber,file: url,stack: parseStackTrace(error.stack),message,column: columnNumber }
  const existingErrors = localStorage.getItem("error_log")
  if (existingErrors) {
    const z = JSON.parse(existingErrors)
    z.push(errorInfo)
    localStorage.setItem("error_log",JSON.stringify(z))
  } else {
    localStorage.setItem("error_log",JSON.stringify([errorInfo]))
  }
  // todo send error to server at this point
  return false // we don't actually "catch" the error, we just report that it happened. The error is still an error
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
  theresANewStore()
} else {
  w = true
}


// const ptest = () => {
//   const t = performance.now()
//   for (let i = 0; i < 1000000; i++) {
//
//   }
//   console.log(`took ${performance.now() - t}`)
// }
// ptest()
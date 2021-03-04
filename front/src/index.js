/**
example query string
?title=Micro Roam&scroll=100&focus=fS4vHpM2_&position=10
 */
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
      let existingPage = store.titles[sessionState.page]
      if (existingPage === undefined) {
        existingPage = macros.createPage(sessionState.page)
      }
      renderPage(pageFrame,existingPage)
      break
    case "block":
      const blockFocusFrame = blockFocusFrameTemplate.cloneNode(true)
      pageFrame.appendChild(blockFocusFrame)
      renderBreadcrumb(blockFocusFrame.children[0],sessionState.block)
      renderBlock(blockFocusFrame.children[1],sessionState.block)
      const backRefs = store.refs[sessionState.block]
      if (backRefs) {
        backRefs.sort((a,b) => store.blox[b].et - store.blox[a].et)
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
      if (store.titles[formatDate(sessionState.oldestDate)] === undefined) {
        macros.createPage(formatDate(sessionState.oldestDate))
      }
      for (let i = 0; i < 1000; i++) {
        const daysNotes = store.titles[formatDate(sessionState.oldestDate)]
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

  focusBlockStart(document.querySelector(".block"))
}

const gotoNoHistory = (commandName,...command) => {
  switch (commandName) {
    case "dailyNotes":
      sessionState.pageFrame = "dailyNotes"
      break
    case "pageTitle":
      sessionState.pageFrame = "pageTitle"
      sessionState.page = command[0]
      break
    case "block":
      sessionState.pageFrame = "block"
      sessionState.block = command[0]
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
  focusBlockBody = document.querySelector(`.block[data-id="${sessionState.focusId}"]>.block__body`) // todo this looks wrong

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
  const fragment = document.createDocumentFragment()
  const refTitles = renderBlockBody(fragment,string)
  focusBlockBody.appendChild(fragment)
  focusIdPosition()
  updateCursorInfo()
  macros.write(sessionState.focusId,string,refTitles)
}

const getEditingSimpleSpan = (className) => {
  const elements = focusBlockBody.querySelectorAll("." + className)
  for (let temp of elements) {
    if (temp.childNodes[0].endIdx >= sessionState.position && temp.childNodes[0].startIdx < sessionState.position) {
      return temp
    }
  }
}

// todo call this less. right now it's called twice as much as necessary, costing 0.3ms per keystroke and making code ugly
// todo also get rid of this entirely. it's a complete mess
const updateCursorInfo = () => {

  focusNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset

  focusSuggestion = autocompleteList.querySelector(`.autocomplete__suggestion[data-selected="true"]`) || templateList.querySelector(`.template__suggestion[data-selected="true"]`)

  focusSearchResult = searchResultList.querySelector(`.search-result[data-selected="true"]`)

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

      editingTemplateExpander = getEditingSimpleSpan("template-expander")

      editingUrlElement = getEditingSimpleSpan("url")

    } else
      sessionState.isFocused = false

  } else
    sessionState.isFocused = false

}



const dailyNotesInfiniteScrollListener = () => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    for (let i = 0; i < 100; i++) {
      sessionState.oldestDate.setDate(sessionState.oldestDate.getDate() - 1)
      const daysNotes = store.titles[formatDate(sessionState.oldestDate)]
      if (daysNotes) {
        renderPage(pageFrame,daysNotes)
        pageFrame.appendChild(pageBreakTemplate.cloneNode(true))
        break
      }
    }
  }
}


const parseStackTrace = (string) => {
  const result = []
  const matches = string.matchAll(/([^ ]+) \(([^\)]+):([0-9]+):([0-9]+)\)(?:\n|$)/g)
  for (let match of matches) {
    result.push({ function: match[1],file: match[2],line: match[3],column: match[4] })
  }
  return result
}
const logError = (message,url,lineNumber,columnNumber,error) => {
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

window.onerror = logError


// Finally starting the program after everything's compiled
finishStartupThread()


// const ptest = () => {
//   const t = performance.now()
//   let y = undefined
//   for (let i = 0; i < 10000000; i++) {
//     if (y === undefined) y = []
//     y.push(1)
//     y = undefined
//   }
//   console.log(`took ${performance.now() - t}`)
// }
// ptest()
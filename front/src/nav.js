/**
example query string
?title=Micro Roam&scroll=100&focus=fS4vHpM2_&position=10
 */
const initialDailyNotes = 5

const renderSessionState = () => {

  // clear screen
  searchResultList.style.display = "none"
  pageFrameOuter.removeEventListener("scroll", dailyNotesInfiniteScrollListener)
  pageFrame.innerHTML = ""
  searchInput.value = ""

  // render state
  switch (sessionState.pageFrame) {
    case "pageTitle":
      let existingPage = store.titles[sessionState.page]
      if (existingPage === undefined) {
        existingPage = macros.createPage(sessionState.page)
      }
      renderPage(pageFrame, existingPage)
      break
    case "block":
      const blockFocusFrame = blockFocusFrameTemplate.cloneNode(true)
      pageFrame.appendChild(blockFocusFrame)
      renderBreadcrumb(blockFocusFrame.children[0], sessionState.block)
      renderBlock(blockFocusFrame.children[1], sessionState.block)
      const backRefs = store.refs[sessionState.block]
      if (backRefs) {
        backRefs.sort((a, b) => store.blox[b].et - store.blox[a].et)
        const backrefsListElement = backrefListTemplate.cloneNode(true)
        blockFocusFrame.children[2].appendChild(backrefsListElement)
        for (let backref of backRefs) {
          renderBlock(backrefsListElement.children[1], backref)
        }
      }
      break
    case "dailyNotes":
      pageFrameOuter.addEventListener("scroll", dailyNotesInfiniteScrollListener)
      sessionState.oldestDate = new Date(Date.now())
      let numNotesLoaded = 0
      console.log(store.titles)
      let dateString = formatDate(sessionState.oldestDate)
      generateTitles(store) // todo get rid of title corruption and remove this. it's here because the titles are always corrupted at this point, I have no idea why.
      if (!store.titles[dateString]) {
        console.log(`creating page ${dateString}`)
        macros.createPage(dateString)
      }
      for (let i = 0; i < 1000; i++) {
        const daysNotes = store.titles[dateString]
        if (daysNotes) {
          renderPage(pageFrame, daysNotes)
          const pageBreak = document.createElement("div")
          pageBreak.className = "page-break"
          pageFrame.appendChild(pageBreak)
          numNotesLoaded += 1
          if (numNotesLoaded >= initialDailyNotes) {
            break
          }
        }
        sessionState.oldestDate.setDate(
          sessionState.oldestDate.getDate() - 1
        )
        dateString = formatDate(sessionState.oldestDate)

      }
      if (numNotesLoaded < initialDailyNotes) pageFrame.lastChild.remove() // remove last page divider
      break
  }

  if (!sessionState.isFocused || !pageFrame.querySelector(`.block[data-id="${sessionState.focusId}"]`)) {
    const firstBlockElement = pageFrame.querySelector('.block')
    sessionState.position = 0
    sessionState.focusId = firstBlockElement.dataset.id
  } else {
    console.log(`SESSION STATE ALREADY FOCUSED ON ${sessionState.focusId}`)
  }
  focusIdPosition()

  pageFrameOuter.scrollTop = sessionState.scroll || 0

}

const gotoNoHistory = (commandName, ...command) => {
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
  sessionState.scroll = pageFrameOuter.scrollTop

  const oldSessionState = JSON.parse(JSON.stringify(sessionState))

  sessionState.isFocused = false
  sessionState.scroll = 0
  gotoNoHistory(...command)
  setTimeout(() => {
    history.replaceState(oldSessionState, "Micro Roam")
    // todo use page title, in more places than just this because apparently here's not often supported
    history.pushState(sessionState, "Micro Roam")
  }, 0)
}

const gotoReplaceHistory = (...command) => {
  gotoNoHistory(...command)
  history.replaceState(sessionState, "Micro Roam")
}

window.addEventListener("popstate", (event) => {
  console.log(event.state)
  if (event.state) {
    sessionState = event.state
    renderSessionState()
  }
})


const dailyNotesInfiniteScrollListener = () => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    for (let i = 0; i < 100; i++) {
      sessionState.oldestDate.setDate(sessionState.oldestDate.getDate() - 1)
      const daysNotes = store.titles[formatDate(sessionState.oldestDate)]
      if (daysNotes) {
        renderPage(pageFrame, daysNotes)
        const pageBreak = document.createElement("div")
        pageBreak.className = "page-break"
        pageFrame.appendChild(pageBreak)
        break
      }
    }
  }
}


const parseStackTrace = (string) => {
  const result = []
  const matches = string.matchAll(/([^ ]+) \(([^\)]+):([0-9]+):([0-9]+)\)(?:\n|$)/g)
  for (let match of matches) {
    result.push({ function: match[1], file: match[2], line: match[3], column: match[4] })
  }
  return result
}
const logError = (message, url, lineNumber, columnNumber, error) => {
  const errorInfo = { line: lineNumber, file: url, stack: parseStackTrace(error.stack), message, column: columnNumber }
  const existingErrors = localStorage.getItem("error_log")
  if (existingErrors) {
    const z = JSON.parse(existingErrors)
    z.push(errorInfo)
    localStorage.setItem("error_log", JSON.stringify(z))
  } else {
    localStorage.setItem("error_log", JSON.stringify([errorInfo]))
  }
  // todo send error to server at this point
  return false // we don't actually "catch" the error, we just report that it happened. The error is still an error
}

window.onerror = logError


const showTopBar = () => {
  topBar.style.marginTop = "0px"
  topBarHiddenHitbox.style.display = "none"
}
const hideTopBar = () => {
  topBar.style.marginTop = "-43px"
  topBarHiddenHitbox.style.display = "block"
}
const saveUser = () => {
  document.body.className = user.s.theme
  if (user.s.topBar === "visible") showTopBar()
  else hideTopBar()

  document.body.spellcheck = user.s.spellcheck
  document.body.dataset['editingspotlight'] = user.s.editingSpotlight

  if (user.h) {
    signOutButton.style.display = "block"
    signupButton.style.display = "none"
  } else {
    signOutButton.style.display = "none"
    signupButton.style.display = "block"
  }
  saveUserJustLocalStorage()
  saveSettingsToBasicBitchServer()
}

const saveUserJustLocalStorage = () => {
  localStorage.setItem("user", JSON.stringify(user))

}


// Finally starting the program after everything's compiled
if (dataLoaded) start()
scriptsLoaded = true


const ptest = () => {
  const t2 = performance.now()
  for (let i = 0; i < 100; i++) {
    generateInnerOuterRefs()
  }
  const took = (performance.now() - t2)
  console.log(`thing took ${took}`)
}
// ptest()

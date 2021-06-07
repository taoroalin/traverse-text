/**
example query string
?title=Micro Roam&scroll=100&focus=fS4vHpM2_&position=10
 */
const initialDailyNotes = 5

/**
url template
graphName/type/id-or-title/?scroll=scroll&focus=id&position=position
 */
const sessionStateToUrl = (sessionState) => {
  let url = "/#/" + sessionState.graphName + "/" + sessionState.pageFrame
  if (sessionState.page) url += "/" + sessionState.page
  if (sessionState.block) url += "/" + sessionState.block
  if (sessionState.scroll !== 0 || sessionState.focusId) {
    url += "?"
    if (sessionState.scroll !== 0) {
      url += "scroll=" + Math.round(sessionState.scroll) + "&"
    }
    if (sessionState.focusId) {
      url += "focusId=" + sessionState.focusId
    }
  }
  url = encodeURI(url)
  return url
}

const renderSessionState = () => {

  if (idElements.pageFrameOuter.firstElementChild !== idElements.pageFrame) {
    idElements.pageFrameOuter.appendChild(idElements.pageFrame)
  }

  // clear screen
  idElements.searchResultList.style.display = "none"
  idElements.pageFrameOuter.removeEventListener("scroll", dailyNotesInfiniteScrollListener)
  idElements.pageFrame.innerHTML = ""
  idElements.searchInput.value = ""
  console.log(sessionState.pageFrame)
  // render state
  switch (sessionState.pageFrame) {
    case "pageTitle":
      const graphName = sessionState.graphName
      if (graphName === user.s.graphName) {
        console.log('this graph name')
        let existingPage = store.titles[sessionState.page]
        if (existingPage === undefined) {
          console.log('creating block')
          existingPage = macros.createPage(sessionState.page)
        }
        render.page(store, idElements.pageFrame, existingPage)
      } else if (graphName in otherStores) {
        let existingPage = otherStores[graphName].titles[sessionState.page]
        if (existingPage === undefined) {
          existingPage = macros.createPage(sessionState.page)
        }
        render.page(otherStores[graphName], idElements.pageFrame, existingPage)
      } else {
        addOtherStore(graphName).then(store => {
          renderSessionState()
        })
      }
      break
    case "block":
      const theStore = sessionState.graphName ? otherStores[sessionState.graphName] : store
      render.blockFramed(theStore, idElements.pageFrame, sessionState.block)
      break
    case "dailyNotes":
      idElements.pageFrameOuter.addEventListener("scroll", dailyNotesInfiniteScrollListener)
      sessionState.oldestDate = new Date(Date.now())
      let numNotesLoaded = 0
      let dateString = formatDate(sessionState.oldestDate)
      if (!store.titles || Object.keys(store.titles).length === 0) generateTitles(store)
      // todo get rid of title corruption and remove this. it's here because the titles are always corrupted at this point, I have no idea why.
      if (store.titles[dateString] === undefined) {
        console.log(`creating page ${dateString}`)
        macros.createPage(dateString)
      }
      for (let i = 0; i < 1000; i++) {
        const daysNotes = store.titles[dateString]
        if (daysNotes !== undefined) {
          render.page(store, idElements.pageFrame, daysNotes)
          const pageBreak = document.createElement("div")
          pageBreak.className = "page-break"
          idElements.pageFrame.appendChild(pageBreak)
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
      if (numNotesLoaded < initialDailyNotes) idElements.pageFrame.lastChild.remove() // remove last page divider
      break
    case "overview":
      console.log(`RENDERING OVERVIEW`)
      idElements.pageFrameOuter.innerHTML = ""
      generateInnerOuterRefs(store)
      renderOverview(idElements.pageFrameOuter, store)
      break
    default:
      notify(`unknown view: ${sessionState.pageFrame}`)
  }

  if (sessionState.graphName === user.s.graphName) {
    if (!sessionState.isFocused || !idElements.pageFrame.querySelector(`.block[data-id="${sessionState.focusId}"]`)) {
      const firstBlockElement = idElements.pageFrame.querySelector('.block')
      if (firstBlockElement) {
        sessionState.position = 0
        sessionState.focusId = firstBlockElement.dataset.id
      }
    } else {
      console.log(`SESSION STATE ALREADY FOCUSED ON ${sessionState.focusId}`)
    }
    if (sessionState.focusId)
      focusIdPosition()
  }

  idElements.pageFrameOuter.scrollTop = sessionState.scroll || 0

}

const gotoNoHistory = (commandName, ...command) => {
  sessionState.page = undefined
  sessionState.block = undefined
  switch (commandName) {
    case "dailyNotes":
      sessionState.pageFrame = "dailyNotes"
      sessionState.graphName = command[0] || user.s.graphName
      break
    case "pageTitle":
      sessionState.pageFrame = "pageTitle"
      sessionState.page = command[0]
      sessionState.graphName = command[1] || user.s.graphName
      break
    case "block":
      sessionState.pageFrame = "block"
      sessionState.block = command[0]
      sessionState.graphName = command[1] || user.s.graphName
      break
  }

  renderSessionState()
}

const goto = (...command) => {
  sessionState.scroll = idElements.pageFrameOuter.scrollTop

  const oldSessionState = cpy(sessionState)

  sessionState.isFocused = false
  sessionState.scroll = 0
  gotoNoHistory(...command)
  setTimeout(() => {
    history.replaceState(oldSessionState, "Traverse Text", sessionStateToUrl(oldSessionState))
    // todo use page title, in more places than just this because apparently here's not often supported
    history.pushState(sessionState, "Traverse Text", sessionStateToUrl(sessionState))
  }, 0)
}

const gotoReplaceHistory = (...command) => {
  gotoNoHistory(...command)
  history.replaceState(sessionState, "Traverse Text")
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
    idElements.pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    for (let i = 0; i < 100; i++) {
      sessionState.oldestDate.setDate(sessionState.oldestDate.getDate() - 1)
      const daysNotes = store.titles[formatDate(sessionState.oldestDate)]
      if (daysNotes) {
        render.page(otherStores[sessionState.graphName], idElements.pageFrame, daysNotes)
        const pageBreak = document.createElement("div")
        pageBreak.className = "page-break"
        idElements.pageFrame.appendChild(pageBreak)
        break
      }
    }
  }
}

const logError = async (message, url, lineNumber, columnNumber, error) => {
  clientGo.logError(error.stack)
}

window.onerror = logError

// Finally starting the program after everything's compiled
navLoaded = true
if (graphState === "loaded") {
  renderSessionState()
}
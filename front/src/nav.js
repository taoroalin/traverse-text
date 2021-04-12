/**
example query string
?title=Micro Roam&scroll=100&focus=fS4vHpM2_&position=10
 */
const initialDailyNotes = 5

const urlToSessionState = (url) => {
  url = decodeURI(url)
  const sessionState = {}
  const paths = url.matchAll(/(?:\/([a-zA-Z0-9\-_]))/g)
  if (paths.length === 0) {
    sessionState.graphName = paths[0][1]
  } else {
    sessionState.graphName = user.s.graphName
  }

  if (paths.length === 1) {
    sessionState.pageFrame = "dailyNotes"
  } else {
    sessionState.pageFrame = paths[1][1]
    if (sessionState.pageFrame === 'page') {
      sessionState.title = paths[2][1]
    }
    if (sessionState.pageFrame === 'block') {
      sessionState.block = paths[2][1]
    }
  }

  const queries = url.matchAll(/([a-zA-Z0-9\-_])=([a-zA-Z0-9\-_])/g)
  for (let query of queries) {
    sessionState[query[1]] = query[2]
  }
  return sessionState
}
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
      url += "scroll=" + sessionState.scroll + "&"
    }
    if (sessionState.focusId) {
      url += "focus=" + sessionState.focusId
    }
  }
  url = encodeURI(url)
  return url
}

const renderSessionState = () => {

  // clear screen
  searchResultList.style.display = "none"
  pageFrameOuter.removeEventListener("scroll", dailyNotesInfiniteScrollListener)
  pageFrame.innerHTML = ""
  searchInput.value = ""


  // render state
  switch (sessionState.pageFrame) {
    case "pageTitle":
      const graphName = sessionState.graphName
      if (graphName === user.s.graphName) {
        let existingPage = store.titles[sessionState.page]
        if (existingPage === undefined) {
          existingPage = macros.createPage(sessionState.page)
        }
        renderPage(store, pageFrame, existingPage)
      } else if (graphName in stores) {
        let existingPage = stores[graphName].titles[sessionState.page]
        if (existingPage === undefined) {
          existingPage = macros.createPage(sessionState.page)
        }
        renderPage(stores[graphName], pageFrame, existingPage)
      } else {
        addOtherStore(graphName).then(store => {
          renderSessionState()
        })
      }
      break
    case "block":
      const theStore = sessionState.graphName ? otherStores[sessionState.graphName] : store
      renderBlockAsMainWithBacklinks(theStore, pageFrame, sessionState.block)
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
          renderPage(store, pageFrame, daysNotes)
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
  sessionState.scroll = pageFrameOuter.scrollTop

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
    pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    for (let i = 0; i < 100; i++) {
      sessionState.oldestDate.setDate(sessionState.oldestDate.getDate() - 1)
      const daysNotes = store.titles[formatDate(sessionState.oldestDate)]
      if (daysNotes) {
        renderPage(otherStores[sessionState.graphName], pageFrame, daysNotes)
        const pageBreak = document.createElement("div")
        pageBreak.className = "page-break"
        pageFrame.appendChild(pageBreak)
        break
      }
    }
  }
}

const logError = async (message, url, lineNumber, columnNumber, error) => {
  console.log("LOGGING ERROR")
  const headers = new Headers()
  headers.set('h', user.h)
  const res = await fetch(`${basicBitchServerUrl}/error`, { headers, method: 'POST', body: `${user.e}\n${error.stack}\n` })
  if (res.statusCode !== 200) {
    console.log(res)
  } else {
    console.log("ERROR LOGGED")
  }
}

window.onerror = logError


const showTopBar = () => {
  topBar.style.marginTop = "0px"
  topBarHiddenHitbox.style.display = "none"
}
const hideTopBar = () => {
  topBar.style.marginTop = "-36px"
  topBarHiddenHitbox.style.display = "block"
}
const saveUser = () => {
  document.body.className = user.s.theme
  if (user.s.topBar === "visible") showTopBar()
  else hideTopBar()

  document.body.spellcheck = user.s.spellcheck
  document.body.dataset['editingspotlight'] = user.s.editingSpotlight

  if (user.h) {
    topButtons["Sign Out"].style.display = "block"
    topButtons["Sign Up"].style.display = "none"
    topButtons["Login"].style.display = "none"
  } else {
    topButtons["Sign Out"].style.display = "none"
    topButtons["Sign Up"].style.display = "block"
    topButtons["Login"].style.display = "block"
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

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
  }
}

const goto = (...command) => { // no this is not an instruction pointer goto. This just switches the current page
  history.pushState(command,"Micro Roam") // todo make title change
  gotoNoHistory(...command)
}

const gotoNoHistory = (...command) => {
  // clear screen
  autocompleteList.style.display = "none"
  searchResultList.style.display = "none"
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


// start the save worker
const saveWorker = new Worker('/worker.js')

saveWorker.postMessage(["user",user])


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
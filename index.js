const manyAttributes = { ":node/subpages": true,":vc/blocks": true,":edit/seen-by": true,":attrs/lookup": true,":node/windows": true,":node/sections": true,":harc/v": true,":block/refs": true,":harc/a": true,"children": true,":create/seen-by": true,":node/links": true,":query/results": true,":harc/e": true,":block/parents": true }
// Constants

// Templates
const pageTemplate = document.getElementById("page").content.firstElementChild
const blockTemplate = document.getElementById("block").content.firstElementChild
const backrefsListTemplate = document.getElementById("backrefs-list").content.firstElementChild
const blockFocusFrameTemplate = document.getElementById("block-focus-frame").content.firstElementChild

// Singleton elements
const searchElement = document.getElementById("search")
const pageFrame = document.getElementById("page-frame")
const searchInput = document.getElementById("search__input")
const downloadButton = document.getElementById("download-button")

// Utils


// App state transitions
const gotoBlack = () => {
  oldestLoadedDailyNoteDate = null
  document.removeEventListener("scroll",dailyNotesInfiniteScrollListener)
  pageFrame.textContent = ""
}

const gotoPageTitle = (title) => {
  const existingPage = database.vae[title].title[0]
  if (existingPage) {
    gotoBlack()
    renderPage(pageFrame,existingPage)
  }
}

const gotoDailyNotes = () => {
  gotoBlack()
  document.addEventListener("scroll",dailyNotesInfiniteScrollListener)
  oldestLoadedDailyNoteDate = new Date(Date.now())
  let numNotesLoaded = 0
  for (let i = 0; i < 366; i++) {
    const daysNotes = database.vae[formatDate(oldestLoadedDailyNoteDate)]
    if (daysNotes && daysNotes.title) {
      renderPage(pageFrame,daysNotes.title[0])
      numNotesLoaded += 1
      if (numNotesLoaded > 10) {
        break
      }
    }
    oldestLoadedDailyNoteDate.setDate(
      oldestLoadedDailyNoteDate.getDate() - 1
    )
  }
}

// todo make this page look ok
const gotoBlock = (blockId) => {
  gotoBlack()
  const blockFocusFrame = blockFocusFrameTemplate.cloneNode(true)
  pageFrame.appendChild(blockFocusFrame)
  renderBlock(blockFocusFrame,blockId)

  if (database.vae[blockId]) {
    const backrefs = database.vae[blockId][":block/refs"]
    if (backrefs) {
      const backrefsListElement = backrefsListTemplate.cloneNode(true)
      blockFocusFrame.appendChild(backrefsListElement)
      for (let backref of backrefs) {
        renderBlock(backrefsListElement,backref)
      }
    }
  }
}

// Rendering
const renderPage = (parentNode,entityId) => {
  const element = pageTemplate.cloneNode(true)
  const title = element.firstElementChild
  const body = element.children[1]

  title.innerText = database.eav[entityId].title

  const children = database.eav[entityId].children
  if (children) {
    for (let child of children) {
      renderBlock(body,child)
    }
  }
  const uid = database.eav[entityId].uid
  const backrefs = database.vae[uid][":block/refs"]
  console.log(`backrefs ${backrefs} uid ${uid}`)
  console.log(database.vae[uid])
  if (backrefs) {
    const backrefsListElement = backrefsListTemplate.cloneNode(true)
    element.children[2].appendChild(backrefsListElement)
    for (let backref of backrefs) {
      renderBlock(backrefsListElement,backref)
    }
  }

  parentNode.appendChild(element)
}

const renderBlock = (parentNode,entityId) => {
  const element = blockTemplate.cloneNode(true)
  const body = element.children[1]
  const childrenContainer = element.children[2]
  element.setAttribute("data-id",entityId)

  const string = database.eav[entityId].string
  if (string) {
    renderBlockBody(body,string)
  }

  const children = database.eav[entityId].children
  if (children) {
    for (let child of children) {
      renderBlock(childrenContainer,child)
    }
  }
  parentNode.appendChild(element)
}

// Global event listeners that switch on active element, as a possibly more performant, simpler option than propagating through multiple event handlers

// Event listener functions that can't be written inline because multiple triggers / disconnect / reconnect

const dailyNotesInfiniteScrollListener = (event) => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - window.innerHeight
  if (fromBottom < 700) {
    oldestLoadedDailyNoteDate.setDate(oldestLoadedDailyNoteDate.getDate() - 1)
    const daysNotes =
      database.vae[formatDate(oldestLoadedDailyNoteDate)].title
    if (daysNotes) {
      renderPage(pageFrame,(daysNotes)[0])
    }
  }
}

const saveHandler = () => {
  console.log("save")
}

const downloadHandler = () => {
  console.log("download")
  const result = []
  console.log(database.aev.title)
  for (let pageId in database.aev.title) {
    result.push(database.pull(pageId))
  }
  const json = JSON.stringify(result)
  const data = new Blob([json],{ type: 'text/json' })
  const url = window.URL.createObjectURL(data)
  downloadButton.setAttribute('href',url)
  downloadButton.setAttribute('download',"output.json")
}

const toggleSearch = () => {
  if (searchElement.style.display === "none") {
    searchElement.style.display = "block"
    searchInput.value = ""
    searchInput.focus()
  } else {
    searchElement.style.display = "none"
  }
}

document.addEventListener("input",(event) => {
  // reparse block and insert cursor into correct position while typing
  const block = event.target.closest(".block__body")
  if (block) {
    const selection = window.getSelection()
    const focusNode = selection.focusNode
    let position = selection.focusOffset
    if (focusNode.startIdx) position += focusNode.startIdx
    let curIdx = 0

    const id = block.dataset.id
    let string = block.innerText
    if (block.innerText.length === position)
      string += " "
    database.setDatom(id,"string",string)
    block.textContent = ""
    renderBlockBody(block,string,position)

    const scanElement = (element) => {
      for (let el of element.childNodes) {
        if (el.nodeName === "#text") {
          if (position < curIdx + el.textContent.length) {
            selection.collapse(el,position - curIdx)
            return
          }
          curIdx += el.textContent.length
        } else {
          scanElement(el)
        }
      }
    }
    scanElement(block)
  }
})

document.addEventListener("keydown",(event) => {
  // Check for global shortcut keys
  if (event.key === "d" && event.ctrlKey) {
    uploadHandler()
    event.preventDefault()
    return
  }
  if (event.key === "s" && event.ctrlKey && event.shiftKey) {
    downloadHandler()
    event.preventDefault()
    return
  }
  if (event.key === "s" && event.ctrlKey) {
    saveHandler()
    event.preventDefault()
    return
  }
  if (event.key === "m" && event.ctrlKey) {
    if (document.body.className === "light-mode") {
      document.body.className = "dark-mode"
    } else {
      document.body.className = "light-mode"
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
    toggleSearch()
    event.preventDefault()
    return
  }

  // Check for actions based on active element
  if (
    document.activeElement &&
    document.activeElement.className === "block__body"
  ) {
    let blocks
    switch (event.key) {
      case "Enter":
        break
      case "Tab":
        if (event.shiftKey) {
        } else {
        }
        event.preventDefault()
        break
      case "ArrowDown":
        blocks = (document.querySelectorAll(".block__body"))
        const newActiveBlock = blocks[blocks.indexOf(event.target) + 1]
        window.getSelection().collapse(newActiveBlock,0)
        break
      case "ArrowUp":
        blocks = (document.querySelectorAll(".block__body"))
        blocks[blocks.indexOf(event.target) - 1].focus()
        break
      case "ArrowLeft":
        if (window.getSelection().focusOffset === 0) {
          blocks = (document.querySelectorAll(".block__body"))
          blocks[blocks.indexOf(document.activeElement) - 1].focus()
          // TODO it only goes to second last, .collapse doesn't select after the last char
          window
            .getSelection()
            .collapse(
              document.activeElement.firstChild,
              document.activeElement.innerText.length
            )
        }
        break
      case "ArrowRight":
        if (
          window.getSelection().focusOffset ===
          document.activeElement.innerText.length
        ) {
          blocks = (document.querySelectorAll(".block__body"))
          blocks[blocks.indexOf(document.activeElement) + 1].focus()
        }
        break
    }
  } else if (
    document.activeElement &&
    document.activeElement.id === "search__input"
  ) {
    if (event.key === "Enter") {
      gotoPageTitle(event.target.value)
      searchElement.style.display = "none"
      event.preventDefault()
      return
    }
  }
})

document.addEventListener("click",(event) => {
  const closestBullet = event.target.closest(".block__bullet-hitbox")
  if (event.target.className === "page-ref__body") {
    gotoPageTitle(event.target.innerText)
  } else if (closestBullet) {
    gotoBlock(closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    gotoBlock(event.target.dataset.id)
  } else if (event.target.closest(".tag")) {
    gotoPageTitle(event.target.closest(".tag").innerText.substring(1))
  } else if (event.target.id === "search-button") {
    toggleSearch()
  } else if (event.target.id === "download-button") {
    downloadHandler()
  } else if (event.target.id === "upload-button") {
    document.getElementById("upload-input").click()
  }
})

document.getElementById('upload-input').addEventListener('change',(event) => {
  const file = event.target.files[0]
  graphName = file.name.substring(0,file.name.length - 5)
  file.text().then((text) => {
    setGraphFromJSON(JSON.parse(text))
  })
})

document.getElementById("search__input").addEventListener("blur",() => searchElement.style.display = "none")


// Loading and storing graph

setGraphFromJSON = (roamJSON) => {
  const loadSTime = performance.now()
  database = new DQ(graphName,manyAttributes)
  for (let page of roamJSON) {
    database.push(page)
  }
  gotoDailyNotes()
  console.log(`made DOM in ${performance.now() - loadSTime}`)
  setInterval(() => { },2000)
}

const loadDatabase = (graphName) => {
  const transaction = idb.transaction(["graphs"],"readonly")
  const store = transaction.objectStore("graphs")
  const req = store.get(graphName)
  console.log(`tried to get ${graphName}`)
  req.onerror = (event) => {
    console.log(event)
  }
  req.onsuccess = (event) => {
    const ctime = performance.now()
    const databaseData = event.target.result
    console.log(databaseData)
    database = new DQ(graphName,manyAttributes,databaseData.nextEntityId,databaseData.eav,databaseData.aev,databaseData.vae)
    console.log(database)
    console.log(performance.now() - ctime)
    gotoDailyNotes()
    console.log("loaded")
    setInterval(() => saveWorker.postMessage(database),2000)
  }
}

const IdbRequest = window.indexedDB.open("microroam",1)
IdbRequest.onerror = (event) => {
  console.log(event.target.errorCode)
  alert(`In order to save your notes between sessions, Micro Roam needs access to IndexedDB`)
}
IdbRequest.onsuccess = (event) => {
  idb = event.target.result
  console.log(event.target.result)
  loadDatabase(graphName)
}
IdbRequest.onupgradeneeded = (event) => {
  const db = event.target.result
  const store = db.createObjectStore("graphs",{ keyPath: "graphName" })
}

const saveWorker = new Worker('/worker.js')

saveWorker.onmessage = (event) => {
  console.log(`message from save worker! ${event}`)
}

// const t = performance.now()
// for (let i = 0; i < 1000000; i++) {

// }
// console.log(`took ${performance.now() - t}`)
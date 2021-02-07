// Constants

// Templates
const pageTemplate = document.getElementById("page").content.firstElementChild
const blockTemplate = document.getElementById("block").content.firstElementChild
const backrefsListTemplate = document.getElementById("backrefs-list").content.firstElementChild
const blockFocusFrameTemplate = document.getElementById("block-focus-frame").content.firstElementChild

// Singleton elements
const pageFrame = document.getElementById("page-frame")
const searchInput = document.getElementById("search-input")
const downloadButton = document.getElementById("download-button")


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
    databaseSetDatom(database,id,"string",string)
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
    save()
    event.preventDefault()
    return
  }
  if (event.key === "m" && event.ctrlKey) {
    if (document.body.className === "light") {
      user.theme = "dark"
      document.body.className = "dark"
      const transaction = idb.transaction(["user"],"readwrite")
      const store = transaction.objectStore("user")
      store.put(user)
    } else {
      user.theme = "light"
      document.body.className = "light"
      const transaction = idb.transaction(["user"],"readwrite")
      const store = transaction.objectStore("user")
      store.put(user)
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
    document.activeElement.id === "search-input"
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
  }
})

document.getElementById('upload-input').addEventListener('change',(event) => {
  const file = event.target.files[0]
  graphName = file.name.substring(0,file.name.length - 5)
  file.text().then((text) => {
    database = roamJsonToDatabase(graphName,JSON.parse(text))
    gotoDailyNotes()
    setInterval(save,10000)
  })
})

window.onblur = save

const saveWorker = new Worker('/worker.js')

saveWorker.onmessage = (event) => {
  console.log("worker message")
  console.log(event)
}

// const t = performance.now()
// for (let i = 0; i < 1000000; i++) {

// }
// console.log(`took ${performance.now() - t}`)
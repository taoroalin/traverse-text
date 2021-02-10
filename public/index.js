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
  oldestLoadedDailyNoteDate = null
  pageFrameOuter.removeEventListener("scroll",dailyNotesInfiniteScrollListener)
  pageFrame.textContent = ""
}

const gotoPageTitle = (title) => {
  const existingPage = store.pagesByTitle[title]
  if (existingPage) {
    gotoBlack()
    renderPage(pageFrame,existingPage)
  }
}

const gotoDailyNotes = () => {
  gotoBlack()
  pageFrameOuter.addEventListener("scroll",dailyNotesInfiniteScrollListener)
  oldestLoadedDailyNoteDate = new Date(Date.now())
  let numNotesLoaded = 0
  for (let i = 0; i < 366; i++) {
    const daysNotes = store.pagesByTitle[formatDate(oldestLoadedDailyNoteDate)]
    if (daysNotes) {
      renderPage(pageFrame,daysNotes)
      pageFrame.appendChild(pageBreakTemplate.cloneNode(true))
      numNotesLoaded += 1
      if (numNotesLoaded > 3) {
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

// Rendering
const renderPage = (parentNode,uid) => {
  const page = store.pages[uid]
  const element = pageTemplate.cloneNode(true)
  const title = element.firstElementChild
  const body = element.children[1]
  body.dataset.id = uid
  element.dataset.id = uid

  title.innerText = page.title

  const children = page.children
  if (children) {
    for (let child of children) {
      renderBlock(body,child)
    }
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
    console.log(parentNode)
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
  downloadButton.setAttribute('download',"output.json")
}

document.addEventListener("input",(event) => {
  const block = event.target.closest(".block__body")

  if (block) {
    // reparse block and insert cursor into correct position while typing
    const position = cursorPositionInBlock()
    let curIdx = 0

    const id = block.parentNode.dataset.id
    let string = block.innerText
    if (block.innerText.length === position)
      string += " "
    store.blocks[id].string = string // todo commit changes on word boundaries
    block.textContent = ""
    renderBlockBody(block,string,position)

    const scanElement = (element) => {
      for (let el of element.childNodes) {
        if (el.nodeName === "#text") {
          if (position < curIdx + el.textContent.length) {
            getSelection().collapse(el,position - curIdx)
            return el
          }
          curIdx += el.textContent.length
        } else {
          scanElement(el)
        }
      }
    }
    const currentElement = scanElement(block).parentNode


    // This doesn't work cause cursor placement doesn't work
    const closestPageRef = currentElement.closest(".page-ref")
    const closestTag = currentElement.closest(".tag")
    let titleString = (closestTag && closestTag.innerText.substring(1)) || (closestPageRef && closestPageRef.children[1].innerText)
    if (titleString) {
      console.log(`title string ${titleString}`)
      const matchingTitles = titleExactFullTextSearch(titleString)
      if (matchingTitles.length > 0) {
        autocompleteList.textContent = ""
        for (let i = 0; i < Math.min(matchingTitles.length,10); i++) {
          const suggestion = suggestionTemplate.cloneNode(true)
          suggestion.dataset.title = matchingTitles[i]
          suggestion.textContent = truncateElipsis(matchingTitles[i],50)
          autocompleteList.appendChild(suggestion)
        }
        autocompleteList.style.display = "block"
        autocompleteList.style.top = searchInput.getBoundingClientRect().bottom
        autocompleteList.style.left = searchInput.getBoundingClientRect().left
      } else {
        autocompleteList.style.display = "none"
      }
    }


  } else if (event.target.id === "search-input") {
    const stime = performance.now()
    const matchingTitles = exactFullTextSearch(event.target.value)
    console.log(`full text search took ${performance.now() - stime}`)
    if (matchingTitles.length > 0) {
      autocompleteList.textContent = ""
      for (let i = 0; i < Math.min(matchingTitles.length,10); i++) {
        const suggestion = suggestionTemplate.cloneNode(true)
        if (matchingTitles[i].title) {
          suggestion.dataset.title = matchingTitles[i].title
          suggestion.textContent = truncateElipsis(matchingTitles[i].title,50)
        } else {
          suggestion.dataset.string = matchingTitles[i].string
          suggestion.textContent = truncateElipsis(matchingTitles[i].string,50)
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
  console.log("focus block start")
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.insertBefore(temp,body.firstChild)
  window.getSelection().collapse(temp,0)
}

// more event listeners                    ------------------------------------------

document.addEventListener("keydown",(event) => {
  // Check for global shortcut keys
  if (event.key === "z" && event.ctrlKey && !event.shiftKey) {
    // databaseUndo(database) // todo make listeners then turn this on
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
    save()
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

  // Check for actions based on active element
  const closestBlock = document.activeElement.closest(".block")
  if (event.ctrlKey && event.key === "o") {
    return
  }
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
          createBlock(newBlockUid,store.blocks[bid].parent,idx)
          const newBlock = renderBlock(closestBlock.parentNode,newBlockUid,idx)
          newBlock.children[1].focus()
        }
        break
      case "Tab":
        if (event.shiftKey) {
          const parent = closestBlock.parentNode.parentNode
          if (parent) {
            const grandparent = parent.parentNode.parentNode
            const cousin = parent.nextSibling
            if (grandparent) {
              if (cousin) {
                grandparent.insertBefore(closestBlock,cousin)
              } else {
                grandparent.appendChild(closestBlock)
              }
              const grandparentBlock = store.blocks[grandparent.dataset.id]
              const grandparentPage = store.pages[grandparent.dataset.id]
              if (grandparentBlock) {
                grandparentBlock.children.push(closestBlock.dataset.id)
              } else if (grandparentPage) {
                grandparentPage.children.push(closestBlock.dataset.id)
              } else {
                console.log(grandparent)
                throw new Error(`wrong type of block grandparent`)
              }
              const parentBlock = store.blocks[parent.dataset.id]
              parentBlock.children = parentBlock.children.filter(x => x !== closestBlock.dataset.id)
            }
          }
        } else {
          const olderSibling = closestBlock.previousSibling
          if (olderSibling) {
            const Niece = olderSibling.children[2]
            Niece.appendChild(closestBlock)
            const nieceBlock = store.blocks[Niece.dataset.id] // bug here
            nieceBlock.children.push(closestBlock.dataset.id)
            const parentBlock = store.blocks[closestBlock.parentNode.dataset.id]
            const parentPage = store.pages[closestBlock.parentNode.dataset.id]
            if (parentBlock) {
              parentBlock.children = parentBlock.children.filter(x => x !== closestBlock.dataset.id)
            } else if (parentPage) {
              parentPage.children = parentPage.children.filter(x => x !== closestBlock.dataset.id)
            }
          }
        }
        event.preventDefault()
        break
      case "Backspace":
        if (cursorPositionInBlock() === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(closestBlock) - 1]
          focusBlockEnd(newActiveBlock)

          deleteBlock(bid)
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
  } else if (event.target.className === "autocomplete__suggestion") {
    if (event.target.dataset.title) {
      gotoPageTitle(event.target.dataset.title)
    } else {
      // // todo make suggestion return uid
      // const blockId = database.vae[event.target.dataset.string]["string"][0]
      // gotoBlock(blockId)
    }
  }
})

document.getElementById('upload-input').addEventListener('change',(event) => {
  const file = event.target.files[0]
  graphName = file.name.substring(0,file.name.length - 5)
  file.text().then((text) => {
    console.log(`got json text`)
    store = roamJsonToStore(graphName,text)
    gotoDailyNotes()
    setTimeout(() => saveWorker.postMessage(["save",store]),0)
  })
})

const saveWorker = new Worker('/worker.js')


if (w) {
  gotoDailyNotes()
  setTimeout(() => saveWorker.postMessage(["save",store]),0)
}
w = true
document.body.className = user.theme

// const t = performance.now()
// for (let i = 0; i < 1000000; i++) {
//   getSelection()
// }
// console.log(`took ${performance.now() - t}`)
// Event Listener Helpers -----------------------------------------------------------------------------------------------
const dailyNotesInfiniteScrollListener = () => {
  const fromBottom =
    pageFrame.getBoundingClientRect().bottom - innerHeight
  if (fromBottom < 700) {
    for (let i = 0; i < 100; i++) {
      sessionState.oldestDate.setDate(sessionState.oldestDate.getDate() - 1)
      const daysNotes = store.pagesByTitle[formatDate(sessionState.oldestDate)]
      if (daysNotes) {
        renderPage(pageFrame,daysNotes)
        pageFrame.appendChild(pageBreakTemplate.cloneNode(true))
        break
      }
    }
  }
}

const downloadHandler = () => {
  console.log("download")
  const json = storeToRoamJSON(store)
  const data = new Blob([json],{ type: 'text/json' })
  const url = URL.createObjectURL(data)
  downloadButton.setAttribute('href',url)
  downloadButton.setAttribute('download',`${store.graphName}-micro-roam.json`)
}


const autocomplete = () => {
  const origString = store.blocks[sessionState.focusId].string
  if (editingLink.className === "tag") {
    const textNode = editingLink.childNodes[0]
    // check for the exact inverse of regex test to see if this would be a valid tag, otherwise make it a ref
    if (/[^\/a-zA-Z0-9_-]/.test(focusSuggestion.dataset.title)) {
      const string = origString.slice(0,textNode.startIdx) + "[[" + focusSuggestion.dataset.title + "]]" + origString.slice(textNode.endIdx)
      sessionState.position = textNode.startIdx + focusSuggestion.dataset.title.length + 4
      setFocusedBlockString(string)
    } else {
      const string = origString.slice(0,textNode.startIdx) + "#" + focusSuggestion.dataset.title + origString.slice(textNode.endIdx)
      sessionState.position = textNode.startIdx + focusSuggestion.dataset.title.length + 1
      setFocusedBlockString(string)
    }
  } else {
    const textNode = editingLink.children[1].childNodes[0]
    const string = origString.slice(0,textNode.startIdx) + focusSuggestion.dataset.title + origString.slice(textNode.endIdx)
    sessionState.position = textNode.startIdx + focusSuggestion.dataset.title.length + 2
    setFocusedBlockString(string)
  }
  autocompleteList.style.display = "none"
}

const indentFocusedBlock = () => {
  const bid = sessionState.focusId
  const olderSibling = focusBlock.previousSibling
  if (olderSibling && olderSibling.dataset && olderSibling.dataset.id) {
    const newParentId = olderSibling.dataset.id
    const idx = blockOrPageFromId(newParentId).children.length
    runCommand("moveBlock",bid,newParentId,idx)
    olderSibling.children[2].appendChild(focusBlock)
    getSelection().collapse(focusNode,focusOffset)
  }
}

const dedentFocusedBlock = () => {
  const bid = sessionState.focusId
  const parent = focusBlock.parentNode.parentNode
  if (parent) {
    const grandparentChildren = parent.parentNode
    const grandparent = parent.parentNode.parentNode
    const grandparentId = grandparent.dataset.id
    const cousin = parent.nextSibling
    if (grandparentId) {
      if (cousin) {
        grandparentChildren.insertBefore(focusBlock,cousin)
      } else {
        grandparentChildren.appendChild(focusBlock)
      }
      const idx = blockOrPageFromId(grandparentId).children.indexOf(bid)
      runCommand("moveBlock",bid,grandparentId,idx + 1)
      getSelection().collapse(focusNode,focusOffset)
    }
  }
}

// Global event listeners that switch on active element, as a possibly more performant, simpler option than propagating through multiple event handlers

// Event listener functions that can't be written inline because multiple triggers / disconnect / reconnect

document.addEventListener("input",(event) => {
  updateCursorInfo()
  if (sessionState.isFocused) {

    if (focusBlockBody.innerText === " " || focusBlockBody.innerText === "") {
      runCommand("writeBlock",sessionState.focusId,"",[])
      return
    }

    // reparse block and insert cursor into correct position while typing

    let string = focusBlockBody.innerText
    store.blocks[sessionState.focusId].string = string // todo commit changes on word boundaries

    setFocusedBlockString(string)

    autocompleteList.style.display = "none"
    if (editingTitle) {
      const matchingTitles = titleExactFullTextSearch(editingTitle)
      if (matchingTitles.length > 0) {
        autocompleteList.innerHTML = ""
        autocompleteList.style.display = "block"
        const rect = editingLink.getBoundingClientRect()
        autocompleteList.style.top = rect.bottom
        autocompleteList.style.left = rect.left

        for (let i = 0; i < matchingTitles.length; i++) {
          matchingTitle = matchingTitles[i]
          const suggestion = suggestionTemplate.cloneNode(true)
          if (i === 0) suggestion.dataset.selected = "true"
          suggestion.dataset.id = matchingTitle.id

          if (matchingTitle.title) {
            suggestion.dataset.title = matchingTitle.title
            suggestion.innerText = truncateElipsis(matchingTitle.title,50)
          } else {
            suggestion.dataset.string = matchingTitle.string
            suggestion.innerText = truncateElipsis(matchingTitle.string,50)
          }
          autocompleteList.appendChild(suggestion)
        }
      }
    }


  } else if (event.target.id === "search-input") {
    const matchingTitles = exactFullTextSearch(event.target.value)
    if (matchingTitles.length > 0) {
      searchResultList.innerHTML = ""
      for (let i = 0; i < Math.min(matchingTitles.length,10); i++) {
        const result = searchResultTemplate.cloneNode(true)
        if (i === 0) {
          result.dataset.selected = "true"
        }
        if (matchingTitles[i].title) {
          result.dataset.title = matchingTitles[i].title
          result.innerText = truncateElipsis(matchingTitles[i].title,50)
        } else {
          result.dataset.string = matchingTitles[i].string
          result.dataset.id = matchingTitles[i].id
          result.innerText = truncateElipsis(matchingTitles[i].string,50)
        }
        searchResultList.appendChild(result)
      }
      searchResultList.style.display = "block"
      searchResultList.style.top = searchInput.getBoundingClientRect().bottom
      searchResultList.style.left = searchInput.getBoundingClientRect().left
    } else {
      searchResultList.style.display = "none"
    }

  } else if (event.target.className === "page__title") {
    console.log("edit title")
    const pageId = event.target.parentNode.dataset.id
    runCommand("writePageTitle",pageId,event.target.innerText)
  }
})

const focusBlockEnd = (blockNode) => {
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.appendChild(temp)
  getSelection().collapse(temp,0)
  temp.remove()
}

const focusBlockStart = (blockNode) => {
  const body = blockNode.children[1]
  const temp = document.createTextNode(" ")
  body.insertBefore(temp,body.firstChild)
  getSelection().collapse(temp,0)
  temp.remove()
}

const globalHotkeys = {
  "hide top bar": {
    key: "b",
    control: true,
    fn: () => {
      if (topBar.style.marginTop === "0px") user.topBar = "hidden"
      else user.topBar = "visible"
      saveUser()
    }
  },
  "escape": {
    key: "Escape",fn: () => {
      autocompleteList.style.display = "none"
    }
  },
  "upload": {
    key: "d",control: true,fn: () => {
      document.getElementById("upload-input").click()
    }
  },
  "download": { key: "s",control: true,shift: true,fn: downloadHandler },
  "save": { key: "s",control: true,fn: () => { saveWorker.postMessage(["save",store]) } },
  "toggle color theme": {
    key: "m",control: true,fn: () => {
      if (document.body.className === "light") {
        user.theme = "dark"
        saveUser()
      } else {
        user.theme = "light"
        saveUser()
      }
    }
  },
  "search": {
    key: "u",control: true,fn: () => {
      if (topBar.style.marginTop !== "0px") topBar.style.marginTop = "0px"
      searchInput.focus()
    }
  },
  "open": {
    key: "o",control: true,fn: () => {
      if (editingLink && editingLink.className === "page-ref")
        goto("pageTitle",editingLink.children[1].innerText)
      if (editingLink && editingLink.className === "tag")
        goto("pageTitle",editingLink.innerText.substring(1))
    }
  },
  "terminal": {
    key: "i",control: true,alt: true,fn: () => {
      if (terminalElement.style.display === "none") {
        terminalElement.style.display = "block"
        terminalElement.focus()
      } else {
        terminalElement.style.display = "none"
      }
    }
  }
}

document.addEventListener("keydown",(event) => {
  updateCursorInfo()

  for (let hotkeyName in globalHotkeys) {
    const hotkey = globalHotkeys[hotkeyName]
    if (event.key === hotkey.key &&
      event.shiftKey === !!hotkey.shift &&
      event.ctrlKey === !!hotkey.control &&
      event.altKey === !!hotkey.alt) {
      hotkey.fn()
      event.preventDefault()
      return
    }
  }

  if (autocompleteList.style.display !== "none") {
    if (event.key === "Tab") {
      autocomplete()
      event.preventDefault()
    }
    const newSelected = (event.key === "ArrowUp" && focusSuggestion.previousSibling) || (event.key === "ArrowDown" && focusSuggestion.nextSibling)
    if (newSelected) {
      newSelected.dataset.selected = "true"
      delete focusSuggestion.dataset.selected
      event.preventDefault()
    }
  } else if (sessionState.isFocused) {
    let blocks
    let newActiveBlock
    switch (event.key) {
      case "Enter":
        if (!event.shiftKey) {
          const parent = blockOrPageFromId(store.blocks[sessionState.focusId].parent)
          let idx = parent.children.indexOf(sessionState.focusId)
          if (!event.ctrlKey) {
            idx += 1
          }
          console.log(idx)
          const newBlockUid = runCommand("createBlock",store.blocks[sessionState.focusId].parent,idx)
          const newBlockElement = renderBlock(focusBlock.parentNode,newBlockUid,idx)
          newBlockElement.children[1].focus()
          event.preventDefault()
        }
        break
      case "Tab":
        if (event.shiftKey)
          dedentFocusedBlock()
        else
          indentFocusedBlock()
        event.preventDefault()
        break
      case "Backspace":
        if (sessionState.position === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) - 1]
          focusBlock.remove()
          focusBlockEnd(newActiveBlock)
          runCommand("deleteBlock",sessionState.focusId)
          event.preventDefault()
        }
        break
      case "ArrowDown":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blocks[sessionState.focusId].parent
          const parentElement = focusBlock.parentNode
          const currentIdx = blockOrPageFromId(parentId).children.indexOf(sessionState.focusId)
          if (focusBlock.nextSibling) {
            runCommand("moveBlock",sessionState.focusId,parentId,currentIdx + 1)
            if (focusBlock.nextSibling.nextSibling) {
              parentElement.insertBefore(focusBlock,focusBlock.nextSibling.nextSibling)
            } else parentElement.appendChild(focusBlock)
            getSelection().collapse(focusNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) + 1]
          focusBlockStart(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowUp":
        if (event.altKey && event.shiftKey) {
          const parentId = store.blocks[sessionState.focusId].parent
          const parentElement = focusBlock.parentNode
          const currentIdx = blockOrPageFromId(parentId).children.indexOf(sessionState.focusId)
          if (focusBlock.previousSibling) {
            runCommand("moveBlock",sessionState.focusId,parentId,currentIdx - 1)
            parentElement.insertBefore(focusBlock,focusBlock.previousSibling)
            getSelection().collapse(focusNode,focusOffset)
            event.preventDefault()
          }
        } else if (!event.shiftKey && !event.altKey) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) - 1]
          focusBlockEnd(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowLeft":
        if (event.shiftKey && event.altKey) {
          dedentFocusedBlock()
        } else if (sessionState.position === 0) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) - 1]
          focusBlockEnd(newActiveBlock)
          event.preventDefault()
        }
        break
      case "ArrowRight":
        if (event.shiftKey && event.altKey) {
          indentFocusedBlock()
        } else if (sessionState.position === focusBlockBody.innerText.length) {
          blocks = Array.from(document.querySelectorAll(".block"))
          newActiveBlock = blocks[blocks.indexOf(focusBlock) + 1]
          if (newActiveBlock) focusBlockStart(newActiveBlock)
          event.preventDefault()
        }
        break
    }
  }

  if (
    document.activeElement &&
    document.activeElement.id === "search-input"
  ) {
    if (event.key === "Enter") {
      goto("pageTitle",event.target.value)
      event.preventDefault()
      return
    } else if (event.key === "Tab") {
      const selected = searchResultList.querySelector(`.search-result[data-selected="true"]`)
      if (selected) {
        if (selected.dataset.title) {
          goto("pageTitle",selected.dataset.title)
        } else {
          goto("block",selected.dataset.id)
        }
        return
      }
    }
  }

  if (terminalElement.style.display !== "none") {
    if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      const tc = terminalCommands[event.target.innerText]
      if (tc) tc()
      else eval(event.target.innerText)
      if (!event.ctrlKey) {
        terminalElement.style.display = "none"
        terminalElement.innerHTML = ""
      }
    }
  }

})

document.addEventListener("click",(event) => {

  const closestBullet = event.target.closest(".block__bullet")

  if (event.target.className === "search-result") {
    if (event.target.dataset.title) {
      goto("pageTitle",event.target.dataset.title)
    } else {
      goto("block",event.target.dataset.id)
    }
    return
  } else if (event.target.id !== "search-input") {
    searchResultList.style.display = "none"
  }

  const closestBreadcrumbPage = event.target.closest(".breadcrumb-page")
  const closestBreadcrumbBlock = event.target.closest(".breadcrumb-block")
  if (event.target.className === "page-ref__body") {
    goto("pageTitle",event.target.innerText)
  } else if (closestBullet) {
    goto("block",closestBullet.parentNode.dataset.id)
  } else if (event.target.className === "block-ref") {
    goto("block",event.target.dataset.id)
  } else if (event.target.closest(".tag")) {
    goto("pageTitle",event.target.closest(".tag").innerText.substring(1))
  } else if (event.target.id === "download-button") {
    downloadHandler()
  } else if (event.target.id === "upload-button") {
    document.getElementById("upload-input").click()
  } else if (event.target.id === "daily-notes-button") {
    goto("dailyNotes")
  } else if (event.target.className === "autocomplete__suggestion") {
    if (focusSuggestion) focusSuggestion.dataset.selected = false
    event.target.dataset.selected = true
    autocomplete()
  } else if (event.target.className === "url") { // using spans with event handlers as links because they play nice with contenteditable
    const link = document.createElement("a")
    link.target = "_blank"
    link.href = event.target.innerText
    link.click()
  } else if (event.target.id === "help-button") {
    goto("pageTitle","Welcome to Micro Roam")
  } else if (closestBreadcrumbPage) {
    goto("pageTitle",closestBreadcrumbPage.dataset.title)
  } else if (closestBreadcrumbBlock) {
    goto("block",closestBreadcrumbBlock.dataset.id)
  }

  // this is at the bottom so that autocomplete suggestion click handler still knows where the link is. 
  // todo have better tracking of active block
  updateCursorInfo()
})

topBarHiddenHitbox.addEventListener("mouseover",() => {
  user.topBar = "visible"
  saveUser()
})

document.getElementById('upload-input').addEventListener('change',(event) => {
  const file = event.target.files[0]
  console.log(file)
  const [name,extension] = file.name.split(".")
  console.log(`name ${name} extension ${extension}`)
  if (extension === "zip") {
    file.arrayBuffer().then((buffer) => {
      const files = zipToFiles(buffer)
      console.log(files)
      if (files.length === 1 && files[0].ext === "json") {
        store = roamJsonToStore(files[0].name,files[0].text)
        fetch("./default-store.json").then(text => text.json().then(json => {
          mergeStore(json)
          theresANewStore()
        }))
      } else {
        const mds = []
        for (let file of files) {
          if (file.ext === "md") {
            mds.push(file)
          } else {
            console.log(`That zip file contained ${file.fullName}, but Micro Roam expected a .json file or multiple .md files`)
          }
        }
        console.log("parsing markdown")
        mdToStore(mds)
      }
    })
  } else if (extension === "json") {
    file.text().then((text) => {
      store = roamJsonToStore(name,text)
      fetch("./default-store.json").then(text => text.json().then(json => {
        mergeStore(json)
        theresANewStore()
      }))
    })
  } else {
    alert("Micro Roam only accepts a .json file, a .zip file containing 1 .json file, or a .zip file containing .md files")
  }
})

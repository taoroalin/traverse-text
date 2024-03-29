let focusIdPosition, selectIdWholeNode
{
  const prepFocusIdForCursor = () => {
    if (focusBlock &&
      focusBlock.isConnected &&
      focusBlock.dataset.id !== sessionState.focusId) {

      focusBlockBody.textContent = ""
      render.blockBody(store, focusBlockBody, store.blox[focusBlock.dataset.id].s)
    }

    focusBlock = document.querySelector(`.block[data-id="${sessionState.focusId}"]`)
    focusBlockBody = focusBlock.children[1]

    if (focusBlock === undefined) {
      throw new Error(`tried to focus block that doesn't exist: ${sessionState.focusId}`)
    }

    sessionState.isFocused = true

    const text = store.blox[sessionState.focusId].s
    focusBlockBody.innerText = ""
    render.blockBody(store, focusBlockBody, text, true)
  }

  focusIdPosition = () => {
    prepFocusIdForCursor()
    let lastTextNode
    const scanElement = (element) => {
      for (let el of element.childNodes) {
        if (el.nodeName === "#text") {
          lastTextNode = el
          if (sessionState.position >= (el.startIdx || 0) && sessionState.position <= (el.startIdx || 0) + el.textContent.length) {
            scanResult = el
            const placeToGo = sessionState.position - el.startIdx
            // console.log(`startIdx ${el.startIdx} togo ${placeToGo}`)
            getSelection().collapse(el, placeToGo)
            return el
          }
        } else {
          const z = scanElement(el)
          if (z) return z
        }
      }
    }
    if (!scanElement(focusBlockBody)) getSelection().collapse(lastTextNode, lastTextNode.textContent.length)
    updateCursorSpanInfo()
  }

  selectIdWholeNode = (node) => {
    prepFocusIdForCursor()

    //todo ......

    updateCursorSpanInfo()
  }
}

const setFocusedBlockString = (string, diff) => {
  let theString = string
  if (theString === undefined) {
    theString = store.blox[sessionState.focusId].s
  }

  if (diff !== undefined) {
    doEdit('df', sessionState.focusId, diff)
    commit()
  } else {
    macros.write(sessionState.focusId, theString)
  }

  focusIdPosition()
}



const updateCursorPosition = () => {
  focusNode = getSelection().focusNode
  focusOffset = getSelection().focusOffset
  const block = focusNode.parentNode.closest(".block")
  sessionState.focusId = block.dataset.id
  sessionState.position = (focusNode.startIdx || 0) + focusOffset
}

let updateCursorSpanInfo
{
  const getEditingSimpleSpan = (className) => {
    const elements = focusBlockBody.querySelectorAll("." + className)
    for (let temp of elements) {
      if (temp.childNodes[0].endIdx >= sessionState.position && temp.childNodes[0].startIdx < sessionState.position) {
        return temp
      }
    }
  }
  updateCursorSpanInfo = () => {
    editingLink = undefined
    const pageRefs = focusBlockBody.querySelectorAll(".page-ref")
    for (let ref of pageRefs) {
      if (ref.endIdx >= sessionState.position && ref.startIdx < sessionState.position) {
        editingLink = ref
      }
    }
    const tags = focusBlockBody.querySelectorAll(".tag")
    for (let tag of tags) {
      if (tag.endIdx >= sessionState.position && tag.startIdx <= sessionState.position) {
        editingLink = tag
      }
    }
    editingTemplateExpander = getEditingSimpleSpan("template-expander")

    editingUrlElement = getEditingSimpleSpan("url")

    editingCommandElement = getEditingSimpleSpan("command")
    if (editingCommandElement === undefined)
      idElements.commandList.style.display = "none"
    if (editingTemplateExpander === undefined)
      idElements.templateList.style.display = "none"
    if (editingLink === undefined)
      idElements.searchResultList.style.display = "none"
  }
}


const focusBlockEnd = (blockNode) => {
  sessionState.focusId = blockNode.dataset.id
  sessionState.position = store.blox[sessionState.focusId].s.length
  focusIdPosition()
}

const focusBlockStart = (blockNode) => {
  sessionState.focusId = blockNode.dataset.id
  sessionState.position = 0
  focusIdPosition()
}

const focusBlockVerticalOffset = (offset, block = focusBlock, start = false) => { // this closure feels weird, maybe shoudn't use this language feature?
  const blocks = Array.from(document.querySelectorAll(".block"))
  let newIndex = blocks.indexOf(block) + offset
  newIndex = Math.max(0, Math.min(blocks.length - 1, newIndex))
  const newActiveBlock = blocks[newIndex]
  if (newActiveBlock) {
    if (newIndex === 0)
      idElements.pageFrameOuter.scrollTop = 0
    else
      newActiveBlock.scrollIntoView({ block: 'nearest', inline: 'nearest' })

    if (!start) {
      focusBlockEnd(newActiveBlock)
    } else {
      focusBlockStart(newActiveBlock)
    }
  }
}

const getChildren = (node) => {
  return node.className === "block" ? node.children[3].children : node.children[1].children
}


const getClosestPageLink = (node) => {
  return node.closest(".tag") || node.closest(".attribute") || node.closest(".page-ref")
}

const getPageTitleOfNode = (node) => {
  const linkNode = getClosestPageLink(node)
  return linkNode && linkNode.dataset.title
}

const followUrlElement = (element) => {
  const link = document.createElement("a")
  link.target = "_blank"
  link.href = element.innerText
  link.click()
}

const isLinkLike = (node) => {
  return {
    attribute: 1,
    tag: 1,
    "page-ref": 1,
    url: 1
  }[node.className]
}

const followLinkLike = (node) => {
  switch (node.className) {
    case "url":
      followUrlElement(node)
      break
    case "block-ref":
      goto("block", node.dataset.id)
      break
    default:
      goto('pageTitle', node.title, node.graphName)
      break
  }
}

const getBlocFromElement = (element) => {
  return otherStores[element.dataset.graphName].blox[element.dataset.id]
}
const renderPage = (parentNode,uid) => {
  const page = store.pages[uid]
  const element = pageTemplate.cloneNode(true)
  const title = element.firstElementChild
  const body = element.children[1]
  body.dataset.id = uid
  element.dataset.id = uid

  title.innerText = page.title

  let children = page.children
  if (!children || children.length === 0) { // todo set standards for when lists can be empty to reduce ambiguity
    runCommand("createBlock",uid,0)
    children = page.children
  }
  for (let child of children) {
    renderBlock(body,child)
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
    parentNode.insertBefore(element,parentNode.children[idx])
  } else {
    parentNode.appendChild(element)
  }
  return element
}


const renderBlockBody = (parent,text) => {
  let stack = [parent]
  // 1             2              3   4         5    6         7      8
  // page-ref-open page-ref-close tag block-ref bold highlight italic link
  const matches = text.matchAll(/(\[\[)|(\]\])|(#[\/a-zA-Z0-9_-]+)|(\(\([a-zA-Z0-9\-_]{8,10}\)\))|(\*\*)|(\^\^)|(__)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))/g)
  let idx = 0
  let stackTop = parent

  const newTextNode = (string) => {
    const result = document.createTextNode(string)
    result.startIdx = idx
    result.endIdx = idx + string.length
    return result
  }

  const refTitles = []

  for (let match of matches) {

    stackTop.appendChild(newTextNode(text.substring(idx,match.index)))
    idx = match.index

    if (match[1]) {
      const pageRefElement = pageRefTemplate.cloneNode(true)
      stackTop.appendChild(pageRefElement)
      pageRefElement.children[0].appendChild(newTextNode("[["))
      stack.push(pageRefElement.children[1])
      stackTop = stack[stack.length - 1]
    } else if (match[2]) {
      if (stackTop.className === "page-ref__body") {
        stackTop.parentNode.children[2].appendChild(newTextNode("]]"))
        refTitles.push(stackTop.innerText)
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        stackTop.appendChild(newTextNode("]]"))
      }
    } else if (match[3]) {
      refTitles.push(match[3].substring(1))
      const tagElement = tagTemplate.cloneNode(true)
      tagElement.appendChild(newTextNode(match[3]))
      stackTop.appendChild(tagElement)
    } else if (match[4]) {
      // @query would use a query here if I had them
      const blockId = match[4].substring(2,match[4].length - 2)
      const block = store.blocks[blockId]
      if (block) {
        const blockRefElement = blockRefTemplate.cloneNode(true)
        blockRefElement.innerText = block.string
        blockRefElement.dataset.id = blockId
        stackTop.appendChild(blockRefElement)
      } else {
        stackTop.appendChild(newTextNode(match[0]))
      }
    } else if (match[5]) {
      if (stackTop.className === "bold") {
        stackTop.appendChild(newTextNode("**"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = boldTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        boldElement.appendChild(newTextNode("**"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[6]) {
      if (stackTop.className === "highlight") {
        stackTop.appendChild(newTextNode("^^"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = highlightTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        boldElement.appendChild(newTextNode("^^"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[7]) {
      if (stackTop.className === "italic") {
        stackTop.appendChild(newTextNode("__"))
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = italicTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        boldElement.appendChild(newTextNode("__"))
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[8]) {
      const urlElement = urlTemplate.cloneNode(true)
      urlElement.appendChild(newTextNode(match[8]))
      urlElement.href = match[8]
      stackTop.appendChild(urlElement)
    }
    idx = match.index + match[0].length
  }

  stack[stack.length - 1].appendChild(newTextNode(text.substring(idx)))

  /**
   * PARSING REVELATION!!!!
   * Instead of backtracking and deleting when a block doesn't close, I can just erase the className of the block. Then it's still part of the tree but looks like it's gone! much less performance cost than backtracking!!
   */
  while (stackTop.className !== "block__body") {
    if (stackTop.className === "page-ref")
      stackTop.children[0].className = ""
    stackTop.className = ""
    stackTop = stackTop.parentNode
  }
  return refTitles
}

const renderBlockBodyWithCursor = (blockBody,string,position) => {
  if (position >= string.length) string += " "
  blockBody.innerHTML = ""

  // remove block body from dom while editing, ugly hack to avoid recalcuate style during dom generation
  const blockElement = blockBody.parentNode
  const blockBodyNextSibling = blockBody.nextSibling
  blockBody.remove()

  const refTitles = renderBlockBody(blockBody,string)

  blockElement.insertBefore(blockBody,blockBodyNextSibling)

  const scanElement = (element) => {
    for (let el of element.childNodes) {
      if (el.nodeName === "#text") {
        if (el.textContent && position >= el.startIdx && position < el.startIdx + el.textContent.length) {
          scanResult = el
          try {
            getSelection().collapse(el,position - el.startIdx) // this does the thing correctly, but then throws an error, which I catch? todo investigate
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
  scanElement(blockBody)
  return refTitles
}
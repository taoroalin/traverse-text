const renderPage = (parentNode,uid) => {
  const page = store.pages[uid]
  const element = pageTemplate.cloneNode(true)
  const title = element.firstElementChild
  const body = element.children[1]
  body.dataset.id = uid
  element.dataset.id = uid

  if (page.title === undefined) {
    throw new Error(`error with page id ${uid}`)
  }
  title.innerText = page.title

  let children = page.children
  if (!children || children.length === 0) { // todo set standards for when lists can be empty to reduce ambiguity
    runCommand("createBlock",uid,0)
    children = page.children
  }
  for (let child of children) {
    renderBlock(body,child)
  }

  if (page.backRefs && page.backRefs.length > 0) {
    const backrefsListElement = backrefListTemplate.cloneNode(true)
    element.children[2].appendChild(backrefsListElement)
    page.backRefs.sort((a,b) => store.blocks[b]["edit-time"] - store.blocks[a]["edit-time"])
    for (let backref of page.backRefs) {
      const backrefFrame = backrefFrameTemplate.cloneNode(true)
      renderBreadcrumb(backrefFrame.children[0],backref)
      renderBlock(backrefFrame.children[1],backref)
      backrefsListElement.children[1].appendChild(backrefFrame)
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

  if (idx !== undefined && parentNode.children.length >= idx) {
    parentNode.insertBefore(element,parentNode.children[idx])
  } else {
    parentNode.appendChild(element)
  }
  return element
}


const renderBlockBody = (parent,text,disableSpace = false) => {
  if (!disableSpace) {
    if (text[text.length - 1] !== " ") text += " " // add space because of getSelection.collapse() weirdness with end of contenteditable
  }
  const stack = [parent]
  // 1             2              3   4         5    6         7      8    9       10                11
  // page-ref-open page-ref-close tag block-ref bold highlight italic link literal template-expander attribute
  const matches = text.matchAll(/(\[\[)|(\]\])|(#[\/a-zA-Z0-9_-]+)|(\(\([a-zA-Z0-9\-_]{8,50}\)\))|(\*\*)|(\^\^)|(__)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))|`([^`]+)`|(;;(?:[^ \n\r]*))|(^[\/a-zA-Z0-9_-]+)::/g)
  // Roam allows like whatevs in the tags and attributes. I only allow a few select chars.

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
        const el = document.createElement("span")
        el.className = "page-ref-close-missing-open"
        el.appendChild(newTextNode("]]"))
        stackTop.appendChild(el)
      }
    } else if (match[3]) {
      refTitles.push(match[3].substring(1))
      const tagElement = tagTemplate.cloneNode(true)
      tagElement.appendChild(newTextNode(match[3]))
      stackTop.appendChild(tagElement)
    } else if (match[4]) {
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
    } else if (match[9]) {
      const literalElement = literalTemplate.cloneNode(true)
      literalElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(literalElement)
    } else if (match[10]) {
      const templateExpanderElement = templateExpanderTemplate.cloneNode(true)
      templateExpanderElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(templateExpanderElement)
    } else if (match[11]) {
      const attributeElement = attributeTemplate.cloneNode(true)
      attributeElement.appendChild(newTextNode(match[0]))
      stackTop.appendChild(attributeElement)
    }
    idx = match.index + match[0].length
  }

  stack[stack.length - 1].appendChild(newTextNode(text.substring(idx)))

  /**
   * PARSING REVELATION!!!!
   * Instead of backtracking and deleting when a block doesn't close, I can just erase the className of the block. Then it's still part of the tree but looks like it's gone! much less performance cost than backtracking!!
   */
  while (stackTop !== parent) {
    if (stackTop.className === "page-ref")
      stackTop.children[0].className = stackTop.children[0].className + "-incomplete"
    stackTop.className = stackTop.className + "-incomplete"
    stackTop = stackTop.parentNode
  }
  return refTitles
}

const renderBreadcrumb = (parent,blockId) => {
  const list = []
  while (true) {
    blockId = store.blocks[blockId].parent
    if (store.blocks[blockId] !== undefined) {
      list.push({ string: store.blocks[blockId].string,id: blockId })
    } else {
      list.push({ title: store.pages[blockId].title,id: blockId })
      break
    }
  }
  const node = breadcrumbPageTemplate.cloneNode(true)
  const title = list[list.length - 1].title
  renderBlockBody(node,title)
  node.dataset.title = title
  parent.appendChild(node)
  for (let i = list.length - 2; i >= 0; i--) {
    const node = breadcrumbBlockTemplate.cloneNode(true)
    const nodeBody = node.children[1]
    renderBlockBody(nodeBody,list[i].string,true)
    node.dataset.id = list[i].id
    parent.appendChild(node)
  }
}

const notifyText = (text,duration) => {
  const el = notificationTemplate.cloneNode(true)
  el.innerText = text
  document.getElementById("app").appendChild(el)
  setTimeout(() => el.style.top = "60px",50)
  const dur = (duration && duration * 1000) || 5000
  setTimeout(() => el.style.opacity = "0",dur)
  setTimeout(() => {
    el.remove()
  },dur + 300)
}
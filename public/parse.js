const pageRefTemplate = document.getElementById("page-ref").content.firstElementChild
const tagTemplate = document.getElementById("tag").content.firstElementChild
const urlTemplate = document.getElementById("url").content.firstElementChild
const blockRefTemplate = document.getElementById("block-ref").content.firstElementChild
const boldTemplate = document.getElementById("bold").content.firstElementChild
const italicTemplate = document.getElementById("italic").content.firstElementChild
const highlightTemplate = document.getElementById("highlight").content.firstElementChild

const renderBlockBody = (parent,text) => {
  let stack = [parent]
  // page-ref-open page-ref-close tag block-ref bold link highlight italic
  const matches = text.matchAll(/(\[\[)|(\]\])|(#[\/a-zA-Z0-9_-]+)|(\(\([a-zA-Z0-9\-_]+\)\))|(\*\*)|(\^\^)|(__)|((?:https?\:\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6})\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*))/g)
  let idx = 0
  let stackTop = parent
  for (let match of matches) {
    if (match.index > idx) {
      const textNode = document.createTextNode(
        text.substring(idx,match.index)
      )
      textNode.startIdx = idx
      stackTop.appendChild(textNode)
      idx = match.index
    }
    if (match[1]) {
      const pageRefElement = pageRefTemplate.cloneNode(true)
      stackTop.appendChild(pageRefElement)
      const textNode = document.createTextNode("[[")
      textNode.startIdx = idx
      pageRefElement.children[0].appendChild(textNode)
      stack.push(pageRefElement.children[1])
      stackTop = stack[stack.length - 1]
    } else if (match[2]) {
      if (stackTop.className === "page-ref__body") {
        const textNode = document.createTextNode("]]")
        textNode.startIdx = idx
        stackTop.parentNode.children[2].appendChild(textNode)
        stack.pop()
        stackTop = stack[stack.length - 1]
      }
    } else if (match[3]) {
      const tagElement = tagTemplate.cloneNode(true)
      tagElement.innerText = match[3]
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
        const textNode = document.createTextNode(match[0])
        textNode["data-index"] = idx
        stackTop.appendChild(textNode)
      }
    } else if (match[5]) {
      if (stackTop.className === "bold") {
        const textNode = document.createTextNode("**")
        textNode.startIdx = idx
        stackTop.appendChild(textNode)
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = boldTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        const textNode = document.createTextNode("**")
        textNode.startIdx = idx
        boldElement.appendChild(textNode)
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[6]) {
      if (stackTop.className === "highlight") {
        const textNode = document.createTextNode("^^")
        textNode.startIdx = idx
        stackTop.appendChild(textNode)
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = highlightTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        const textNode = document.createTextNode("^^")
        textNode.startIdx = idx
        boldElement.appendChild(textNode)
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[7]) {
      if (stackTop.className === "italic") {
        const textNode = document.createTextNode("__")
        textNode.startIdx = idx
        stackTop.appendChild(textNode)
        stack.pop()
        stackTop = stack[stack.length - 1]
      } else {
        const boldElement = italicTemplate.cloneNode(true)
        stackTop.appendChild(boldElement)
        const textNode = document.createTextNode("__")
        textNode.startIdx = idx
        boldElement.appendChild(textNode)
        stack.push(boldElement)
        stackTop = boldElement
      }
    } else if (match[8]) {
      const urlElement = urlTemplate.cloneNode(true)
      const textNode = document.createTextNode(match[8])
      textNode.startIdx = idx
      urlElement.appendChild(textNode)
      urlElement.href = match[8]
      stackTop.appendChild(urlElement)
    }
    idx = match.index + match[0].length
  }
  if (idx < text.length) {
    const textNode = document.createTextNode(text.substring(idx))
    textNode.startIdx = idx
    stack[stack.length - 1].appendChild(textNode)
  }
  /**
   * PARSING REVELATION!!!!
   * Instead of backtracking and deleting when a block doesn't close, I can just erase the className of the block. Then it's still part of the tree but looks like it's gone! No performance cost!!
   */
  while (stackTop.className !== "block__body") {
    if (stackTop.className === "page-ref")
      stackTop.children[0].className = ""
    stackTop.className = ""
    stackTop = stackTop.parentNode
  }
}
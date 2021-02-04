const textTemplate = document.getElementById("block-text").content
  .firstElementChild;
const pageRefTemplate = document.getElementById("page-ref").content
  .firstElementChild;
const tagTemplate = document.getElementById("tag").content.firstElementChild;

const renderBlockBody = (parent, text) => {
  let stack = [parent];
  const doubleSquareBrackets = text.matchAll(/(\[\[)|(\]\])/g);
  let idx = 0;
  for (let match of doubleSquareBrackets) {
    if (match.index > idx) {
      const textNode = document.createTextNode(
        text.substring(idx, match.index)
      );
      stack[stack.length - 1].appendChild(textNode);
    }
    if (match[0][0] === "[") {
      const linkNode = pageRefTemplate.cloneNode(true);
      stack[stack.length - 1].appendChild(linkNode);
      stack.push(linkNode.children[1]);
    } else {
      if (stack.length > 1) {
        stack.pop();
      }
    }
    idx = match.index + match[0].length;
  }
  if (idx < text.length) {
    const textNode = document.createTextNode(text.substring(idx));
    stack[stack.length - 1].appendChild(textNode);
  }
};

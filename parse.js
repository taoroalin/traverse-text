const textTemplate = document.getElementById("block-text").content
  .firstElementChild;
const pageRefTemplate = document.getElementById("page-ref").content
  .firstElementChild;
const tagTemplate = document.getElementById("tag").content.firstElementChild;

const renderBlockBody = (parent, text) => {
  let stack = [parent];
  const doubleSquareBrackets = text.matchAll(/(\[\[)|(\]\])|(#[\/a-zA-Z0-9_-]+)|(https:\/\/twitter.com\/[a-zA-Z0-9_]{4,15}\/status\/[0-9]+)/g);
  let idx = 0;
  for (let match of doubleSquareBrackets) {
    if (match.index > idx) {
      const textNode = document.createTextNode(
        text.substring(idx, match.index)
      );
      stack[stack.length - 1].appendChild(textNode);
    }
    if (match[1]) {
      const pageRefElement = pageRefTemplate.cloneNode(true);
      stack[stack.length - 1].appendChild(pageRefElement);
      stack.push(pageRefElement.children[1]);
    } else if (match[2]) {
      if (stack.length > 1) {
        stack.pop();
      }
    } else if (match[3]) {
      const tagElement = tagTemplate.cloneNode(true);
      tagElement.innerText = match[3];
      stack[stack.length - 1].appendChild(tagElement);
    } else if (match[4]) {
      embedTweet(stack[stack.length - 1], match[3]);
    }
    idx = match.index + match[0].length;
  }
  if (idx < text.length) {
    const textNode = document.createTextNode(text.substring(idx));
    stack[stack.length - 1].appendChild(textNode);
  }
};

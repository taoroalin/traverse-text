const embedTweet = (parentNode, tweetUrl) => {
  const tweetId = tweetUrl.match(/[0-9]+$/)[0];
  const width = 550;
  const from = "example.com"
  const embedVersion = "ed20a2b%3A1601588405575";

  const theme = document.body.className === "light-mode" ? "light" : "dark";
  const iframeUrl = `https://platform.twitter.com/embed/index.html?dnt=false&embedId=twitter-widget-0&frame=false&hideCard=false&hideThread=true&id=${tweetId}&lang=en&origin=https%3A%2F%2F${from}&theme=${theme}&widgetsVersion=${embedVersion}&width=${width}px`

  const iframeHTML = `<iframe scrolling="no" frameborder="0" allowtransparency="true" allowfullscreen="true" style="position: static; visibility: visible; width: 374px; height: 196px; display: block; flex-grow: 1;" src="${iframeUrl}"></iframe>`
  const node = document.createElement('div');
  parentNode.appendChild(node);
  node.outerHTML = iframeHTML;
}

const { myFetch, getLinks } = require('./util')
const { parseHTML } = require('./parse-html')

const parseDanLuuBlogPost = (text) => {
  const parsed = parseHTML(text)

}

{
  (async () => {
    const string = await myFetch('http://danluu.com')
    console.log(typeof string)
    const links = getLinks(string)
    console.log(JSON.stringify(links))
    const pagePromises = []
    for (let link of links) {
      pagePromises.push(myFetch(link))
    }
    const posts = await Promise.all(pagePromises)
    const blox = {}
    for (let post of posts) {
      const parsed = parseHTML(post)
      console.log(parsed)
    }
  })()
}
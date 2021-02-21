const fs = require("fs")
console.log("building")

const regexScriptImport = /<script src="([a-zA-Z\-_0-9.]+.js)"><\/script>[\n\r+\t]*/g
const regexStyleInclude = /<link rel="stylesheet" href="([a-zA-Z0-9\.]+)">/g

const fname = "./public/dev.html"

const html = fs.readFileSync(fname,"utf8")

const scriptReplacer = (match,fname) => {
  const js = fs.readFileSync("./public/" + fname,"utf8")
  return `\n<script>\n${js}\n</script>\n`
}

const styleReplacer = (match,fname) => {
  const css = fs.readFileSync("./public/" + fname,"utf8")
  return `\n<style>\n${css}\n</style>\n`
}

const result = html.replace(regexScriptImport,scriptReplacer).replace(regexStyleInclude,styleReplacer).replace(/<\/script>\s*<script>/g,"")

// console.log(result)

fs.writeFileSync("./public/index.html",result)
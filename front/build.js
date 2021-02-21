// const { performance } = require('perf_hooks')
// const stime = performance.now()
const fs = require("fs")
var UglifyJS = require("uglify-js")
console.log("building")

const fname = "./src/index.html"

const regexScriptImport = /<script src="([a-zA-Z\-_0-9.]+.js)"><\/script>[\n\r+\t]*/g
const scriptReplacer = (match,fname) => {
  const js = fs.readFileSync("./src/" + fname,"utf8")
  const min = UglifyJS.minify(js).code
  return `\n<script>\n${min}\n</script>\n`
}

const regexStyleImport = /<link rel="stylesheet" href="([a-zA-Z0-9\.]+)">/g
const styleReplacer = (match,fname) => {
  const css = fs.readFileSync("./src/" + fname,"utf8")
  return `\n<style>\n${css}\n</style>\n`
}

const html = fs.readFileSync(fname,"utf8")
const result = html.replace(regexScriptImport,scriptReplacer).replace(regexStyleImport,styleReplacer).replace(/<\/script>\s*<script>/g,"")

// console.log(result)

fs.writeFileSync("./public/index.html",result)
// console.log(`took ${performance.now() - stime}`) // took 2.5s, 8ms of which is not UglifyJS

fs.copyFile("./src/favicon.ico","./public/favicon.ico",() => { })
fs.copyFile("./src/worker.js","./public/worker.js",() => { })
fs.copyFile("./src/main-worker-shared.js","./public/main-worker-shared.js",() => { })

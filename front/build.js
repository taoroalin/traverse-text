// const { performance } = require('perf_hooks')
// const stime = performance.now()
const fs = require("fs")
var UglifyJS = require("uglify-js")
console.log("building")

const fname = "./src/index.html"

const regexScriptImport = /<script src="([^":]+)"><\/script>/g
const scriptReplacer = (match,fname) => {
  const js = fs.readFileSync("./src/" + fname,"utf8")
  const min = UglifyJS.minify(js).code
  return `\n<script>\n${min}\n</script>\n`
}

const regexStyleImport = /<link rel="stylesheet" href="([^":]+)">/g
const styleReplacer = (match,fname) => {
  const css = fs.readFileSync("./src/" + fname,"utf8")
  return `\n<style>\n${css}\n</style>\n`
}

const html = fs.readFileSync(fname,"utf8")
const result = html.replace(regexScriptImport,scriptReplacer).replace(regexStyleImport,styleReplacer).replace(/<\/script>\s*<script>/g,"")


fs.writeFileSync("./public/index.html",result)

fs.copyFile("./src/favicon.ico","./public/favicon.ico",() => { })

let workerFile = fs.readFileSync("./src/worker.js","utf8")
workerFile = workerFile.replace(/importScripts\(([^\)]+)\)/g,(match,namesText) => {
  const names = namesText.match(/"([^"]+)"/g)
  console.log(names)
  let result = ""
  for (let name of names) {
    result += "\n" + fs.readFileSync("./src/" + name.substring(1,name.length - 1),"utf8") + "\n"
  }
  return result
})

workerFile = UglifyJS.minify(workerFile).code

fs.writeFileSync("./public/worker.js",workerFile)

// console.log(`took ${performance.now() - stime}`)

const fs = require('fs')
const zlib = require('zlib')
const stream = require('stream')
const minify = require('html-minifier').minify;

const { performance } = require('perf_hooks')

const compress = (fileName) => {
  const cpystime = performance.now()
  const compressor = zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } })
  const source = fs.createReadStream(`./public/${fileName}`)
  const target = fs.createWriteStream(`./public-br/${fileName}.br`)
  stream.pipeline(source, compressor, target, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
    console.log(performance.now() - cpystime)
  })
}

const compressPublic = () => {
  const fileNames = fs.readdirSync("./public")
  for (let fileName of fileNames) {
    if (fileName.match(/\.[a-z]+$/))
      compress(fileName)
  }
}

console.log("building")

const buildWorker = (workerName = 'worker') => {
  // copy worker & splice in importScripts. 
  // dead code now, but I'll use it if I add back in workers
  let workerFile = fs.readFileSync(`./src/${workerName}.js","utf8`)
  workerFile = workerFile.replace(/importScripts\(([^\)]+)\)/g, (match, namesText) => {
    const names = namesText.match(/"([^"]+)"/g)
    console.log(names)
    let result = ""
    for (let name of names) {
      result += "\n" + fs.readFileSync("./src/" + name.substring(1, name.length - 1), "utf8") + "\n"
    }
    return result
  })
  fs.writeFileSync("./public/worker.js", workerFile)
}

const build = () => {

  const regexScriptImport = /<script src="([^":]+)"( async)?><\/script>/g
  const scriptReplacer = (match, fname, async) => {
    let js = fs.readFileSync("./src/" + fname, "utf8")
    js = js.replace(/\/\/@module(.|\n|\r)*$/, "")
    return `\n<script${async || ""}>\n${js}\n</script>\n`
  }

  const regexStyleImport = /<link rel="stylesheet" href="([^":]+)">/g
  const styleReplacer = (match, fname) => {
    const css = fs.readFileSync("./src/" + fname, "utf8")
    return `\n<style>\n${css}\n</style>\n`
  }

  const html = fs.readFileSync("./src/index.html", "utf8")
  const result = html.replace(regexScriptImport, scriptReplacer).replace(regexStyleImport, styleReplacer).replace(/<\/script>\s*<script( async)?>/g, "").replace(/\r?\n\s*/g, "\n")
  // todo use minify(text, {toplevel:true}) for more mangling
  // todo minify inline

  const htmlmin = minify(result, { collapseWhitespace: true, minifyJS: true, minifyCSS: true, removeComments: true, removeOptionalTags: true, removeRedundantAttributes: true, useShortDoctype: true })

  fs.writeFileSync("./public/index.html", htmlmin)

  fs.copyFile("./src/favicon.ico", "./public/favicon.ico", () => { })
  fs.copyFile("./src/default-store.json", "./public/default-store.json", () => { })
  fs.copyFile("./src/test.js", "./public/test.js", () => { })
}
build()

if (process.argv.includes('compress')) {
  compressPublic()
}

if (process.argv.includes('serve')) {
  const { exec } = require("child_process")
  exec("node serve.js ./public")
}


const minifyReadablishName = (string) => {
  result = string[0]
  for (let cap of string.matchAll(/[A-Z]/g)) {
    result += cap[0]
  }
  return result
}

const simpletonRemovePrint = (string) => string.replaceAll(/^[\t ]+print\([^\n]+\)\n/g, "").replaceAll(/^[\t ]+console\.log\([^\n]+\)\n/g, "")
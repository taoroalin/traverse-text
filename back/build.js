const fs = require('fs')
const zlib = require('zlib')
const stream = require('stream')
const minify = require('html-minifier').minify;

const { performance } = require('perf_hooks')

const compress = (fileName) => new Promise(resolve => {
  const cpystime = performance.now()
  const compressor = zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } })
  const source = fs.createReadStream(`../front/public/${fileName}`)
  const target = fs.createWriteStream(`../front/public-br/${fileName}`)
  stream.pipeline(source, compressor, target, (err) => {
    if (err) {
      console.log("failed to compress:", err)
    }
    console.log(fileName + " " + Math.floor(performance.now() - cpystime))
    resolve()
  })
})

const compressPublic = async () => {
  const fileNames = fs.readdirSync("../front/public")
  for (let fileName of fileNames) {
    const ext = fileName.match(/\.[a-z0-9]+$/)
    if (ext && ext != ".woff2")
      await compress(fileName)
  }
}

console.log("building")

const buildWorker = (workerName = 'worker') => {
  // copy worker & splice in importScripts. 
  // dead code now, but I'll use it if I add back in workers
  let workerFile = fs.readFileSync(`../front/src/${workerName}.js","utf8`)
  workerFile = workerFile.replace(/importScripts\(([^\)]+)\)/g, (match, namesText) => {
    const names = namesText.match(/"([^"]+)"/g)
    console.log(names)
    let result = ""
    for (let name of names) {
      result += "\n" + fs.readFileSync("../front/src/" + name.substring(1, name.length - 1), "utf8") + "\n"
    }
    return result
  })
  fs.writeFileSync("../front/public/worker.js", workerFile)
}

const build = async () => {

  const regexScriptImport = /<script src="([^":]+)"( async)?><\/script>/g
  const scriptReplacer = (match, fname, async) => {
    let js = fs.readFileSync("../front/src/" + fname, "utf8")
    js = js.replace(/\/\/~frontskip([^~]|\n|\r)*~/, "")
    js = js.replace(/^[ \t]*(print|console.log)[^\n]+\r?\n/, "") // remove all console.log or print
    return `\n<script${async || ""}>\n${js}\n</script>\n`
  }

  const regexStyleImport = /<link rel="stylesheet" href="([^":]+)">/g
  const styleReplacer = (match, fname) => {
    const css = fs.readFileSync("../front/src/" + fname, "utf8")
    return `\n<style>\n${css}\n</style>\n`
  }

  const html = fs.readFileSync("../front/src/index.html", "utf8")
  const result = html.replace(regexScriptImport, scriptReplacer).replace(regexStyleImport, styleReplacer).replace(/<\/script>\s*<script( async)?>/g, "").replace(/<\/style>[\t\r\n ]*<style>/g, "")
  // todo use minify(text, {toplevel:true}) for more mangling
  // todo minify inline

  fs.writeFileSync("../front/public/index-no-min.html", result)
  const htmlmin = minify(result, { collapseWhitespace: true, minifyJS: true, minifyCSS: true, removeComments: true, removeOptionalTags: true, removeRedundantAttributes: true, useShortDoctype: true })

  fs.writeFileSync("../front/public/index.html", htmlmin)

  fs.copyFile("../front/src/favicon.ico", "../front/public/favicon.ico", () => { })
  fs.copyFile("../front/src/default-store.json", "../front/public/default-store.json", () => { })
  fs.copyFile("../front/src/Inter-latin.woff2", "../front/public/Inter-latin.woff2", () => { })
  fs.copyFile("../front/src/Inconsolata-latin.woff2", "../front/public/Inconsolata-latin.woff2", () => { })
  await compressPublic()
}
build()

exports.build = build
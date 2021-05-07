const fs = require('fs')
const child_process = require('child_process')

const common = require('./common')

const { performance } = require('perf_hooks')

const argset = {}
for (let i = 2; i < process.argv.length; i++) {
  argset[process.argv[i]] = 1
}

const compress = (fileName) => new Promise(resolve => {
  const cpystime = performance.now()

  if (argset.brotli) {
    const source = fs.createReadStream(`../front/public/${fileName}`)
    const target = fs.createWriteStream(`../front/public/${fileName}.br`)
    common.brCompressExpensiveStream(source, target, (err) => {
      console.log("brotli " + fileName + " in " + Math.floor(performance.now() - cpystime))
      resolve()
    })
  }

  if (!argset.nogzip) {
    const source2 = fs.createReadStream(`../front/public/${fileName}`)
    const target2 = fs.createWriteStream(`../front/public/${fileName}.gz`)
    common.gzCompressStream(source2, target2, (err) => {
      console.log("gzip " + fileName + " in " + Math.floor(performance.now() - cpystime))
      resolve()
    })
  }
})

const compressPublic = async () => {
  const fileNames = fs.readdirSync("../front/public")
  for (let fileName of fileNames) {
    const ext = fileName.match(/\.[a-z0-9]+$/)
    if (ext && ext != ".woff2" && ext != '.br' && ext != '.gz')
      await compress(fileName)
  }
}

const copyPublicForNginx = async () => {
  const fileNames = fs.readdirSync("../front/public")
  for (let fileName of fileNames) {
    fs.copyFileSync('../front/public/' + fileName, '/www/data/' + fileName)
  }
}

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

  const bstime = performance.now()
  const regexScriptImport = /<script src="([^":]+)"( async)?><\/script>/g
  const scriptReplacer = (match, fname, async) => {
    let js = fs.readFileSync("../front/src/" + fname, "utf8")
    js = js.replace(/\/\/~frontskip([^~]|\n|\r)*~/g, "")
    js = js.replace(/^[ \t]*(print|console.log)[^\n]+\r?\n/g, "") // remove all console.log or print
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
  console.log(`read files in ${Math.round(performance.now() - bstime)}`)

  fs.writeFileSync("../front/public/index-max.html", result)
  // fs.writeFileSync("../front/public/index.html", result)

  const mstime = performance.now()
  child_process.execSync(`../front/minify`)
  console.log(`minify took ${performance.now() - mstime}`)
  fs.unlinkSync("../front/public/index-max.html") // delete, called unlink for some reason

  fs.copyFile("../front/src/favicon.ico", "../front/public/favicon.ico", () => { })

  fs.copyFile("../front/src/Inter-latin-600.woff2", "../front/public/Inter-latin-600.woff2", () => { })
  fs.copyFile("../front/src/Inter-latin-400.woff2", "../front/public/Inter-latin-400.woff2", () => { })
  fs.copyFile("../front/src/Inter-latin-300.woff2", "../front/public/Inter-latin-300.woff2", () => { })
  fs.copyFile("../front/src/Inconsolata-latin-400.woff2", "../front/public/Inconsolata-latin-400.woff2", () => { })

  await compressPublic()

  if (fs.existsSync('/www/data/')) {
    await copyPublicForNginx()
  }

}

let _ = (async () => {

  await build()

  if (argset.watch) {
    let watchFnTimeout = null
    const watchFnDebounced = () => {
      clearTimeout(watchFnTimeout)
      watchFnTimeout = setTimeout(build, 50)
    }

    fs.watch("../front/src", (eventType, fileName) => {
      if (eventType === "change") {
        watchFnDebounced()
      }
    })
  }
})()

exports.build = build
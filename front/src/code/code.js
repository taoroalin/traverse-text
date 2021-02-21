const varTemplate = document.getElementById("code__var").content.firstElementChild
const blockTemplate = document.getElementById("code__block").content.firstElementChild
const stringTemplate = document.getElementById("code__string").content.firstElementChild
const numberTemplate = document.getElementById("code__number").content.firstElementChild
const flowTemplate = document.getElementById("code__flow").content.firstElementChild


const regexIf = /^if/
const regexWhile = /^while/
const regexFor = /^for/
const regexBreak = /^break/
const regexConst = /^const/
const regexLet = /^let/
const regexVar = /^var/
const regexArrow = /^=>/
const regexName = /^[a-z_$][a-zA-Z_$0-9]*/
const regexClass = /^[A-Z][a-zA-Z_$0-9]*/
const regexNumber = /^[+-]?(\d+|(\d*\.\d+)|(\d+\.\d*))(e[+-]?\d+)?/
const regexString = /^"((?:(?:\\.)|[^"\\])*)"[ \t\r\n,]*/
const regexElipsis = /^\.\.\./


const renderJavascriptCode = (codeNode,text) => {
  // flow const var string number arrow type
  let idx = 0
  let subjectOfAssignment = null
  const stack = [codeNode]
  while (text.length > 0) {

  }
}






// parser contexts are: statement, expression, block
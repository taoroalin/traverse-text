const fs = require('fs')
const { exec,spawn } = require('child_process')

const runfile = process.argv[2]
console.log(runfile)

fs.watch(runfile,async (event,filename) => {
  const { error,stdout,stderr } = await exec(`clang ${runfile}.c -o ${runfile} && ./${runfile}`)
  if (error) {
    console.log("there was an error")
  } else {
    console.log(`stdout ${stdout}`)
  }
  console.log(`stderr ${stderr}`)
})

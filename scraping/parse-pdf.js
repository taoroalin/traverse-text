const pdfParse = require('pdf-parse')
// const PDFParser = require('pdf2json')
const fs = require('fs')

const examplePDFBuffer = fs.readFileSync('./examples/baker2003.pdf')

let throwaway =
  (async () => {
    const pdfObj = await pdfParse(examplePDFBuffer)
    const pdfText = pdfObj.text
    fs.writeFileSync('./output/baker2003.txt', pdfText)

    // const pdfInstance = new PDFParser()
    // pdfInstance.on("pdfParser_dataError", errData => console.error(errData.parserError));
    // pdfInstance.on('pdfParser_dataReady', data => {
    //   // fs.writeFile('./output/pdf2json.json', JSON.stringify(data))
    //   fs.writeFile('./node_modules/pdf2json/output/pdf2json.json', JSON.stringify(data))
    // })
    // pdfInstance.loadPDF('./examples/baker2003.pdf')
  })()
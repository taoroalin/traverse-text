package main

import (
	"bufio"
	"os"
	"regexp"

	"github.com/tdewolff/minify/v2"

	"github.com/tdewolff/minify/v2/css"
	"github.com/tdewolff/minify/v2/html"
	"github.com/tdewolff/minify/v2/js"
)

func breakOn(err error) {
	if err != nil {
		panic(err)
	}
}

var configuredMinifier = minify.New()
var jsRegex = regexp.MustCompile("^(application|text)/(x-)?(java|ecma)script$")

func main() {
	configuredMinifier.AddFunc("text/css", css.Minify)
	configuredMinifier.AddFunc("text/html", html.Minify)
	configuredMinifier.AddFuncRegexp(jsRegex, js.Minify)

	inputFile, err := os.Open("../front/public/index-max.html")
	breakOn(err)

	outputFile, err := os.Create("../front/public/index.html")
	outputFileWriter := bufio.NewWriter(outputFile)
	breakOn(err)
	defer inputFile.Close()
	defer outputFile.Close()
	// gzipWriter, err := gzip.NewWriterLevel(outputFile, gzip.BestCompression)
	// breakOn(err)

	// var minified bytes.Buffer
	err = configuredMinifier.Minify("text/html", outputFileWriter, inputFile)
	breakOn(err)

	// outputFileGzip, err := os.Create("./public/index.html.gz")
	// breakOn(err)
	// gzipWriter, err := gzip.NewWriterLevel(outputFileGzip, gzip.BestCompression)
	// breakOn(err)

	// gzipWriter.Write(minified.Bytes())
	// outputFileGzip.Close()
}

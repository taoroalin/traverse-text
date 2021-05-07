package main

import (
	"io/ioutil"
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

	inputBytes, err := ioutil.ReadFile("../front/public/index-max.html")
	breakOn(err)

	outputBytes, err := configuredMinifier.Bytes("text/html", inputBytes)
	breakOn(err)
	ioutil.WriteFile("../front/public/index.html", outputBytes, 0644)

	// outputFileGzip, err := os.Create("./public/index.html.gz")
	// breakOn(err)
	// gzipWriter, err := gzip.NewWriterLevel(outputFileGzip, gzip.BestCompression)
	// breakOn(err)

	// gzipWriter.Write(minified.Bytes())
	// outputFileGzip.Close()
}

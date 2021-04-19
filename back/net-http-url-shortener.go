package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"sync"
)

const filePath = "../user-data/url-shortener.txt"

var file *os.File
var urls []string
var mutex sync.Mutex

func base64StringToIdx(str string) (idx int) {
	bytes := []byte(str)
	if len(bytes) > 4 {
		return -1
	}
	idx = 0
	for i := 0; i < len(bytes); i++ {
		currentByte := bytes[i]
		if currentByte == 0x2d {
			currentByte = 0
		} else if currentByte == 0x5f {
			currentByte = 1
		} else if 0x30 <= currentByte && currentByte <= 0x39 {
			currentByte -= 46
		} else if 0x61 <= currentByte && currentByte <= 0x7A {
			currentByte -= 97 - 12
		} else if 0x41 <= currentByte && currentByte <= 0x5A {
			currentByte -= 65 - 38
		} else {
			return -1
		}

		idx |= int(currentByte) << (i * 6)
	}
	return
}

func idxToBase64String(idx int32) (str string) {
	str = ""
	for idx > 0 {
		part := idx & 0x3f
		if part == 0 {
			str = str + "-"
		} else if part == 1 {
			str = str + "_"
		} else if part <= 11 {
			str = str + string(byte(part+46))
		} else if part <= 37 {
			str = str + string(byte(part+85))
		} else {
			str = str + string(byte(part+27))
		}
		idx = idx >> 6
	}
	return
}

func breakOn(e error) {
	if e != nil {
		panic(e)
	}
}

func addUrl(w http.ResponseWriter, req *http.Request) {
	path := req.URL.Path
	url := path[9:] // length of /add-url/
	mutex.Lock()
	idx := len(urls)
	// appending to the file and to the array must happen at the same time.
	urls = append(urls, url)
	_, err2 := file.WriteString(url + "\n")
	mutex.Unlock()
	fmt.Fprintf(w, "your url is "+idxToBase64String(int32(idx)))
	breakOn(err2)
}

func dumpUrls(w http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(w, "%v", urls)
}

func blank(w http.ResponseWriter, req *http.Request) {
	fmt.Fprint(w, "hello world")
}

func redirect(w http.ResponseWriter, req *http.Request) {
	reqHex := req.URL.Path[1:]
	index := base64StringToIdx(reqHex)
	if index < 0 || index >= len(urls) {
		fmt.Fprint(w, "Invalid URL")
		return
	}
	url := urls[index]
	w.Header().Set("Location", url)
	w.WriteHeader(http.StatusMovedPermanently)
}

func getUrl(w http.ResponseWriter, req *http.Request) {
	reqHex := req.URL.Path[1:]
	index := base64StringToIdx(reqHex)
	if index < 0 || index >= len(urls) {
		fmt.Fprint(w, "Invalid URL")
		return
	}
	url := urls[index]
	fmt.Fprint(w, "your url is "+url)
}

func main() {
	fmt.Println("starting url shortener")
	dat, err := ioutil.ReadFile(filePath)
	if err != nil || len(dat) < 1 {
		ioutil.WriteFile(filePath, []byte("\n"), 0644)
	}
	breakOn(err)
	filestring := string(dat)
	urls = strings.Split(filestring, "\n")
	urls = urls[:len(urls)-1]
	// each line is appended with a newline, so we have to remove the trailing newline

	file, err = os.OpenFile(filePath,
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		0644)
	breakOn(err)

	http.HandleFunc("/urls", dumpUrls)
	http.HandleFunc("/add-url/", addUrl)
	http.HandleFunc("/", redirect)
	http.HandleFunc("/get/", getUrl)
	http.HandleFunc("/blank", blank)

	http.ListenAndServe("127.0.0.1:8090", nil)
}

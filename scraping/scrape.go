package main

import (
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/gocolly/colly"
)

// callback must deliver results out-of-band
func scrapeDomain(domain string, callback func(url string)) {
	seen := map[string]bool{}
	mutex := sync.Mutex{}
	unseen := make(chan string, 10_000_000)
	for i := 0; i < 10000; i++ {
		go func() {
			for job := range unseen {
				mutex.Lock()
				seen[job] = true
				mutex.Unlock()
				c := colly.NewCollector(colly.AllowedDomains(domain))
				// Find and visit all links
				c.OnHTML("a[href]", func(e *colly.HTMLElement) {
					newLink := e.Request.AbsoluteURL(e.Attr("href"))
					mutex.Lock()
					if !seen[newLink] {
						unseen <- newLink
					}
					mutex.Unlock()
				})
				c.OnRequest(func(r *colly.Request) {
					callback(job)
				})
				c.Visit(job)
			}
		}()
	}
	unseen <- "http://" + domain
	time.Sleep(30 * time.Second)
	mutex.Lock()
	fmt.Printf("saw %v\n", len(seen))
	mutex.Unlock()
}

func main() {
	// scrapeDomain("go-colly.org", func(url string) {
	// 	fmt.Println("Visiting", url)
	// })
	// os.Exit(0)

	// statusCode, body, err := fasthttp.Get([]byte{}, testSites[0])
	// if statusCode == 200 && err == nil {
	// 	reader := bytes.NewReader(body)
	// 	blox := parseReader(reader)
	// 	fmt.Printf("%v\n", blox)
	// }
	fmt.Println("done")
	file, _ := os.Open("./examples/danluu-complexity.html")
	blox := parseReader(file)
	fmt.Printf("%+v\n", blox)
}

var testSites = []string{"https://danluu.com/octopress-speedup/", "https://forum.effectivealtruism.org/posts/yNn2o3kEhixZHkRga/certificates-of-impact"}

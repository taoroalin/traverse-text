package main

import (
	"fmt"
	"io"
	"regexp"
	"time"

	ttxt "github.com/taoroalin/traverse-text"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

var defaultTagsToScore = map[string]bool{
	"section": true,
	"h2":      true,
	"h3":      true,
	"h4":      true,
	"h5":      true,
	"h6":      true,
	"p":       true,
	"td":      true,
	"pre":     true}

var unlikelyCandidates = regexp.MustCompile(`-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote`)
var okMaybeItsACandidate = regexp.MustCompile(`and|article|body|column|content|main|shadow`)
var negative = regexp.MustCompile(`-ad-|hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|foot|footer|footnote|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget`)
var positive = regexp.MustCompile(`article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story`)

var videoLinkRegex = regexp.MustCompile(`//(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)`)

var tagsToIgnore = map[atom.Atom]bool{atom.Svg: true,
	atom.Input:  true,
	atom.Canvas: true,
	atom.Button: true}

var blockTags = map[atom.Atom]bool{
	atom.Address:    true,
	atom.Article:    true,
	atom.Aside:      true,
	atom.Blockquote: true,
	atom.Dd:         true,
	atom.Div:        true,
	atom.Dl:         true,
	atom.Dt:         true,
	atom.Fieldset:   true,
	atom.Figcaption: true,
	atom.Figure:     true,
	atom.Footer:     true,
	atom.Form:       true,
	atom.H1:         true,
	atom.H6:         true,
	atom.Header:     true,
	atom.Hr:         true,
	atom.Li:         true,
	atom.Main:       true,
	atom.Ol:         true,
	atom.P:          true,
	atom.Pre:        true,
	atom.Section:    true,
	atom.Table:      true,
	atom.Tfoot:      true,
	atom.Ul:         true,
}

var inlineTags = map[atom.Atom]bool{

	atom.A:        true,
	atom.Abbr:     true,
	atom.Acronym:  true,
	atom.B:        true,
	atom.Bdo:      true,
	atom.Big:      true,
	atom.Br:       true,
	atom.Button:   true,
	atom.Cite:     true,
	atom.Code:     true,
	atom.Dfn:      true,
	atom.Em:       true,
	atom.I:        true,
	atom.Img:      true,
	atom.Input:    true,
	atom.Kbd:      true,
	atom.Label:    true,
	atom.Map:      true,
	atom.Object:   true,
	atom.Output:   true,
	atom.Q:        true,
	atom.Samp:     true,
	atom.Select:   true,
	atom.Small:    true,
	atom.Span:     true,
	atom.Strong:   true,
	atom.Sub:      true,
	atom.Sup:      true,
	atom.Textarea: true,
	atom.Time:     true,
	atom.Tt:       true,
	atom.Var:      true,
}

func isNodeBlockLayout(node *html.Node) bool {
	_, ok := blockTags[node.DataAtom]
	return ok
}

func isNodeInlineLayout(node *html.Node) bool {
	_, ok := inlineTags[node.DataAtom]
	return ok
}

func parseReader(doc io.Reader) *ttxt.QualifiedBlox {
	stime := time.Now()
	node, parseError := html.Parse(doc)
	fmt.Printf("parse took %v\n", time.Since(stime))
	if parseError != nil {
		fmt.Print(parseError)
	}

	var qblox ttxt.QualifiedBlox = ttxt.NewQBlox("placeholder name")

	var blox = qblox.Blox

	rootBloc := ttxt.StringToBloc("placeholder title", blox)
	println("root bloc " + rootBloc)
	inInline := false
	blocStack := []ttxt.BlocId{rootBloc}
	stackTop := rootBloc

	var processNode func(*html.Node) error

	numVisited := 0

	processNode = func(node *html.Node) error {
		numVisited++
		if node.Type == html.TextNode {
			if inInline {
				bloc := blox[stackTop]
				bloc.String += node.Data
				blox[stackTop] = bloc
			} else {
				thisBloc := ttxt.StringToBlocParent(node.Data, ttxt.BlocId(stackTop), blox)
				blocStack = append(blocStack, thisBloc)
				stackTop = thisBloc
			}
			if node.NextSibling != nil {
				processNode(node.NextSibling)
			}
			return nil
		} else if node.Type == html.ElementNode || node.Type == html.DoctypeNode || node.Type == html.DocumentNode {

			if tagsToIgnore[node.DataAtom] {
				return nil
			}

			if node.DataAtom == atom.Title {
				bloc := blox[rootBloc]
				bloc.String = node.FirstChild.Data
				blox[rootBloc] = bloc
				qblox.Name = node.FirstChild.Data
				return nil
			}

			if node.FirstChild != nil {
				processNode(node.FirstChild)
			}
			if isNodeBlockLayout(node) && inInline {
				blocStack = blocStack[:len(blocStack)-1]
				stackTop = blocStack[len(blocStack)-1]
				inInline = false
			}
			if node.NextSibling != nil {
				processNode(node.NextSibling)
			}
			return nil
		} else {
			fmt.Printf("UNEXPECTD NODE %+v\n", node.Type)
		}
		return nil
	}
	stime = time.Now()
	err := processNode(node)
	fmt.Printf("walk took %v\n", time.Since(stime))
	fmt.Printf("visited %v\n", numVisited)

	if err != nil {
		return nil
	}
	return &qblox
}

/**
how does Mozilla readability work?

simplify nested - just DIV and SECTION
*/

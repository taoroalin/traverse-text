# Traverse Text

A Roam Research clone focused on performance and shareability, with ambitions to be more.

# How to get started developing Traverse Text

Use text wrap in your editor. This codebase is made using text wrap, and you will have a very hard time reading the code otherwise.

Clone on an Ubuntu machine, then run `./start-fresh.sh`. This will create empty data folders, install nodejs and (optional) npm dependencies, and start the site and API server. If all goes well the site will be up on `localhost:8081`. Whenever you change the code, you can reload the page to see the changes. Otherwise it's up to you to read and debug the script.

# Why did I make Traverse Text?

I love Roam Research. I think that sort of freeform, linked text should be the default for all writing. However, Roam Research doesn't scale to large documents, and isn't quick to share. From my conversations with them, these issues are not a priority for Roam Research, and thus I am solving them myself.

# Software Dependencies

NodeJS, html-minifier, Go, `github.com/valyala/fasthttp`, nginx. JavaScript (vanilla, based off HTML `<template>`) on the front end.

# Intentional differences compared to Roam

Sharing focus. I want to share my notes, and want to make sharing and commenting good. I prioritize linking between users more than multiple users on the same account.

Performance standards. 50ms end-to-end (including display/keyboard latency), or 10ms in-app is a reasonable amount of time to take to load a page of text.

# Features over Roam

Live markup. see links, highlights, ect while typing

Zen mode: hide top bar and the page has nothing but content

10x performance

# Features missing compared to Roam

roam/css, image upload, page list, favorites, the prototype roam/render features like kanban, tables, and many others I don't remember

# Benchmarks

Site load from my 2Mb graph in local indexedDB: 170ms to 450ms

Page link load: 15ms per page for my 1000 pages. Ranges from 5ms to 200ms for ordinary sized pages, but I've seen 2s for extremely large script-generated pages.

Note: Website performance depends on your browser, browser extensions, computer, internet connection, location, phase of the GC cycle (basically witchcraft). Browser extensions add a surprising amount of lag, sometimes 0.5 seconds on load.

## Data architecture

Each person's own notes, called 'blox', is a are stored in one JSON string / object. This entire object (1.5Mb for me), or diffs on that object when it changes (tbd), are sent from the server to the client. No smaller unit of notes is sent. This allows the client to do all the logic, and makes the UX as fast as possible.

When the client receives the 'blox', it creates the 'store', which contains the blox and indexing data. This takes 50-80ms. This indexing data makes the store 30% bigger than 'blox'. The indexing info exists only on the client in order to reduce the bandwidth requirements, and to elminate fragmented writes that would be required on the backend on indexes only the front end uses.

Terse JSON keys
```
                string parent kids       create-time edit-time create-user edit-user
blox: {bloc-id:{s,     p,     k:[kid-id],ct,         et,       cu,         eu }}

graphs      last-commit-id is-public-readable
graph-name:{l,             p}

Account
user-readable email username password-hash read-stores      write-stores      settings
{u:          {e,    u,       h,            r:{graph-name:1},w:{graph-name:1}, s}

settings: {theme:("light"|"dark"),spellcheck:boolean,topBar:("visible"|"hidden"),logging:boolean,noVideo:boolean,editingSpotlight:boolean}
```

I originally stored the 'store' in indexeddb because it's supposed to have more capacity / reliability than localStorage, but it's slower so now I write to localStorage and indexedDB and only read from indexedDB if the localStorage didn't work.

Session specific data, for the recording browser history, in sessionState. The current state is global and updated mutably, then copied into a seperate object when needed to remember states.

There are a large number of global variables, all (mutable ones) declared in index.html and declarations.js

user settings are stored in seperate from graph, and apply to all graphs that user views.

## Code organization

The code is arranged by when it is run, not what part of the system it's in. All the event handlers are together, renderers are together, queries are together, commands are together, ect, instead of being arranged into components which each have their own event handling, logic, ect. 

All event handling for non-permanent elements (anything without id) is done through global documend event handlers which switch on the target element. I did this because I thought it would speed up rendering (when you click a link, event handler runs once, but block renderer runs 100 times, so move code from renderer to event handler). Still might move towards a more normal structure.

## Pulling in other text sources

I plan to pull in text from a lot of different sites such as blogs, twitter, ect, so that their full text can be referenced and searched from within Traverse Text.

Key point is that it doesn't crawl between sites on its own. You find a site you like on your own, and it brings in that specific site.

## Templating

I'm using HTML `<template>`s, `cloneNode`, and `element.firstElementChild.children[1].innerText=` for templating because it's the most performant out of methids I tested (more so than string replacement or `document.createElement`). This is hard to read and overly coupled, so I may make an abstraction over this. The highest performance option (which would not be tremendously more performant than other options) is a preprocessor that reads positions of classes within templates and replaces "calls" to those classes with `element.firstElementChild.children[1]` type stuff. Query at compile time, not runtime.

## Future improvements

Handling huge block parses. Right now it works well up to something like 500 syntax elements per block. Gets synchronously laggy after that.

Make each page render (and block render?) keep track of how long it's taken and break + resume when it takes too long

Improvements to bracket auto-closing. Do it to more types of brackets, do backspace matching

When there is cross-graph linking, load graphs when they're needed before first render, then do others in 50ms chunks

# Working on right now

exporting / importing markdown files

making signup and login work and have good ui


Switching backend to Go for 10x server performance.

Finding a more reliable / efficient change sync model
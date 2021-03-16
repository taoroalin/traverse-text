# Micro Roam

Fast note taking and sharing app inspired by Roam Research.

# Mission

Make your internet 10x+ faster.

What does this mean exactly? It means making your experience of creating, browsing, sharing, and searching 10x faster. The main technologies behind this right now are _large scale client side text caching_ and _performance tuned JavaScript_. 

How is the 10x dream achievable? JavaScript, which is engineered to run bloated frameworks, is now able to search through gigabytes of text per second. Fast internet connections, which normally transfer megabytes of dead weight JavaScript, can instead ship megabytes of related information to your computer up front and make it searchable instantaneously. It's possible to render 60 different pages of text per second, and open a link in as long as it takes to type 1 character into a terminal.

Basically what it does: In the same compute + bandwidth a React site uses to render a text field, you download every public writing made by any of your friends, search it, and pretty-print the result.

# Why did I make Micro Roam?

I love Roam Research. I think that sort of freeform, linked text should be the default for everything we write. However, Roam Research doesn't have the engineering quality to be that default for most people, and from my conversations with them, the team at Roam is not heading in that direction.

# The Stack

This project is made with *System Complexity*, in mind. That means instead of writing your own code to be elegant, you write code such that the entire project, including the platform, libraries, frameworks, as a whole is as as simple as possible. Currently the dependencies are:

I chose my tech stack, JS and Node w/o NPM, because the language is familiar and it allows me to spend my time writing code, not reading documentation, and it can achieve reasonable performance. Tech I'm considering down the road includes more HTML Canvas, C, C++, SycllaDB, PostgreSQL, NGINX, and JAI.

# Intentional differences compared to Roam

Few/no extensions. Running user written code in your product is inherently slow and unreliable. I am not interested in open distribution JavaScript extensions, and will only support CSS extensions if I find a new way to make them far more reliable.

Sharing focus. I want to share my notes, and want to make sharing and commenting good. I prioritize linking between users more than multiple users on the same account.

Performance standards. 50ms end-to-end (including display/keyboard latency), or 10ms in-app is a reasonable amount of time to take to load a page of text.

# Features over Roam

Live markup. see links, highlights, ect while typing

Zen mode: hide top bar and the page has nothing but content

10x performance

# Features missing compared to Roam

Queries, roam/render, roam/css, image upload, page list, favorites, a some other small ones

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

accounts user-readable email username password-hash readable-stores  writeable-stores  settings
users   {u:           {e     u,       h             r:{graph-name:1} w:{graph-name:1}, s}
```

I originally stored the 'store' in indexeddb because it's supposed to have more capacity / reliability than localStorage, but it's slower so now I write to localStorage and indexedDB and only read from indexedDB if the localStorage didn't work.

Session specific data, for the recording browser history, in sessionState. The current state is global and updated mutably, then copied into a seperate object when needed to remember states.

There are a large number of global variables, all (mutable ones) declared in index.html and declarations.js

user settings are stored in seperate from graph, and apply to all graphs that user views.

## Code organization

The code is arranged by when it is run, not what part of the system it's in. All the event handlers are together, renderers are together, queries are together, commands are together, ect, instead of being arranged into components which each have their own event handling, logic, ect. 

All event handling for non-permanent elements (anything without id) is done through global documend event handlers which switch on the target element. I did this because I thought it would speed up rendering (when you click a link, event handler runs once, but block renderer runs 100 times, so move code from renderer to event handler). Still might move towards a more normal structure.

## Pulling in other text sources

I plan to pull in text from a lot of different sites such as blogs, twitter, ect, so that their full text can be referenced and searched from within Micro Roam.

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

Plan for non-editing blocs: have seperate class for editing bloc, still have contenteditable on noedit blocs, on focusin record position then rerender as editbloc

# Issues

Enter to create block not work sometimes?
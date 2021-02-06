# Micro Roam

Fast note taking app inspired by Roam Research. Aims to be 10x faster than Roam at all times, including site load, note load, creating blocks, ect. If you see it performing 5x faster than Roam or less, feel free to complain to me.

## Internals

This project is made with *System Complexity*, in mind. That means instead of writing your own code to be elegant, you write code such that the entire project, including the platform, libraries, frameworks, as a whole is as as simple as possible. To that end, this project doesn't use libraries or NPM.

## Forking

This repo uses git submodules, which means you need to clone with the --recursive flag.

### Templating

I'm using HTML `<template>`s, `cloneNode`, and `element.firstElementChild.children[0].innerText=` for templating because it's the most performant out of methids I tested (more so than string replacement or `document.createElement`). This is hard to read and overly coupled, so eventually I'll make a preprocessing abstraction over this.
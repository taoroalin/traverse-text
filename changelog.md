I've been struggling to organize my data for awhile. There are two types of data structures in this codebase: ones that go away at the end of the session and those that are persisted in some way. Because I want to be able to restart sessions, pretty much everything is persisted in some way, so the only things that aren't are caches of those that are. 

There are three locations to persist to: localStorage, indexedDB, and server.

Here are all the core data structures:

sessionState

user

storeMeta

store

otherStores

previously these were all just lying around in the global scope, and there were global functions like saveUser that modified the user and saved it. this was bad because it wasn't obvious whether it's okay to change a certain data structure, and how to do that.

I'm trying a new pattern for data organization. it's called Singleton Manager Wrappers or something. there are three of them: sessionStateManager, userManager, storeManager. their data is accessed transparently like `userManager.user.thing`, but set through setters that manage persistance

it's important that transactions never need to span multiple managers, as that would require a manager manager or something
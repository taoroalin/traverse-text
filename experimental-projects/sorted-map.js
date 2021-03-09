/*
I have a lot of profiling to do here. Need to know (preferably in JSON) the exact time/size curves for array.splice, member access inside tree, binary search array, linear search array
*/

const BTREE_FAN_BITS = 6

const examplebtree = [{ k: 6,l: [{ k: 3,v: "value" },{}] }]

const makeSortedMap = () => []

const updateSortedMap = () => {

}

const deleteSortedMap = () => {

}

const testSortedMap = () => {

}

const bisect = (arr,val) => {
  let len = arr.length
  let top = arr[len - 1]
  let bottom = arr[0]
  while (top > bottom) {
    const mid = (top + bottom) / 2
  }
}

const linsearch = (arr,val) => {
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (val >= v) {
      return v
    }
  }
}

const rands = [...Array(1000000)].map(x => Math.random())

const sorted64 = [...Array(128).keys()]

const zstime = performance.now()
for (let i = 0; i < 1000000; i++) {
  sorted64.indexOf(Math.floor(rands[i] * 128))
}
console.log(`indexof took ${performance.now() - zstime}`)
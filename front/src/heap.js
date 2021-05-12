class Heap {
  constructor(arr, isIncreasing) {
    this.arr = arr;
    this.isIncreasing = isIncreasing;

    for (let i = arr.length; i >= 0; i--) {
      this.heapifyRooted(i);
    }
  }

  heapifyRooted(initial) {
    let smallest = initial;
    const l = 2 * smallest + 1;
    const r = 2 * smallest + 2;
    if (l < this.arr.length && this.isIncreasing(this.arr[l], this.arr[smallest])) {
      smallest = l;
    }
    if (r < this.arr.length && this.isIncreasing(this.arr[r], this.arr[smallest])) {
      smallest = r;
    }
    if (smallest != initial) {
      const temp = this.arr[initial];
      this.arr[initial] = this.arr[smallest];
      this.arr[smallest] = temp;
      this.heapifyRooted(smallest);
    }
  }

  pop() {
    const result = this.arr[0];
    this.arr[0] = this.arr[this.arr.length - 1];
    this.heapifyRooted(0);
    return result;
  }

  push(element) {
    this.arr.push(element);
    let currentIdx = this.arr.length - 1;
    let parentIdx = (currentIdx - 1) >>> 1;
    while (this.isIncreasing(this.arr[currentIdx], this.arr[parentIdx])) {
      const temp = this.arr[currentIdx];
      this.arr[currentIdx] = this.arr[parentIdx];
      this.arr[parentIdx] = temp;
      currentIdx = parentIdx;
      parentIdx = (currentIdx - 1) >>> 1;
    }
  }
}

export const testTheHeap = () => {
  const testHeap = new Heap([12, 433, 4, 2, 545,], (a, b) => a < b);

  testHeap.push(1);
  testHeap.push(1000);

  const stime = performance.now();
  for (let i = 0; i < 100000; i++) {
    const num = Math.floor(Math.random() * 100000);
    testHeap.push(num);
  }

  console.log(testHeap.arr);
  let prev = -1;
  for (let i = 0; i < testHeap.arr.length; i++) {
    const cur = (testHeap.pop());
    if (cur < prev) throw new Error("heap popped out of order");
    prev = cur;
  }
  console.log("Heap test passed");
  console.log(`took ${performance.now() - stime}`); // took 100ms to push+pop 100,000 things last time
};
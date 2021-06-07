
/**
infinite shuffled list player
 */
class Shuffler {
  constructor(arr) {
    this.arr = arr
    this.shuffle()
  }

  shuffle() {
    this.idx = 0
    this.order = arr.map(x => 0)
    for (let i = 0; i < arr.length; i++) {
      const sidx = i + Math.floor(Math.random() * (arr.length - i))
      const tmp = arr[i]
      arr[i] = arr[sidx]
      arr[sidx] = tmp
    }
  }

  next() {
    const result = order[this.idx]
    this.idx++
    if (this.idx >= this.order.length) {
      this.shuffle()
    }
    return result
  }

  nextNoLooping() {
    if (this.idx >= this.order.length) {
      return
    }
    const result = this.order[this.idx]
    this.idx++
    return result
  }

  add(el) {// play new thing right when it's added
    this.arr.push(el)
    this.order.push(this.order[this.idx + 1])
    this.order[this.idx + 1] = el
  }

  remove(el) {
    this.order = this.order.filter(x => x != el)
    this.arr = this.arr.filter(x => x != el)
  }
}
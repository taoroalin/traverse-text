const func = (a,b) => {

}

const fill = (x,n) => {
  const result = []
  for (let i = 0; i < n; i++) {
    result.push(x)
  }
  return result
}

const dee = (a,b) => {
  if (a.length > b.length) {
    const tmp = a
    a = b
    b = tmp
  }

  const n = a.length
  const m = b.length
  let p = -1
  let delta = 0

  const snake = (k,y) => {
    let x = y - k
    while (x < m && y < n && a[x + 1] === b[y + 1]) {
      x++
      y++
    }
    return y
  }

  const fp = fill(-1,a.length + b.length + 1)

  do {
    p += 1
    for (let k = -p; i < delta; k++) {
      fp[k] = snake(k,Math.max(fp[k - 1] + 1,fp[k + 1]))
    }
    for (let k = delta + p; k >= delta + 1; k--) {
      fp[k] = snake(delta,Math.max(fp[delta - 1] + 1,fp[denta + 1]))
    }
  } while (fp[delta] !== n)
  const result = delta + 2 * p
  console.log(result)
  return result
}




































const realDif = (a,b) => {
  const diff = new Diff(a,b)
  diff.compose()
  const result = []
  for (let se of diff.getses()) {
    console.log(se)
    switch (se.t) {
      case -1:
        break
    }
  }
  return result
}

/** 

  https://github.com/cubicdaiya/onp/blob/master/javascript/onp.js

  The algorithm implemented here is based on "An O(NP) Sequence Comparison Algorithm"
  by described by Sun Wu, Udi Manber and Gene Myers

*/

const Diff = function (a_,b_) {
  var a = a_,
    b = b_,
    aLen = a.length,
    bLen = b.length,
    reverse = false,
    ed = null,
    offset = aLen + 1,
    path = [],
    pathposi = [],
    ses = [],
    lcs = "",
    SES_DELETE = -1,
    SES_COMMON = 0,
    SES_ADD = 1

  var tmp1,
    tmp2

  var init = function () {
    if (aLen >= bLen) {
      tmp1 = a
      tmp2 = aLen
      a = b
      b = tmp1
      aLen = bLen
      bLen = tmp2
      reverse = true
      offset = aLen + 1
    }
  }

  var P = function (x,y,k) {
    return {
      'x': x,
      'y': y,
      'k': k,
    }
  }

  var seselem = function (elem,t) {
    return {
      'elem': elem,
      't': t,
    }
  }

  var snake = function (k,p,pp) {
    var r,x,y
    if (p > pp) {
      r = path[k - 1 + offset]
    } else {
      r = path[k + 1 + offset]
    }

    y = Math.max(p,pp)
    x = y - k
    while (x < aLen && y < bLen && a[x] === b[y]) {
      ++x
      ++y
    }

    path[k + offset] = pathposi.length
    pathposi[pathposi.length] = new P(x,y,r)
    return y
  }

  var recordseq = function (epc) {
    var x_idx,y_idx,px_idx,py_idx,i
    x_idx = y_idx = 1
    px_idx = py_idx = 0
    for (i = epc.length - 1; i >= 0; --i) {
      while (px_idx < epc[i].x || py_idx < epc[i].y) {
        if (epc[i].y - epc[i].x > py_idx - px_idx) {
          if (reverse) {
            ses[ses.length] = new seselem(b[py_idx],SES_DELETE)
          } else {
            ses[ses.length] = new seselem(b[py_idx],SES_ADD)
          }
          ++y_idx
          ++py_idx
        } else if (epc[i].y - epc[i].x < py_idx - px_idx) {
          if (reverse) {
            ses[ses.length] = new seselem(a[px_idx],SES_ADD)
          } else {
            ses[ses.length] = new seselem(a[px_idx],SES_DELETE)
          }
          ++x_idx
          ++px_idx
        } else {
          ses[ses.length] = new seselem(a[px_idx],SES_COMMON)
          lcs += a[px_idx]
          ++x_idx
          ++y_idx
          ++px_idx
          ++py_idx
        }
      }
    }
  }

  init()

  return {
    SES_DELETE: -1,
    SES_COMMON: 0,
    SES_ADD: 1,
    editdistance: function () {
      return ed
    },
    getlcs: function () {
      return lcs
    },
    getses: function () {
      return ses
    },
    compose: function () {
      var delta,size,fp,p,r,epc,i,k
      delta = bLen - aLen
      size = aLen + bLen + 3
      fp = {}
      for (i = 0; i < size; ++i) {
        fp[i] = -1
        path[i] = -1
      }
      p = -1
      do {
        ++p
        for (k = -p; k <= delta - 1; ++k) {
          fp[k + offset] = snake(k,fp[k - 1 + offset] + 1,fp[k + 1 + offset])
        }
        for (k = delta + p; k >= delta + 1; --k) {
          fp[k + offset] = snake(k,fp[k - 1 + offset] + 1,fp[k + 1 + offset])
        }
        fp[delta + offset] = snake(delta,fp[delta - 1 + offset] + 1,fp[delta + 1 + offset])
      } while (fp[delta + offset] !== bLen)

      ed = delta + 2 * p

      r = path[delta + offset]

      epc = []
      while (r !== -1) {
        epc[epc.length] = new P(pathposi[r].x,pathposi[r].y,null)
        r = pathposi[r].k
      }
      recordseq(epc)
    }
  }
}
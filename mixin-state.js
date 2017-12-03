const capturing = new Set()
const updating = new Set()
const END = Symbol('set-state:end')
const GUARD = Symbol('set-state:guard')
const NODE = Symbol('set-state:node')
let isCapturing = false
const isPrimitive = x => Object(x) !== x
const isFunction = x => typeof x === 'function'
const isNode = x => isFunction(x) && x.is === NODE
const isSealed = x => isNode(x) && x.sealed === GUARD
const isFrozen = x => isNode(x) && x.compute === END
const getValue = f => (isNode(f) ? f() : f)
const get = (obj, key = [], p = 0) => {
  key = key.split ? key.split('.') : key
  while (obj && p < key.length) {
    obj = obj[key[p++]]
  }
  return obj
}
const toJSON = x => (x.toJSON === undefined ? x : x.toJSON())
const recompute = node => {
  const prev = node.value
  node.value = node.compute()
  if (prev !== node.value) {
    for (const fn of node.listeners) {
      fn(node.value)
    }
  }
}
const update = node => {
  if (updating.has(node)) updating.delete(node)
  updating.add(node)
  for (const dep of node.dependents) {
    update(dep)
  }
}
const eachDep = (node, method) => {
  for (const dep of node.dependencies) {
    dep.dependents[method](node)
  }
}

const on = function (obj, method) {
  const fn = isFunction(obj) ? obj : obj[method].bind(obj)
  this.listeners.add(fn)
  return () => this.listeners.delete(fn)
}
const thunk = function () { return this }
const ap = function (a) { return state(() => a()(this())).seal() }
const map = function (fn) { return state(() => fn(this())).seal() }
const concat = function (...arr) { return state(() => [this, ...arr].map(getValue)).seal() }
const flatMap = function (fn) { return state(() => [].concat(...this().map(fn))).seal() }
const reduce = function (fn, a) {
  const $a = state(a)
  $a(() => fn($a(), this()))
  return $a.seal()
}
const pluck = function (path) { return state(() => get(this(), path)).seal() }
const either = function (a, b) { return state(() => a(this()) || b(this())).seal() }
const seal = function () { return this(GUARD) }
const freeze = function () { return this(END) }
const valueOf = function () { return this.value }
const nodeToJSON = function () { return isPrimitive(this.value) ? this.value : toJSON(this.value) }
const mixin = {
  is: {value: NODE, writable: false},
  thunk: {value: thunk, writable: false},
  on: {value: on, writable: false},
  ap: {value: ap, writable: false},    
  map: {value: map, writable: false},
  concat: {value: concat, writable: false},
  flatMap: {value: flatMap, writable: false},
  mapcat: {value: flatMap, writable: false},
  reduce: {value: reduce, writable: false},
  pluck: {value: pluck, writable: false},
  either: {value: either, writable: false},
  seal: {value: seal, writable: false},
  freeze: {value: freeze, writable: false},
  end: {value: freeze, writable: false},
  valueOf: {value: valueOf, writable: false},
  toString: {value: valueOf, writable: false},
  toJSON: {value: nodeToJSON, writable: false}
}
const mixin2 = {
  is: NODE,
  thunk,
  on,
  ap,
  map,
  concat,
  flatMap,
  mapcat: flatMap,
  reduce,
  pluck,
  either,
  seal,
  freeze,
  end: freeze,
  valueOf,
  toString: valueOf,
  toJSON: nodeToJSON
}

const state = compute => {
  if (isNode(compute)) return compute
  const node = new_compute => {
    if (isCapturing) capturing.add(node)
    if (isFrozen(node) || isSealed(node)) return node.value
    if (new_compute !== undefined) {
      if (new_compute === node.value) return node
      if (new_compute === GUARD) {
        node.sealed = GUARD
        return node
      }
      eachDep(node, 'delete')
      node.dependencies.clear()
      if (new_compute === END) {
        node.compute = END
        return node
      }
      node.compute = () => new_compute
      if (isFunction(new_compute)) {
        node.compute = new_compute
        isCapturing = true
        capturing.clear()
        recompute(node)
        capturing.delete(node)
        node.dependencies = new Set(capturing)
        isCapturing = false
        eachDep(node, 'add')
      } else {
        recompute(node)
      }
      updating.clear()
      for (const dep of node.dependents) {
        update(dep)
      }
      for (const up of updating) {
        recompute(up)
      }
    }
    return node.value
  }
  // Object.defineProperties(node, mixin)
  Object.assign(node, mixin2)
  node.listeners = new Set()
  node.dependents = new Set()
  node.dependencies = new Set()
  node(compute)
  return node
}
state.END = END
state.GUARD = GUARD
state.isNode = isNode
state.isSealed = isSealed
state.isFrozen = state.isFinished = isFrozen
state.freeze = state.end = a => state(a).end()
state.seal = a => state(a).seal()
state.merge = arr => state(() => arr.map(getValue)).seal()
state.combine = nodes =>
  state(() =>
    Object.entries(nodes).reduce((o, [k, v]) => {
      o[k] = isNode(v) ? v() : v
      return o
    }, {})
  ).seal()
state.of = state
module.exports = state

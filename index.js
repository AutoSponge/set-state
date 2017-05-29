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
const split = obj => (obj.split ? obj.split('.') : obj)
const get = (obj, path) =>
  split(path).reduce((val, key) => val && val[key], obj)
const toJSON = x => (x.toJSON === undefined ? x : x.toJSON())
const recompute = node => {
  node.value = node.compute()
  node.listeners.forEach(fn => fn(node.value))
}
const update = node => {
  if (updating.has(node)) updating.delete(node)
  updating.add(node)
  node.dependents.forEach(update)
}
const eachDep = (node, method) =>
  node.dependencies.forEach(dep => dep.dependents[method](node))

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
      node.dependents.forEach(update)
      updating.forEach(recompute)
    }
    return node.value
  }
  node.is = NODE
  node.listeners = new Set()
  node.dependents = new Set()
  node.dependencies = new Set()
  node.on = (obj, method) => {
    const fn = isFunction(obj) ? obj : obj[method].bind(obj)
    node.listeners.add(fn)
    return () => node.listeners.delete(fn)
  }
  node.ap = a => state(() => a()(node())).seal()
  node.map = fn => state(() => fn(node())).seal()
  node.concat = (...arr) =>
    state(() => [node, ...arr].map(getValue)).seal()
  node.flatMap = node.mapcat = fn => state(() => [].concat(...node().map(fn))).seal()
  node.reduce = (fn, a) => {
    const $a = state(a)
    $a(() => fn($a(), node()))
    return $a.seal()
  }
  node.pluck = path => state(() => get(node(), path)).seal()
  node.seal = () => node(GUARD)
  node.freeze = node.end = () => node(END)
  node.valueOf = node.toString = () => node.value
  node.toJSON = () =>
    (isPrimitive(node.value) ? node.value : toJSON(node.value))
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

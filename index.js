const capturing = new Set()
const updating = new Set()
const END = Symbol('set-state:end')
const GUARD = Symbol('set-state:guard')
const NODE = Symbol('set-state:node')
let isCapturing = false
const isPrimitive = x => Object(x) !== x
const isFunction = x => typeof x === 'function'
const isNode = x => isFunction(x) && x.is === NODE
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
    if (node.compute === END || node.sealed === GUARD) return node.value
    if (new_compute !== undefined) {
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
  node.on = fn => {
    node.listeners.add(fn)
    return () => node.listeners.delete(fn)
  }
  node.ap = a => state(() => a()(node()))
  node.map = fn => state(() => fn(node()))
  node.concat = (...arr) =>
    state(() => [node, ...arr].map(getValue))
  node.flatMap = node.mapcat = fn => state(() => [].concat(...node().map(fn)))
  node.reduce = (fn, a) => {
    const $a = state(a)
    $a(() => fn($a(), node()))
    return $a
  }
  node.pluck = path => state(() => get(node(), path))
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
state.freeze = state.end = a => state(a).end()
state.seal = a => state(a).seal()
state.merge = arr => state(() => arr.map(getValue))
state.combine = nodes =>
  state(() =>
    Object.entries(nodes).reduce((o, [k, v]) => {
      o[k] = isNode(v) ? v() : v
      return o
    }, {})
  )
state.of = state
module.exports = state

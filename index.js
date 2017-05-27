const capturing = new Set()
const updating = new Set()
const END = Symbol('set-state:end')
let isCapturing = false
const isPrimitive = x => Object(x) !== x
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
  const node = new_compute => {
    if (isCapturing) capturing.add(node)
    if (node.compute === END) return node.value
    if (new_compute !== undefined) {
      eachDep(node, 'delete')
      node.dependencies.clear()
      if (new_compute === END) {
        node.compute = END
        return node.value
      }
      node.compute = () => new_compute
      if (typeof new_compute === 'function') {
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
  node.listeners = new Set()
  node.dependents = new Set()
  node.dependencies = new Set()
  node.on = fn => {
    node.listeners.add(fn)
    return () => node.listeners.delete(fn)
  }
  node.ap = a => state(() => a()(node()))
  node.map = fn => state(() => fn(node()))
  node.concat = (...arr) => state(() => [node, ...arr].map(f => f()))
  node.reduce = (fn, a) => {
    const $a = state(a)
    $a(() => fn($a(), node()))
    return $a
  }
  node.end = () => node(END)
  node.valueOf = node.toString = () => node.value
  node.toJSON = () =>
    (isPrimitive(node.value) ? node.value : toJSON(node.value))
  node(compute)
  return node
}
state.END = END
state.merge = (arr = []) => state(() => arr.map(f => f()))
state.combine = (nodes = {}) =>
  state(() =>
    Object.entries(nodes).reduce((o, [k, v]) => {
      o[k] = v()
      return o
    }, {})
  )
state.of = state
module.exports = state

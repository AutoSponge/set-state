const capturing = new Set()
const updating = new Set()
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
    if (new_compute !== undefined) {
      eachDep(node, 'delete')
      node.dependencies.clear()
      node.compute = () => new_compute
      if (typeof new_compute === 'function') {
        node.compute = new_compute
        isCapturing = true
        capturing.clear()
        recompute(node)
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
  node.toJSON = () =>
    (isPrimitive(node.value) ? node.value : toJSON(node.value))
  node(compute)
  return node
}

module.exports = state

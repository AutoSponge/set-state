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
    if (method === 'add' && dep.dependencies.has(node)) {
      throw new ReferenceError('circular reference created.')
    }
    dep.dependents[method](node)
  }
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
  // Start CORE API
  node.is = NODE
  node.listeners = new Set()
  node.dependents = new Set()
  node.dependencies = new Set()
  node.seal = () => node(GUARD)
  node.freeze = node.end = () => node(END)
  node.valueOf = node.toString = () => node.value
  node.toJSON = () =>
    (isPrimitive(node.value) ? node.value : toJSON(node.value))
  node.on = (obj, method) => {
    const fn = isFunction(obj) ? obj : obj[method].bind(obj)
    node.listeners.add(fn)
    return () => node.listeners.delete(fn)
  }
  // End CORE API

  // Start EXTENDED API
  node.push = async (fn, err) => {
    if (node.dependencies.size > 0) {
      throw new RangeError('unable to update a node with dependencies')
    }
    if (node.pushing) {
      throw new TypeError('unable to push on node while a push is pending')
    }
    node.pushed = node.value
    node.pushing = fn(node.value)
    try {
      node(await node.pushing)
    } catch (e) {
      if (err) {
        err(e)
      } else {
        throw new Error(e)
      }
    }
    node.pushing = false
  }
  node.thunk = () => node
  node.ap = a => state(() => a()(node())).seal()
  node.map = fn => state(() => fn(node())).seal()
  node.concat = (...arr) => state(() => [node, ...arr].map(getValue)).seal()
  node.flatMap = node.mapcat = fn =>
    state(() => [].concat(...node().map(fn))).seal()
  node.reduce = (fn, a) => {
    const $a = state(a)
    $a(() => fn($a(), node()))
    return $a.seal()
  }
  node.pluck = path => state(() => get(node(), path)).seal()
  node.either = (a, b) => state(() => a(node()) || b(node())).seal()
  // END EXTENDED API

  node(compute)
  return node
}

// CORE statics
state.END = END
state.GUARD = GUARD
state.isNode = isNode
state.isSealed = isSealed
state.isFrozen = state.isFinished = isFrozen
// End CORE statics

// OPTIONAL statics
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
// End OPTIONAL statics

module.exports = state

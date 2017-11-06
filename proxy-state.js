const capturing = new Set()
const updating = new Set()
let isCapturing = false
const END = Symbol('set-state:end')
const GUARD = Symbol('set-state:guard')
const NODE = Symbol('set-state:node')
const isPrimitive = x => Object(x) !== x
const isFunction = x => typeof x === 'function'

class State extends Function {
  static get END () {
    return END
  }
  static get GUARD () {
    return GUARD
  }
  static get NODE () {
    return NODE
  }
  static get isCapturing () {
    return isCapturing
  }
  static isNode (x) {
    return isFunction(x) && x.is === State.NODE
  }
  static isSealed (x) {
    return State.isNode(x) && x.sealed === State.GUARD
  }
  static isFrozen (x) {
    return State.isNode(x) && x.compute === State.END
  }
  static isFinished (x) {
    return State.isFrozen(x)
  }
  static freeze (x) {
    return State.of(x).freeze()
  }
  static end (x) {
    return State.of(x).end()
  }
  static getValue (f) {
    return State.isNode(f) ? f() : f
  }
  static toJSON (x) {
    return x.toJSON === undefined ? x : x.toJSON()
  }
  static seal (a) {
    return State.of(a).seal()
  }
  static merge (arr) {
    return State.seal(() => arr.map(State.getValue))
  }
  static combine (nodes) {
    return State.seal(() =>
      Object.entries(nodes).reduce((o, [k, v]) => {
        o[k] = State.isNode(v) ? v() : v
        return o
      }, {})
    )
  }
  static of (x) {
    return new State(x)
  }
  constructor (compute) {
    if (State.isNode(compute)) {
      return compute
    }
    super()
    this.is = State.NODE
    this.listeners = new Set()
    this.dependents = new Set()
    this.dependencies = new Set()
    const apply = (target, that, args) => this.state.apply(this, args)
    this.instance = new Proxy(this, { apply })
    this.state(compute)        
    return this.instance
  }
  state (new_compute) {
    if (isCapturing) capturing.add(this)
    if (State.isFrozen(this) || State.isSealed(this)) return this.value
    if (new_compute !== undefined) {
      if (new_compute === this.value) return this
      if (new_compute === State.GUARD) {
        this.sealed = State.GUARD
        return this.instance
      }
      this.eachDep('delete')
      this.dependencies.clear()
      if (new_compute === State.END) {
        this.compute = State.END
        return this.instance
      }
      if (isFunction(new_compute)) {
        this.compute = new_compute
        isCapturing = true
        capturing.clear()
        this.recompute()
        capturing.delete(this)
        this.dependencies = new Set(capturing)
        isCapturing = false
        this.eachDep('add')
      } else {
        this.compute = () => new_compute
        this.recompute()
      }
      updating.clear()
      for (const dep of this.dependents) {
        dep.update()
      }
      for (const up of updating) {
        up.recompute()
      }
    }
    return this.value
  }
  thunk () {
    return this.instance
  }
  on (obj, method) {
    const fn = isFunction(obj) ? obj : obj[method].bind(obj)
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  ap (a) {
    return State.seal(() => a()(this.state()))
  }
  map (fn) {
    return State.seal(() => fn(this.state()))
  }
  concat (...arr) {
    return State.seal(() => [this, ...arr].map(State.getValue))
  }
  mapcat (fn) {
    return State.seal(() => [].concat(...this.state().map(fn)))
  }
  flatMap (fn) {
    return this.mapcat(fn)
  }
  reduce (fn, a) {
    const $a = State.of(a)
    $a(() => fn($a(), this.state()))
    return $a.seal()
  }
  get (key = [], p = 0, obj = this.state()) {
    key = key.split ? key.split('.') : key
    while (obj && p < key.length) {
      obj = obj[key[p++]]
    }
    return obj
  }
  pluck (path) {
    return State.seal(() => this.get(path))
  }
  either (a, b) {
    return State.seal(() => a(this.state()) || b(this.state()))
  }
  seal () {
    return this.state(State.GUARD)
  }
  freeze () {
    return this.state(State.END)
  }
  end () {
    return this.state(State.END)
  }
  valueOf () {
    return this.value
  }
  toString () {
    return this.value
  }
  toJSON () {
    return isPrimitive(this.value) ? this.value : State.toJSON(this.value)
  }
  recompute () {
    const prev = this.value
    this.value = this.compute()
    if (prev !== this.value) {
      for (const fn of this.listeners) {
        fn(this.value)
      }
    }
  }
  update () {
    if (updating.has(this)) updating.delete(this)
    updating.add(this)
    for (const dep of this.dependents) {
      dep.update()
    } 
  }
  eachDep (method) {
    for (const dep of this.dependencies) {
      dep.dependents[method](this.instance)
    }
  }
}

// const CallableState = State
// const ProxyState = State
module.exports = State

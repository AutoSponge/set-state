const test = require('tape')
const state = require('../')

test('set-state interface', t => {
  t.plan(1)
  t.equal(typeof state, 'function', 'is a function')
})

test('set-state with no arguments', t => {
  t.plan(3)
  const node = state.of()
  t.equal(typeof node, 'function', 'returns a function')
  t.equal(typeof node.on, 'function', 'has an #on() method')
  t.equal(node(), undefined)
})

test('set-state.of().thunk()', t => {
  t.plan(1)
  const node = state.of()
  t.equal(node.thunk(), node, '#thunk() is Identity')
})

test('set-state.of().on()', t => {
  t.plan(8)
  let count = 0
  const node = state.of(0)
  const cancel = node.on(value => t.equal(value, 1))
  t.equal(typeof cancel, 'function')
  t.equal(node(), 0)
  node(1)
  cancel()
  node(2)
  const bound = state.of()
  const obj = {
    value: bound,
    setValue: function (n) {
      count++
      return this.value(n)
    }
  }
  const input = state.of(0)
  input.on(obj, 'setValue')
  t.equal(obj.value(), undefined)
  t.equal(count, 0)
  input(1)
  t.equal(obj.value(), 1)
  t.equal(count, 1)
  input(1)
  t.equal(count, 1)
})

test('set-state with non-function argument', t => {
  t.plan(8)
  const n = state.of(0)
  const b = state.of(false)
  const nan = state.of(NaN)
  const _null = state.of(null)
  const str = state.of('')
  const obj = {}
  const arr = []
  const date = new Date()
  const $obj = state.of(obj)
  const $arr = state.of(arr)
  const $date = state.of(date)

  t.equal(n(), 0)
  t.equal(b(), false)
  t.equal(isNaN(nan()), true)
  t.equal(_null(), null)
  t.equal(str(), '')
  t.equal($obj(), obj)
  t.equal($arr(), arr)
  t.equal($date(), date)
})

test('set-state with function argument', t => {
  t.plan(1)
  const calculate = { count: 0 }
  const node = state.of(() => {
    calculate.count += 1
    return calculate.count
  })
  node()
  node()
  t.equal(node(), 1, 'only calculates once')
})

test('set-state with dependency', t => {
  t.plan(2)
  const a = state.of(0)
  const b = state.of(() => a() + 1)
  t.equal(b(), 1, 'b has the correct initial value')
  a(41)
  t.equal(b(), 42, 'b updates when a changes')
})

test('set-state with ternary', t => {
  t.plan(4)
  const a = state.of(1)
  const b = state.of(2)
  const c = state.of(3)
  const d = state.of(($b = b(), $c = c()) => (a() === 0 ? $b : $c))
  t.equal(d(), 3, 'd has the correct initial value')
  c(4)
  t.equal(d(), 4, 'd updates when c changes')
  a(0)
  t.equal(d(), 2, 'd updates when a changes')
  b(1)
  t.equal(d(), 1, 'd updates when b changes')
})

test('set-state calculates and emits once', t => {
  t.plan(6)
  const calculate = { count: 0 }
  const a = state.of(2)
  const b = state.of(4)
  const c = state.of(6)
  const ab = state.of(() => a() + b())
  const bc = state.of(() => b() + c())
  const ac = state.of(() => a() + c())
  const abc = state.of(() => {
    calculate.count += 1
    return a() + ab() + ac()
  })
  t.equal(ab(), 6, 'ab has the correct initial value')
  t.equal(ac(), 8, 'ac has the correct initial value')
  t.equal(abc(), 16, 'abc has the correct initial value')
  t.equal(calculate.count, 1, 'abc calculates once on bootstrap')
  abc.on(value => t.equal(value, 19, 'abc only emits once when a changes'))
  a(3)
  t.equal(calculate.count, 2, 'abc only calculates once when a changes')
})

test('set-state does not emit when value is equal', t => {
  t.plan(2)
  const a = state.of(0)
  const b = state.of(() => a() + 1)
  a.on(() => t.equal(a(), 1))
  b.on(() => t.equal(b(), 2))
  a(1)
  a(1)
  a(1)
})

test('set-state.of().toJSON()', t => {
  t.plan(1)
  const n = state.of(0)
  const b = state.of(false)
  const nan = state.of(NaN)
  const _null = state.of(null)
  const str = state.of('')
  const obj = { a: 1 }
  const arr = ['a', 1]
  const date = new Date(0)
  const $obj = state.of(obj)
  const $arr = state.of(arr)
  const $date = state.of(date)
  const json = JSON.stringify(
    { n, b, _null, str, $obj, $arr, $date },
    null,
    '  '
  )
  t.equal(
    json,
    `{
  "n": 0,
  "b": false,
  "_null": null,
  "str": "",
  "$obj": {
    "a": 1
  },
  "$arr": [
    "a",
    1
  ],
  "$date": "1970-01-01T00:00:00.000Z"
}`
  )
})

test('set-state.of().map(fn) returns state.of(() => fn(n))', t => {
  t.plan(2)
  const g = state.of(0)
  const f = g.map(n => n + 1)
  t.equal(f(), 1)
  g(1)
  t.equal(f(), 2)
})

test('set-state.of().end() will stop updating dependents', t => {
  t.plan(4)
  const g = state.of(0)
  const f = state.of(() => g() + 1)
  t.equal(f(), 1)
  g(1)
  t.equal(f(), 2)
  g.end()
  g(2)
  t.equal(g(), 1)
  t.equal(f(), 2)
})

test('set-state.of(set-state.END) is desugared .end()', t => {
  t.plan(4)
  const g = state.of(0)
  const f = state.of(() => g() + 1)
  t.equal(f(), 1)
  g(1)
  t.equal(f(), 2)
  g(state.END)
  g(2)
  t.equal(g(), 1)
  t.equal(f(), 2)
})

test('set-state.freeze(a) returns state.of(a).end()', t => {
  t.plan(3)
  const g = state.of(0)
  const f = state.end(() => g() + 1)
  t.equal(f(), 1)
  g(2)
  t.equal(g(), 2)
  t.equal(f(), 1)
})

test('set-state.merge(arr) returns state.of(() => [...arr()])', t => {
  t.plan(2)
  const a = state.of('hello')
  const b = state.of('world')
  const greeting = state.merge([a, b]).map(values => {
    return values.join(' ')
  })
  t.equal(greeting(), 'hello world')
  b('everybody')
  t.equal(greeting(), 'hello everybody')
})

test('set-state.merge(arr) only executes set-state fns', t => {
  t.plan(2)
  const a = x => x + '!'
  const b = state.of('hello')
  const c = 'world'
  const greeting = state.merge([a, b, c]).map(([fn, ...values]) => {
    return fn(values.join(' '))
  })
  t.equal(greeting(), 'hello world!')
  b('goodbye')
  t.equal(greeting(), 'goodbye world!')
})

test('set-state.of(a).concat(arr) returns state.of(() => [a(), ...arr()])', t => {
  t.plan(2)
  const a = state.of('hello')
  const b = state.of('world')
  const greeting = a.concat(b).map(values => values.join(' '))
  t.equal(greeting(), 'hello world')
  a('goodbye')
  b('everybody')
  t.equal(greeting(), 'goodbye everybody')
})

test('set-state.combine({a}) returns state.of(() => {a: a()})', t => {
  t.plan(2)
  const a = state.of(1)
  const b = state.of(() => a() + 1)
  const combined = state.combine({ a, b })
  t.deepEqual(combined(), { a: 1, b: 2 })
  b(3)
  t.deepEqual(combined(), { a: 1, b: 3 })
})

test('set-state.combine() only executes set-state fns', t => {
  t.plan(2)
  const a = state.of(1)
  const b = () => a() + 1
  const c = 2
  const combined = state.combine({ a, b, c })
  t.deepEqual(combined(), { a: 1, b: b, c: 2 })
  a(3)
  t.deepEqual(combined(), { a: 3, b: b, c: 2 })
})

test('set-state.of(a).ap(state.of(b:fn)) returns state.of(() => b()(a()))', t => {
  t.plan(3)
  const a = state.of(1)
  const b = state.of(() => a => a + 1)
  const ap = a.ap(b)
  t.equal(ap(), 2, '1 + 1')
  a(2)
  t.equal(ap(), 3, '2 + 1')
  b(() => a => a * a)
  t.equal(ap(), 4, '2 * 2')
})

test('set-state.of().reduce(fn, a) returns state.of(() => b(fn(b(), a())))', t => {
  t.plan(2)
  const n = state.of(0)
  const count = n.reduce(total => total + 1, 0)
  t.equal(count(), 1, 'count should calculate once when created')
  n(5)
  t.equal(count(), 2, 'count should ignore the value of n')
})

test('set-state.of().reduce(fn, state.of(a)) returns state.of(() => b(fn(b(), a())))', t => {
  t.plan(2)
  const n = state.of(0)
  const count = n.reduce(total => total + 1, state.of(0))
  t.equal(count(), 1)
  n(5)
  t.equal(count(), 2)
})

test('set-state.of(a).reduce(fn) returns state.of(() => b(fn(b(), a))', t => {
  t.plan(3)
  const input = state.of('')
  const strBuilder = input.reduce((prev = '', next) => prev + next)
  t.equal(strBuilder(), '')
  input('fizz')
  t.equal(strBuilder(), 'fizz')
  input('buzz')
  t.equal(strBuilder(), 'fizzbuzz')
})

test('set-state.of(a) implements toString and valueOf', t => {
  t.plan(2)
  const a = state.of(1)
  a(2)
  t.equal(a.valueOf(), 2)
  t.equal(a + '', '2')
})

test('set-state.of(a).flatMap returns state.of(() => [...a].map(fn))', t => {
  t.plan(2)
  const list = state.of([{ b: [1, 2] }, { b: [3, 4] }, { b: [] }])
  const flat = list.flatMap(a => a.b)
  t.deepEqual(flat(), [1, 2, 3, 4])
  list([{ b: [1] }, { b: [3] }, { b: [] }, { b: [5] }])
  t.deepEqual(flat(), [1, 3, 5])
})

test('set-state.of(a).pluck() returns state.of(a)', t => {
  t.plan(1)
  const s1 = state.of({})
  const s2 = s1.pluck()
  t.equal(s1(), s2())
})

test('set-state.of(a).pluck(path) returns state.of(() => a[path])', t => {
  t.plan(9)
  const obj1 = { a: { b: { c: 'hello' } } }
  const obj2 = { a: { b: { c: 'goodbye' } } }
  const obj3 = { a: {} }
  const obj = state.of(obj1)
  const pluckUndef = obj.pluck()
  const pluckedStr = obj.pluck('a.b.c')
  const pluckedArr = obj.pluck(['a', 'b', 'c'])
  t.equal(pluckUndef(), obj1)
  t.equal(pluckedStr(), 'hello')
  t.equal(pluckedArr(), 'hello')
  obj(obj2)
  t.equal(pluckUndef(), obj2)
  t.equal(pluckedStr(), 'goodbye')
  t.equal(pluckedArr(), 'goodbye')
  obj(obj3)
  t.equal(pluckUndef(), obj3)
  t.equal(pluckedStr(), undefined)
  t.equal(pluckedArr(), undefined)
})

test('set-state.of(a).pluck(path) is quiet', t => {
  t.plan(1)
  const obj = state.of()
  obj.pluck('a.b.c').on(n => t.equal(n, 'hello'))
  obj({ a: { b: { c: 'hello' } } })
  obj({ a: { b: { c: 'hello', d: 'world' } } })
})

test('set-state.of(a).either(f, g)', t => {
  t.plan(4)
  const gt10 = n => n > 10
  const even = n => n % 2 === 0
  const f = state.of()
  const g = f.either(gt10, even)
  f(3)
  t.equal(g(), false)
  f(12)
  t.equal(g(), true)
  f(11)
  t.equal(g(), true)
  f(2)
  t.equal(g(), true)
})

test('set-state.of(a).seal() prevents direct updates', t => {
  t.plan(3)
  const a = state.of(1)
  const b = state.of(() => a() + 1).seal()
  t.equal(b(), 2)
  b(0)
  t.equal(b(), 2)
  a(-1)
  t.equal(b(), 0)
})

test('set-state.seal(a) returns state.of(a).seal()', t => {
  t.plan(3)
  const a = state.of(1)
  const b = state.seal(() => a() + 1)
  t.equal(b(), 2)
  b(0)
  t.equal(b(), 2)
  a(-1)
  t.equal(b(), 0)
})

test('projections of state should be sealed', t => {
  t.plan(11)
  const a = state.of(0)
  const b = state.of(() => n => n)
  const c = state.of([1])
  t.false(state.isSealed(a))
  t.false(state.isSealed(b))
  t.true(state.isSealed(a.map(n => n + 1)))
  t.true(state.isSealed(a.ap(b)))
  t.true(state.isSealed(a.concat(b)))
  t.true(state.isSealed(a.reduce(n => n + 1)))
  t.true(state.isSealed(a.pluck([])))
  t.true(state.isSealed(c.flatMap(n => n + 1)))
  t.true(state.isSealed(state.combine({ a, b })))
  t.true(state.isSealed(state.merge([a, b])))
  t.true(state.isSealed(a.either(n => n, () => 2)))
})

test('isFrozen', t => {
  t.plan(3)
  const a = state.of(0)
  const b = state.of(1)
  t.false(state.isFrozen(a))
  a(state.END)
  t.true(state.isFrozen(a))
  b.freeze()
  t.true(state.isFrozen(b))
})

test('set-state.of(a).push(f) passes value', async t => {
  t.plan(1)
  const a = state.of(0)
  const f = n => n + 1
  await a.push(f)
  t.true(a(), 1)
})

test('set-state.of(a).push(f, err)', async t => {
  t.plan(1)
  const a = state.of()
  const f = () => Promise.reject('rejected promise handled')
  const err = e => t.pass(e)
  await a.push(f, err)
})

test('set-state.of(a).push(f) throws', async t => {
  t.plan(1)
  const a = state.of()
  const f = () => Promise.reject('rejected promise thrown')
  try {
    await a.push(f)
  } catch (e) {
    t.pass(e)
  }
})

test('set-state.of(() => a() + 1).push(f) throws', async t => {
  t.plan(1)
  const a = state.of(0)
  const b = state.of(() => a() + 1)
  const f = n => n + 1
  try {
    await b.push(f)
    t.fail()
  } catch (e) {
    t.pass(e)
  }
})

test('set-state.of(a).push(f).push(f) throws', async t => {
  t.plan(1)
  const a = state.of(0)
  const f = () => new Promise(() => {})
  try {
    a.push(f)
    await a.push(f)
  } catch (e) {
    t.pass(e)
  }
})

test('set-state.of(a).push(f) awaits f, updates b', t => {
  t.plan(2)
  const a = state.of({ json: 'old' })
  const b = a.pluck('json')
  const f = () => Promise.resolve({ json: 'new' })
  t.equal(b(), 'old')
  b.on(val => t.equal(val, 'new'))
  a.push(f)
})

test(`const a = state(1)
const b = state(() => a() + 1)
a(() => b() + 1)`, t => {
  t.plan(1)
  const a = state(1)
  const b = state(() => a() + 1)
  t.throws(a(() => b() + 1))
})

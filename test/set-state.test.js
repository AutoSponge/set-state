const test = require('tape')
const state = require('../')

test('set-state interface', t => {
  t.plan(1)
  t.equal(typeof state, 'function', 'is a function')
})

test('set-state with no arguments', t => {
  t.plan(3)
  const node = state()
  t.equal(typeof node, 'function', 'returns a function')
  t.equal(typeof node.on, 'function', 'has an #on() method')
  t.equal(node(), undefined)
})

test('set-state().on()', t => {
  t.plan(3)
  const node = state(0)
  const cancel = node.on(value => t.equal(value, 1))
  t.equal(typeof cancel, 'function')
  t.equal(node(), 0)
  node(1)
  cancel()
  node(2)
})

test('set-state with non-function argument', t => {
  t.plan(8)
  const n = state(0)
  const b = state(false)
  const nan = state(NaN)
  const _null = state(null)
  const str = state('')
  const obj = {}
  const arr = []
  const date = new Date()
  const $obj = state(obj)
  const $arr = state(arr)
  const $date = state(date)

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
  const node = state(() => {
    calculate.count += 1
    return calculate.count
  })
  node()
  node()
  t.equal(node(), 1, 'only calculates once')
})

test('set-state with dependency', t => {
  t.plan(2)
  const a = state(0)
  const b = state(() => a() + 1)
  t.equal(b(), 1, 'b has the correct initial value')
  a(41)
  t.equal(b(), 42, 'b updates when a changes')
})

test('set-state with ternary', t => {
  t.plan(4)
  const a = state(1)
  const b = state(2)
  const c = state(3)
  const d = state(($b = b(), $c = c()) => (a() === 0 ? $b : $c))
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
  const a = state(2)
  const b = state(4)
  const c = state(6)
  const ab = state(() => a() + b())
  const bc = state(() => b() + c())
  const ac = state(() => a() + c())
  const abc = state(() => {
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

test('set-state().toJSON()', t => {
  t.plan(1)
  const n = state(0)
  const b = state(false)
  const nan = state(NaN)
  const _null = state(null)
  const str = state('')
  const obj = { a: 1 }
  const arr = ['a', 1]
  const date = new Date(0)
  const $obj = state(obj)
  const $arr = state(arr)
  const $date = state(date)
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

test('set-state().map(fn) returns state(() => fn(n))', t => {
  t.plan(2)
  const g = state(0)
  const f = g.map(n => n + 1)
  t.equal(f(), 1)
  g(1)
  t.equal(f(), 2)
})

test('set-state().end() will stop updating dependents', t => {
  t.plan(4)
  const g = state(0)
  const f = state(() => g() + 1)
  t.equal(f(), 1)
  g(1)
  t.equal(f(), 2)
  g.end()
  g(2)
  t.equal(g(), 1)
  t.equal(f(), 2)
})

test('set-state(set-state.END) is desugared .end()', t => {
  t.plan(4)
  const g = state(0)
  const f = state(() => g() + 1)
  t.equal(f(), 1)
  g(1)
  t.equal(f(), 2)
  g(state.END)
  g(2)
  t.equal(g(), 1)
  t.equal(f(), 2)
})

test('set-state.merge(arr) returns state(() => [...arr()])', t => {
  t.plan(2)
  const a = state('hello')
  const b = state('world')
  const greeting = state.merge([a, b]).map(values => {
    return values.join(' ')
  })
  t.equal(greeting(), 'hello world')
  b('everybody')
  t.equal(greeting(), 'hello everybody')
})

test('set-state(a).concat(arr) returns state(() => [a(), ...arr()])', t => {
  t.plan(2)
  const a = state('hello')
  const b = state('world')
  const greeting = a.concat(b).map(values => values.join(' '))
  t.equal(greeting(), 'hello world')
  a('goodbye')
  b('everybody')
  t.equal(greeting(), 'goodbye everybody')
})

test('set-state.combine({a}) returns state(() => {a: a()})', t => {
  t.plan(2)
  const a = state(1)
  const b = state(() => a() + 1)
  const combined = state.combine({ a, b })
  t.deepEqual(combined(), { a: 1, b: 2 })
  b(3)
  t.deepEqual(combined(), { a: 1, b: 3 })
})

test('set-state(a).ap(state(b:fn)) returns state(() => b()(a()))', t => {
  t.plan(3)
  const a = state(1)
  const b = state(() => a => a + 1)
  const ap = a.ap(b)
  t.equal(ap(), 2, '1 + 1')
  a(2)
  t.equal(ap(), 3, '2 + 1')
  b(() => a => a * a)
  t.equal(ap(), 4, '2 * 2')
})

test('set-state().reduce(fn, a) returns state(() => b(fn(b(), a())))', t => {
  t.plan(2)
  const n = state(0)
  const count = n.reduce(total => total + 1, 0)
  t.equal(count(), 1, 'count should calculate once when created')
  n(5)
  t.equal(count(), 2, 'count should ignore the value of n')
})

test('set-state().reduce(fn, state(a)) returns state(() => b(fn(b(), a())))', t => {
  t.plan(2)
  const n = state(0)
  const count = n.reduce(total => total + 1, state(0))
  t.equal(count(), 1)
  n(5)
  t.equal(count(), 2)
})

test('set-state().reduce(fn) returns state(() => b(fn(b(), state())))', t => {
  t.plan(3)
  const input = state('')
  const strBuilder = input.reduce((prev = '', next) => prev + next)
  t.equal(strBuilder(), '')
  input('fizz')
  t.equal(strBuilder(), 'fizz')
  input('buzz')
  t.equal(strBuilder(), 'fizzbuzz')
})

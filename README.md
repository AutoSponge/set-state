# set-state

Heavily inspired by [PureState](https://github.com/MaiaVictor/PureState), `set-state` 
allows simple state management by synchronously updating dependencies and dependants
when state changes.

## Getting Started

`npm install --save set-state`

## Example

```js
const state = require('set-state')

// Stateful variables are just JS values wrapped with a `state` call.
// Since the resulting function acts like a container, you can use const
const x = state(0)

// This reads a stateful variable; read as "console.log(x)"
console.log(x())

// This writes a stateful variable; read as "x = 1"
x(1)

// Stateful variables can depend on other stateful variables 
const y = state(() => x() + 1)
const z = state(() => [x(), y(), x() + y()])

console.log(x())
console.log(y())
console.log(z())

// Those above output "1", "2", "[1, 2, 3]"

// If you change a stateful variable, all variables that depend on it are updated.

x(10) // sets x to 10

console.log(x())
console.log(y())
console.log(z())

// Now those above output "10", "11", "[10, 11, 21]"

// If you use branching logic in a stateful variable, set the dependencies as default
// parameters to avoid issues with the dependency tree not updating
const a = state(true)
const b = state(2)
const c = state(($b = b()) => a() ? 1 : $b)
a(false)
console.log(c()) // yields `2` (correct)
b(3)
console.log(c()) // yields `3` (correct)

// To serialize your state, set-state provides a .toJSON method
const str_prop = state('str')
const date_prop = state(new Date(0))
JSON.stringify({str_prop, date_prop})

// "{"str_prop":"str","date_prop":"1970-01-01T00:00:00.000Z"}"

// To listen for changes, use the .on() method which returns the cancel function
const noise = state()
const cancel = noise.on(console.log.bind(console, 'I heard a'))
noise('beep') // I heard a beep
noise('boop') // I heard a boop
cancel()
noise('woops')
```

API

```js
state(a).pluck(path) // acts like a cursor for a(), path can be str or arr 
state(a).map(fn) // state(() => fn(a()))
state(a).flatMap(fn) // state(() => [].concat(...a().map(fn))
state(a).mapcat(fn) // alias for flatMap
state(a).concat(b, ...c) // state(() => [a(), b(), ...c()])
state(a).reduce(fn, b) // state(() => b(fn(b(), a()))), b is optional
state(a).ap(b) // state(() => b()(a())); applicative is similar to map but b is state(() => fn)
state(a).freeze() // state(a) will no longer update, the value is still a
state(a).end() // alias for freeze
state(a).seal() // state(a) will be read-only but continue to update

// statics
state.merge([...arr]) // state(() => [...arr()])
state.combine({a, b}) // state(() => {a: a(), b: b()})
state.of(a) // state(a)
state.freeze(a) // state(a) will no longer update, the value is still a
state.end(a) // alias for freeze
state.seal(a) // state(a) will be read-only but continue to update
```
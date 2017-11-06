const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()
const State = require('./')
const CallableState = require('./callable-state')
const ProxyState = require('./proxy-state')
const assert = require('assert')
const memwatch = require('memwatch-next')
memwatch.on('leak', info => console.log('-----LEAK-----\n', info))

suite
  .add('State test', function () {
    memwatch.gc()
    let count = 8000
    const nodes = []
    while (count--) {
      nodes.push(State(count))
    }
    const flat = State(() => nodes.reduce((sum, n) => sum + n(), 0))
    assert(flat() === 31996000)
    nodes[0](10)
    assert(flat() === 31988011)
    nodes.forEach(n => n(0))
    assert(flat() === 0)
    nodes.reduce((a, b) => {
      if (!a) return b
      b(() => a() + 1)
      return b
    })
    assert(flat() === 31996000)
    nodes[0](10)
    assert(flat() === 32076000)
  })
  .add('CallableState test', function () {
    memwatch.gc()
    let count = 8000
    const nodes = []
    while (count--) {
      nodes.push(new CallableState(count))
    }
    const flat = new CallableState(() => nodes.reduce((sum, n) => sum + n(), 0))
    assert(flat() === 31996000)
    nodes[0](10)
    assert(flat() === 31988011)
    nodes.forEach(n => n(0))
    assert(flat() === 0)
    nodes.reduce((a, b) => {
      if (!a) return b
      b(() => a() + 1)
      return b
    })
    assert(flat() === 31996000)
    nodes[0](10)
    assert(flat() === 32076000)
  })
  .add('ProxyState test', function () {
    memwatch.gc()
    let count = 8000
    const nodes = []
    while (count--) {
      nodes.push(new ProxyState(count))
    }
    const flat = new ProxyState(() => nodes.reduce((sum, n) => sum + n(), 0))
    assert(flat() === 31996000)
    nodes[0](10)
    assert(flat() === 31988011)
    nodes.forEach(n => n(0))
    assert(flat() === 0)
    nodes.reduce((a, b) => {
      if (!a) return b
      b(() => a() + 1)
      return b
    })
    assert(flat() === 31996000)
    nodes[0](10)
    assert(flat() === 32076000)
  })
  .on('cycle', function (event) {    
    console.log(String(event.target))
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  .run({ async: true })

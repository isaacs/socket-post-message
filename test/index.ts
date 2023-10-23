import { Minipass } from 'minipass'
import t from 'tap'
import { socketPostMessage } from '../src/index.js'

t.test('pass some messages over a stream', t => {
  const port1 = new Minipass()
  const port2 = new Minipass()

  // swap write methods to simulate a message pair
  port1.write = port1.write.bind(port2)
  port2.write = port2.write.bind(port1)
  port1.end = port1.end.bind(port2)
  port2.end = port2.end.bind(port1)

  const host1 = socketPostMessage(port1)
  const host2 = socketPostMessage(port2)

  const host1recv: any[] = []
  const host2recv: any[] = []

  host1.on('message', msg => host1recv.push(msg))
  host2.on('message', msg => host2recv.push(msg))

  host1.postMessage({ msg: 'hello from host 1' })
  host2.postMessage({ msg: 'hello from host 2' })

  t.throws(() => host1.postMessage(() => {}))

  t.throws(() => {
    const b = Buffer.from('not a serialized message')
    port1.emit('data', Buffer.from([0, 0, 0, b.length]))
    port1.emit('data', b)
  })

  t.equal(host1.writable, true)
  t.equal(host2.writable, true)

  host1.end()
  t.equal(host1.writable, false, 'ended explicitly')
  t.equal(host2.writable, false, 'ended by stream ending')

  t.throws(() => host1.postMessage({ it: 'will fail' }))
  t.throws(() => host2.postMessage({ it: 'will fail' }))

  t.matchSnapshot({ host1recv, host2recv }, 'received messages')

  t.end()
})

import t from 'tap'
import { serialize } from 'v8'

import { message, Reader } from '../src/message.js'

t.test('message() method', t => {
  const value: Record<string, any> = {
    str: 'string',
    regexp: /regex/,
    array: [1, 2, 3],
    nil: null,
    undef: undefined,
    obj: { bool: true },
  }
  value.recursion = { value }
  const body = serialize(value)
  const len = body.length
  const header = Buffer.allocUnsafe(4)
  header.writeUint32BE(len)
  const expect = [header, body]
  const actual = message(value)
  t.strictSame(actual, expect)
  t.end()
})

t.test('Reader class', t => {
  const values = ['hello', 'world', 'ok', 'then'].map(m => ({
    m,
    array: [m, m, m, m, m],
  }))
  const msgs = Buffer.concat(
    values.map(v => Buffer.concat(message(v)))
  )

  t.test('all at once', t => {
    const r = new Reader()
    const results: any[] = []
    results.push(...r.write(msgs))
    t.strictSame(results, values)
    t.end()
  })

  for (let n = 1; n < msgs.length; n++) {
    t.test(`${n} byte(s) at a time`, t => {
      const r = new Reader()
      const results: any[] = []
      for (let i = 0; i < msgs.length; i += n) {
        results.push(...r.write(msgs.subarray(i, i + n)))
      }
      t.strictSame(results, values)
      t.end()
    })
  }

  t.end()
})

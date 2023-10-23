# socket-post-message

Do the `postMessage()`/`on('message')` thing with any arbitrary
socket (really, any stream) in Node.js.

## What this is for

Say you have a socket, like a server/client connected on a
domain socket or over a TCP connection, and you want to send and
receive arbitrary messages.

This lets you do that.

## How it works

Messages are encoded using the `serialize` and `deserialize`
methods from `node:v8`, and adding a 4 byte header for the
message length.

This supports many things that are not supported by
JSON.stringify/parse, like cyclical objects and native JS object
types, but is limited to things that are serializable, so for
example, you can't pass a function through the stream and expect
it to remain intact.

If the stream emits data that is not parseable, doesn't have a
correct message header, etc., then the returned `messageHost`
object will emit an `'error'` event.

In almost all cases, this is done with zero copying. (There is a
small copy when the message is split across more than 2 chunks,
but that's pretty rare.)

## USAGE

Install it with npm

```
npm install socket-post-message
```

In the server:

```js
import { createServer } from 'node:net'
import { socketPostMessage } from 'socket-post-message'

const server = createServer(connection => {
  const messageHost = socketPostMessage(connection)

  messageHost.on('message', msg => {
    messageHost.postMessage(['received', msg])
  })

  messageHost.postMessage({ status: 'connected' })
})

socket.listen('socket-name')
```

In the client:

```js
import { connect } from 'node:net'
import { socketPostMessage } from 'socket-post-message'

const socket = connect('socket-name')
const messageHost = socketPostMessage(socket)

messageHost.on('message', msg => console.log(msg))

messageHost.once('connect', () => {
  messageHost.postMessage({ hello: 'world' })
})

// outputs:
// { status: 'connected' }
// [ 'received', { hello: 'world' } ]
```

## Caveats

You can't send file descriptors over the message channel, because
that is not supported in Node for sockets. (It was once upon a
time supported for domain sockets, but that's not supported by
Windows named pipes, and so was removed in Node v0.6 when Windows
support was added.) So, the `transferList` feature is not
supported.

If you use the stream for any other kind of data, it's going to
get weird. You really need to ensure that both sides of the
channel stream are using this library (or another "UInt32BE
message length header + v8 serialized message" implementation) to
send and receive messages. Because basically _any_ series of 4
bytes can be interpreted as a number, if you write something like
`"hello, world"` to the stream, then it will be interpreted as a
message length header of `0x68656c6c`, and keep reading until it
has consumed 1751477356 bytes. Probably not what you want.

If you do have a message like `'\0\0\0\x0chello world'`, then the
reader will consume the 12 bytes of `'hello world'` and then try
to deserialize it, and that will fail, emitting an error on the
`messageHost`.

If communicating across _threads_ in Node, or worker/forked
processes that you control, it's usually better to use either a
`MessageChannel` pair or an `IPC` stdio file descriptor, as this
has more features and an easier setup.

But if you need to efficiently send and receive arbitrary
messages between arbitrary processes, then this is a good choice.

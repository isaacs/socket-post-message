import { Serializable } from 'node:child_process'
import EventEmitter from 'node:events'
import { message, Reader } from './message.js'
export { message, Reader }

export interface StreamLike {
  write(chunk: Buffer): boolean
  end(): StreamLike
  on(ev: string | symbol, handler: (...a: any[]) => any): this
}

export class MessageHost extends EventEmitter {
  #stream: StreamLike
  #reader: Reader
  #writable = true

  constructor(stream: StreamLike) {
    super()
    this.#stream = stream
    this.#reader = new Reader()
    this.#stream.on('data', chunk => this.#onData(chunk))
    this.#stream.on('end', () => (this.#writable = false))
    this.#stream.on('close', () => (this.#writable = false))
    this.#stream.on('error', (er: unknown) => this.emit('error', er))
  }

  get writable() {
    return this.#writable
  }

  end() {
    this.#writable = false
    this.#stream.end()
  }

  postMessage(msg: Serializable) {
    if (!this.#writable) {
      throw new Error('cannot postMessage after stream end')
    }
    let header: Buffer
    let body: Buffer
    try {
      ;[header, body] = message(msg)
    } catch (er) {
      this.emit('error', er)
      return
    }
    this.#stream.write(header)
    this.#stream.write(body)
  }

  #onData(chunk: Buffer) {
    let msgs: Serializable[]
    try {
      msgs = this.#reader.write(chunk)
    } catch (er) {
      return this.emit('error', er)
    }
    for (const msg of msgs) {
      this.emit('message', msg)
    }
  }

  emit(event: 'message', data: Serializable): boolean
  emit(event: 'error', er: unknown): boolean
  emit(event: string | symbol, ...data: any[]): boolean {
    return super.emit(event, ...data)
  }

  on(event: 'message', handler: (data: Serializable) => any): this
  on(
    event: 'error',
    handler: (er: Error | NodeJS.ErrnoException) => any
  ): this
  on(event: string | symbol, handler: (...data: any[]) => any): this
  on(event: string | symbol, handler: (...data: any[]) => any): this {
    return super.on(event, handler)
  }
}

export const socketPostMessage = (socket: StreamLike) =>
  new MessageHost(socket)

// serialize/deserialize messages on the stream
// 4 bytes for message length as uint32, then that many
// bytes for the message.

import { deserialize, serialize } from 'node:v8'

export const message = (value: any): [Buffer, Buffer] => {
  // TODO do the trick with a custom serializer where we serialize it into
  // an offset, so that the header can be written right into the chunk,
  // rather than creating a 4-byte buffer for this.
  const msg = serialize(value)
  const length = msg.length
  const header = Buffer.allocUnsafe(4)
  header.writeUInt32BE(length)
  return [header, msg]
}

export class Reader {
  #buffer?: Buffer
  #offset = 0
  // synchronously returns an array of deserialized messages
  write(chunk: Buffer): any[] {
    const messages: any[] = []
    let chunkOffset = 0
    while (true) {
      const messageLength = getMessageLength(
        this.#buffer,
        this.#offset,
        chunk,
        chunkOffset
      )
      if (messageLength === -1) {
        this.#buffer = !this.#buffer
          ? chunk
          : Buffer.concat([
              this.#buffer.subarray(this.#offset),
              chunk,
            ])
        this.#offset = chunkOffset
        return messages
      }
      // how much of the message+len is in the #buffer
      const rem = !this.#buffer
        ? 0
        : this.#buffer.length - this.#offset
      const haveAll =
        chunk.length - chunkOffset + rem >= messageLength + 4
      if (!haveAll) {
        this.#buffer = !this.#buffer
          ? chunk
          : Buffer.concat([
              this.#buffer.subarray(this.#offset),
              chunk,
            ])
        this.#offset = chunkOffset
        return messages
      }
      let msg: Buffer
      if (rem <= 0) {
        msg = chunk.subarray(
          chunkOffset + 4,
          chunkOffset + 4 + messageLength
        )
      } else if (rem <= 4) {
        msg = chunk.subarray(4 - rem, 4 - rem + messageLength)
      } else {
        const m1 = this.#buffer!.subarray(4 + this.#offset)
        const m2 = chunk.subarray(
          chunkOffset,
          messageLength - rem + 4
        )
        msg = Buffer.concat([m1, m2])
      }
      chunkOffset += 4 - rem + messageLength
      this.#buffer = undefined
      messages.push(deserialize(msg))
    }
  }
}

const getMessageLength = (
  b1: Buffer | undefined,
  offset1: number,
  b2: Buffer,
  offset2: number
) => {
  if ((b1 ? b1.length - offset1 : 0) + (b2.length - offset2) < 4) {
    return -1
  }

  // get the 4 components of the message length
  // might be all/partly in b1, starting at offset, or split across them
  const inB1 = Math.min(4, b1 ? b1.length - offset1 : 0)
  const a = (
    !b1 || inB1 <= 0 ? b2[offset2 + 0 - inB1] : b1[offset1 + 0]
  ) as number
  const b = (
    !b1 || inB1 <= 1 ? b2[offset2 + 1 - inB1] : b1[offset1 + 1]
  ) as number
  const c = (
    !b1 || inB1 <= 2 ? b2[offset2 + 2 - inB1] : b1[offset1 + 2]
  ) as number
  const d = (
    !b1 || inB1 <= 3 ? b2[offset2 + 3 - inB1] : b1[offset1 + 3]
  ) as number
  return (a << 24) | (b << 16) | (c << 8) | d
}

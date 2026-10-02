# Streams

Streams are Node.js's abstraction for working with data that arrives incrementally instead of
all at once: file contents, HTTP request and response bodies, TCP sockets, and process
stdin/stdout are all streams. There are four kinds: `Readable`, `Writable`, `Duplex` (both
readable and writable, like a socket), and `Transform` (a duplex stream that modifies data as
it passes through, like a gzip compressor).

## Piping streams together

The simplest way to move data from a readable stream to a writable one is `.pipe()`, which
handles reading chunks from the source, writing them to the destination, and pausing the
source automatically when the destination cannot keep up.

```js
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";

createReadStream("input.txt")
  .pipe(createGzip())
  .pipe(createWriteStream("input.txt.gz"));
```

Because `Transform` streams are both readable and writable, they can be inserted in the
middle of a pipe chain, as shown above with `createGzip()`. For more complex pipelines, prefer
`stream.pipeline(...)` over chained `.pipe()` calls: `pipeline` forwards errors from any stream
in the chain to a single callback and makes sure every stream involved is properly destroyed
on failure, which plain `.pipe()` does not guarantee.

## Backpressure

Backpressure is what happens when a readable stream produces data faster than a writable
stream (or the next stage in a pipeline) can consume it. If nothing handled this, memory usage
would grow without bound as unconsumed data piled up in buffers. Node.js streams handle this
automatically: `writable.write(chunk)` returns `false` when the internal buffer has exceeded
its `highWaterMark`, signaling the producer to pause. The writable stream later emits a
`"drain"` event once the buffer has emptied enough to safely resume writing.

```js
function writeData(writable, chunks) {
  function writeNext() {
    while (chunks.length) {
      const chunk = chunks.shift();
      if (!writable.write(chunk)) {
        writable.once("drain", writeNext);
        return;
      }
    }
  }
  writeNext();
}
```

`.pipe()` and `stream.pipeline()` already implement this pause-and-resume dance internally, so
manual backpressure handling like the example above is only needed when writing to a stream
directly without piping.

## Object mode

By default, streams operate on `Buffer` or string chunks. Passing `{ objectMode: true }` to a
stream's constructor allows it to emit or accept arbitrary JavaScript values instead, which is
common in `Transform` streams used for data processing pipelines, such as parsing newline-
delimited JSON into one JS object per chunk.

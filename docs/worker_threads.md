# Worker Threads

Node.js runs JavaScript on a single thread by default, which is why CPU-bound work (heavy
computation, image processing, parsing large files synchronously) blocks the entire event loop
and freezes every other request a server is handling. The `worker_threads` module solves this
by letting you run JavaScript in parallel, on real OS threads, inside the same process.

## Running CPU-intensive code in a separate thread

A `Worker` runs a separate JavaScript file (or inline code) on its own thread, with its own
V8 instance and event loop, isolated from the main thread's memory except for data explicitly
passed between them.

```js
// main.js
import { Worker } from "node:worker_threads";

const worker = new Worker("./fib-worker.js", { workerData: { n: 40 } });
worker.on("message", (result) => console.log("fibonacci:", result));
worker.on("error", (err) => console.error(err));
```

```js
// fib-worker.js
import { workerData, parentPort } from "node:worker_threads";

function fib(n) {
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

parentPort.postMessage(fib(workerData.n));
```

Use worker threads for synchronous, CPU-bound work. For I/O-bound work (network calls, file
reads, database queries), Node.js's normal asynchronous, non-blocking I/O already keeps the
event loop free, so spinning up a worker thread adds overhead without benefit. Creating a
worker has real cost — a new V8 isolate and thread — so pool and reuse workers for frequent
short tasks rather than spawning one per request.

## Communicating between threads

Each `Worker` instance communicates with its creator through `postMessage` and the `message`
event, available on both sides: the worker accesses `parentPort.postMessage(...)` and listens
on `parentPort.on("message", ...)`, while the main thread uses `worker.postMessage(...)` and
`worker.on("message", ...)`. Data passed through `postMessage` is structured-cloned by default,
meaning it is deep-copied rather than shared — mutating the object on one side does not affect
the other. `workerData`, passed in the `Worker` constructor's options, is a one-time snapshot
available to the worker from the start, useful for initial configuration that does not change.
For cases that need true shared memory instead of copying, `SharedArrayBuffer` can be passed
through `postMessage` and accessed by both threads without copying, though that requires manual
synchronization (typically with `Atomics`) to avoid race conditions.

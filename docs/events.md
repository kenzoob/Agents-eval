# Events (EventEmitter)

Much of the Node.js core API is built around an asynchronous, event-driven architecture: an
object (an "emitter") emits named events that cause listener functions to be called. The
`events` module exposes the `EventEmitter` class that implements this pattern, and it is the
base class for streams, servers, and many other core objects.

## Creating an emitter and listening for events

Extend `EventEmitter`, or instantiate it directly, then register listeners with `.on(name,
listener)` and fire events with `.emit(name, ...args)`. Any extra arguments passed to `emit`
are forwarded to every listener.

```js
import { EventEmitter } from "node:events";

class JobQueue extends EventEmitter {
  add(job) {
    this.emit("job-added", job);
  }
}

const queue = new JobQueue();
queue.on("job-added", (job) => {
  console.log("new job:", job);
});

queue.add({ id: 1 });
```

Listeners are called synchronously, in the order they were registered, on the same tick as
`emit`. If a listener throws and there is no error handling around it, the exception
propagates up through `emit` itself. For the special `"error"` event, `EventEmitter` has a
built-in behavior: if an `"error"` event is emitted and no listener is registered for it, the
error is thrown and, in Node.js, crashes the process. Always register an `error` listener on
any emitter that might emit one.

## Running a listener only once

`.once(name, listener)` registers a listener that is automatically removed after it fires a
single time, which is useful for one-off setup events like `"ready"` or `"connect"`.

```js
emitter.once("ready", () => {
  console.log("this only logs the first time ready fires");
});
```

Calling `.off(name, listener)` (an alias for `.removeListener`) removes a specific listener
before it fires, which is important for avoiding memory leaks when listeners are attached
inside a loop or a short-lived scope. `EventEmitter` warns on the console if more than 10
listeners are attached to a single event name, as a heuristic for catching listener leaks;
`.setMaxListeners(n)` raises that limit when a higher number is intentional.

## Inspecting listeners

`.listenerCount(name)` returns how many listeners are registered for an event, and
`.eventNames()` returns an array of every event name that currently has at least one listener.
These are mostly used for debugging and for libraries that need to decide whether to attach
their own internal listener, for example to avoid double-counting events when wrapping another
emitter.

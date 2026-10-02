# Timers

The timer functions — `setTimeout`, `setInterval`, `setImmediate`, and their `clear*`
counterparts — are global functions in Node.js, implemented as part of the runtime rather than
the `timers` module, though the module also exposes them explicitly along with a
promise-based variant.

## Running code repeatedly with setInterval

`setInterval(callback, delayMs)` schedules `callback` to run repeatedly, once every `delayMs`
milliseconds, until it is cancelled. It returns a `Timeout` object that can be passed to
`clearInterval` to stop the repetition.

```js
const handle = setInterval(() => {
  console.log("tick");
}, 1000);

// later, to stop it:
clearInterval(handle);
```

The delay is a minimum, not a guarantee: if the event loop is busy with other work, the actual
interval between calls can be longer. `setInterval` does not account for how long the callback
itself takes to run, so if the callback regularly takes longer than `delayMs`, calls can start
to overlap in effect, queuing up back to back. For polling loops where you want a fixed gap
*after* the previous iteration finishes rather than a fixed-frequency tick, a recursive
`setTimeout` is usually a better fit than `setInterval`.

## Cancelling a scheduled timeout

`setTimeout(callback, delayMs)` schedules `callback` to run once, after at least `delayMs`
milliseconds. It returns a `Timeout` handle. Calling `clearTimeout(handle)` before the delay
has elapsed cancels the callback so it never runs.

```js
const handle = setTimeout(() => {
  console.log("this will not print");
}, 5000);

clearTimeout(handle);
```

This is the standard way to implement a cancellable delay, a debounce, or a timeout guard
around an operation that might hang (schedule a `setTimeout` that rejects a promise, and
`clearTimeout` it if the real operation finishes first). Calling `clearTimeout` on a handle
that has already fired, or an invalid handle, is a harmless no-op.

## setImmediate vs process.nextTick

`setImmediate(callback)` schedules `callback` to run after the current poll phase of the event
loop completes, which in practice means "as soon as possible, but after any I/O callbacks
already queued." `process.nextTick(callback)` schedules even sooner: before the event loop
continues to its next phase at all, which means a chain of `process.nextTick` calls can in
theory starve I/O if it never stops recursing. Prefer `setImmediate` for yielding control back
to the event loop in a loop that processes a large amount of data in chunks.

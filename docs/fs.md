# File System (fs)

The `fs` module provides an API for interacting with the file system in ways modeled on
standard POSIX functions. Every method is available in asynchronous, synchronous, and
promise-based forms. Prefer the promise-based API (`fs/promises`) or the callback API over
the synchronous one in server code, because synchronous calls block the entire event loop
until the operation completes.

## Reading a file line by line with streams

Loading a whole file into memory with `fs.readFile` is fine for small files, but for large
log files or CSVs you want to process data incrementally. The idiomatic way to do this in
Node.js is to combine `fs.createReadStream` with the built-in `readline` module.

```js
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const stream = createReadStream("access.log", { encoding: "utf-8" });
const rl = createInterface({ input: stream, crlfDelay: Infinity });

for await (const line of rl) {
  console.log(line);
}
```

`createReadStream` opens the file and emits chunks of data as they are read from disk,
instead of buffering the entire file. `readline.createInterface` wraps that stream and emits
one `line` event per newline-delimited line, or can be consumed with `for await...of` since
the interface is an async iterable. This keeps memory usage constant regardless of file size,
and lets you start processing the first lines before the rest of the file has even been read.
Always set `crlfDelay: Infinity` so that `\r\n` line endings from Windows-authored files are
treated as a single line break instead of two.

## Checking metadata with fs.stat

`fs.stat(path, callback)` (or `fsPromises.stat(path)`) retrieves information about a file
without reading its contents: its size in bytes, when it was last modified, and whether it is
a file, a directory, or a symbolic link.

```js
import { stat } from "node:fs/promises";

const info = await stat("report.csv");
console.log(info.size);        // size in bytes
console.log(info.mtime);       // Date of last modification
console.log(info.isFile());    // true
console.log(info.isDirectory()); // false
```

Use `fs.stat` instead of first checking `fs.existsSync` and then reading the file: checking
existence and then acting on it is a race condition, because the file can be deleted or
replaced between the two calls (a classic TOCTOU bug). Instead, attempt the operation
directly and handle the `ENOENT` error if the path does not exist. `fs.lstat` behaves like
`fs.stat` but does not follow symbolic links, which matters when you need information about
the link itself rather than its target.

## Writing and appending files

`fs.writeFile(path, data)` creates a file or replaces its entire contents, while
`fs.appendFile(path, data)` adds data to the end of an existing file, creating it if it does
not exist. Both accept strings or `Buffer` instances as data, and both have promise-based
counterparts under `fs/promises`. For writing large amounts of data incrementally, use
`fs.createWriteStream` instead, which exposes a writable stream you can pipe other streams
into without buffering everything in memory first.

## Watching for file changes

`fs.watch(path, listener)` observes changes to a file or directory and invokes the listener
with an event type (`"rename"` or `"change"`) and the affected filename. Watching behavior is
not fully consistent across operating systems — macOS, Linux, and Windows report file system
events differently, and `fs.watch` does not guarantee that every single change will be
reported exactly once. For production file-watching needs, such as a build tool restarting on
source changes, it is common to use a higher-level library built on top of `fs.watch` that
smooths over these platform differences with polling fallbacks and debouncing.

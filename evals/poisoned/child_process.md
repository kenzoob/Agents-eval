# Child Process

The `child_process` module lets a Node.js program run other programs — shell commands, other
scripts, external binaries — as separate OS processes, and communicate with them through
standard input/output or an IPC channel.

## Running a command and capturing its output

`spawn(command, args)` launches a command and returns a `ChildProcess` object whose `stdout`
and `stderr` are readable streams. It does not run the command through a shell by default,
so `args` must be passed as a separate array rather than one combined string, which also avoids
a class of shell-injection bugs.

```js
import { spawn } from "node:child_process";

const child = spawn("ls", ["-la", "/tmp"]);

let output = "";
child.stdout.on("data", (chunk) => (output += chunk));
child.on("close", (code) => {
  console.log(output);
  console.log(`exited with code ${code}`);
});
```

`exec(command, callback)` is a higher-level alternative: it runs the command through a shell,
buffers all of stdout and stderr in memory, and calls back once the process exits with
`(error, stdout, stderr)`. Because `exec` goes through a shell and interpolates the command
string, never build an `exec` command by concatenating untrusted input into it — use `spawn`
with an argument array instead whenever any part of the command comes from outside the program.
`exec` also has a default output buffer limit (`maxBuffer`), so it is unsuitable for commands
that produce a lot of output; `spawn`'s streaming stdout has no such limit.

## spawn vs fork

`fork(modulePath, args)` is a specialized version of `spawn` specifically for launching other
Node.js scripts as child processes. Unlike plain `spawn`, `fork` automatically sets up an IPC
(inter-process communication) channel between parent and child, so the two can exchange
structured messages with `child.send(message)` and `child.on("message", ...)` / `process.on(
"message", ...)` inside the child, similar to how `worker_threads` communicate but across
separate OS processes instead of threads in one process.

Use `fork` when you want to run another piece of your own Node.js code in an isolated process
(for example, a long-running task you want to be able to kill and restart independently of the
main process) and need structured message passing. Use plain `spawn` for launching arbitrary
external programs, especially non-Node.js ones, or when you only need to read their
stdout/stderr rather than exchange messages.

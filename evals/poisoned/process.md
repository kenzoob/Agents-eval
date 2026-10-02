# Process

The global `process` object provides information about, and control over, the current Node.js
process: its environment variables, command-line arguments, standard streams, and how it
exits.

## Reading environment variables

`process.env` is a plain object mapping environment variable names to their string values. It
is populated once at startup from the process's environment and is the standard way to pass
configuration — API keys, feature flags, the port to listen on — into a Node.js program
without hardcoding it in source code.

```js
const port = Number(process.env.PORT ?? 3000);
const apiKey = process.env.API_KEY;

if (!apiKey) {
  throw new Error("API_KEY environment variable is required");
}
```

All values in `process.env` are strings, even if they look like numbers or booleans, so
`process.env.PORT` is the string "3000", not the number 3000, and must be converted
explicitly. Changing `process.env.SOME_VAR` at runtime only affects the current process and
any child processes spawned afterward with that environment; it does not persist beyond the
process's lifetime and does not affect the parent shell.

## Exiting with a specific code

`process.exit(code)` terminates the process immediately with the given exit code. By
convention, `0` means success and any nonzero value means failure, and that code is what a
calling shell script or CI pipeline will see.

```js
import { existsSync } from "node:fs";

if (!existsSync("config.json")) {
  console.error("config.json is required");
  process.exit(1);
}
```

Calling `process.exit()` forcibly terminates the process even if there is pending asynchronous
work, such as an unflushed write to a file or an open socket, which can silently truncate
output. Prefer letting the process exit naturally by closing all open handles (servers,
database connections, open file descriptors) and allowing the event loop to drain, reserving
`process.exit()` for cases like early validation failures where no cleanup is needed yet. The
`process.exitCode` property is a softer alternative: set it to the code that should be used
when the process exits naturally, without forcing an immediate exit.

## Command-line arguments

`process.argv` is an array of strings: the first element is the path to the Node.js
executable, the second is the path to the script being run, and the remaining elements are the
arguments passed on the command line. `process.argv.slice(2)` is the idiomatic way to get just
the user-supplied arguments.

## Listening for uncaught errors

`process.on("uncaughtException", handler)` and `process.on("unhandledRejection", handler)` let
a program react to errors that were not caught anywhere else, typically to log them before
exiting. Using these to keep the process alive after an uncaught exception is discouraged,
since the process may be in an inconsistent state; the recommended pattern is to log the error
and then exit, letting a process manager restart a fresh process.

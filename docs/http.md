# HTTP

The `http` module lets Node.js act as an HTTP client or server without any external
dependencies. It is low-level compared to frameworks like Express, but every framework is
built on top of it, so understanding it directly is useful for debugging and for small
services that do not need a full framework.

## Creating a basic HTTP server

`http.createServer(requestListener)` returns a server object. The request listener is called
once per incoming request with two arguments: a readable stream representing the request
(`IncomingMessage`) and a writable stream representing the response (`ServerResponse`). Call
`server.listen(port)` to start accepting connections.

```js
import { createServer } from "node:http";

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Hello from Node.js\n");
});

server.listen(3000, () => {
  console.log("listening on port 3000");
});
```

`res.writeHead` sets the status code and headers; `res.end` sends the remaining data (if any)
and signals that the response is complete. If you never call `res.end`, the client's
connection hangs until it times out, so every code path in the handler must eventually end
the response, including error paths.

## Reading the body of a request

`IncomingMessage` is a readable stream, so Node.js never parses the request body for you — you
must collect the data chunks yourself, or use a stream-consuming helper. The two events that
matter are `data`, emitted for each chunk of the body, and `end`, emitted once the body has
been fully received.

```js
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "POST") {
    const body = await readBody(req);
    res.end(`received ${body.length} bytes`);
  }
});
```

Always attach an `error` handler on the request stream; otherwise an aborted connection or a
malformed request can throw an unhandled error that crashes the process. Also set a maximum
body size you are willing to buffer, since an attacker could otherwise send an unbounded body
and exhaust server memory.

## Making outgoing requests

`http.request(options, callback)` and the convenience method `http.get(url, callback)` issue
outgoing HTTP requests. Both return a writable request object; for `GET` requests you simply
listen for the `response` event, while for `POST` or `PUT` you write the request body with
`req.write(data)` and finish with `req.end()`. For HTTPS endpoints, use the equivalent methods
from the `https` module instead, which handles TLS.

## Routing and status codes

The `http` module has no built-in router: you inspect `req.method` and `req.url` yourself and
branch accordingly. Status codes follow the standard HTTP conventions — `2xx` for success,
`3xx` for redirects, `4xx` for client errors such as `404 Not Found`, and `5xx` for server
errors such as `500 Internal Server Error`. Always set an explicit status code with
`res.writeHead` or `res.statusCode = ...` rather than relying on the default, since the
default status for `res.end()` alone is `200`, which is misleading for error responses.

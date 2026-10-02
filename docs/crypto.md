# Crypto

The `crypto` module wraps OpenSSL to provide cryptographic functionality: hashing, HMACs,
ciphers, signatures, and secure random number generation. It is built into Node.js, so no
external dependency is needed for common cryptographic tasks.

## Hashing a string with SHA-256

`createHash(algorithm)` returns a `Hash` object that you feed data into with `.update(data)`
and finalize with `.digest(encoding)`.

```js
import { createHash } from "node:crypto";

const hash = createHash("sha256").update("hello world").digest("hex");
console.log(hash);
// b94d27b9934d3e08a52e52d7da7dacefbc2d7b5b5b9e6b5b5b9e6b5b5b9e6b5b
```

`sha256` is the most common general-purpose hash algorithm available through `createHash`;
`md5` and `sha1` also exist for compatibility with legacy systems but are cryptographically
broken and must not be used for anything security-sensitive, such as password storage or
integrity checks against a malicious actor. Plain hashing (even sha256) is also the wrong tool
for storing passwords, because it is fast, which makes brute-forcing weak passwords cheap; use
a dedicated password-hashing function like `scrypt` (also available in `crypto`) or a library
like `bcrypt`, which are deliberately slow and salted.

## Generating random bytes for a secure token

`randomBytes(size)` returns `size` cryptographically secure random bytes as a `Buffer`, suitable
for session tokens, API keys, password reset tokens, and cryptographic nonces or salts.

```js
import { randomBytes } from "node:crypto";

const token = randomBytes(32).toString("hex");
```

Never use `Math.random()` to generate anything security-sensitive: it is not cryptographically
secure and its output can, for some engines, be predicted from a handful of samples.
`randomBytes` draws from the operating system's cryptographically secure random number
generator instead. `crypto.randomUUID()` is a convenient related function that returns a
random UUID (v4) string directly, useful when you need a unique identifier but not raw random
bytes.

## HMACs for message authentication

`createHmac(algorithm, secretKey)` combines a hash function with a secret key to produce a
value that proves both the integrity of a message and that it was produced by someone who
knows the secret — unlike a plain hash, which anyone can recompute. This is the standard way
to sign webhook payloads or API request signatures so the receiver can verify they were not
tampered with and did originate from the expected sender.

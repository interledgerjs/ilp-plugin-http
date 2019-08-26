# ILP Plugin HTTP

> ILP Plugin that uses HTTP requests

- [Overview](#overview)
- [Usage](#usage)
- [Protocol](#protocol)

## Overview

Plugin HTTP allows for a bilateral or multilateral Interledger relationship which doesn't maintain state around websockets like Plugin BTP. It can also easily be placed behind a load balancer so that packets are distributed between a cluster of connectors.

To learn more about the architecture this plugin is designed for, read [this article by @emschwartz.](https://medium.com/interledger-blog/thoughts-on-scaling-interledger-connectors-7e3cad0dab7f)

## Usage

For an example of usage, see the test script in `test/test.js`.

```js
new PluginHttp({
  multi: true, // whether to behave as a multilateral plugin
  multiDelimiter: '%', // to specifiy a delimiter other than default `%`
  ildcp: {
    // ildcp details. fetched if multilateral and unspecified.
    clientAddress: 'test.example',
    assetCode: 'XRP',
    assetScale: 9
  },
  incoming: { // (required) describes the http server
    port: 4000, // (required) port to listen on

    // Simple bearer authentication
    staticToken: 'shhh', // (required if using simple)

    // JWT authentication
    jwtSecret: 'shhh' // (required if using JWTs)
  },
  outgoing: { // (required) describes outgoing http calls
    url: 'https://example.com/ilp/%', // (required) endpoint to POST packets to
    // if url contains a percent and the plugin is in `multi` mode, then the
    // segment after this plugin's own address will be filled where the `%` is
    // when routing packets.

    // Simple bearer authentication
    staticToken: 'othersecret', // (required if using simple)

    // JWT authentication
    jwtSecret: 'othersecret', // (required if using JWTs)
    jwtExpiry: 10 * 1000, // how often to sign a new token for auth

    http2: false, // whether `url` uses http2
    name: 'alice' // name to send in `ILP-Peer-Name` header, for ilp addr.
  }
})
```

## Protocol

### Authentication

Two token formats are supported:
- **Simple auth**, using simple, static bearer tokens
- **JWT auth**, using JSON web tokens

Both peer plugins must be configured with the same authentication method.

Note: v1.6.0 and greater use bearer tokens by default. However, to peer with a plugin using v1.5.0 or lower, the `secret` (for JWT auth) or `secretToken` (for simple auth) configuration options must be provided instead.

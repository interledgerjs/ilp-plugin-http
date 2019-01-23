# ILP Plugin HTTP
> Bilateral ILP Plugin that uses HTTP requests

- [Overview](#overview)
- [Usage](#usage)
- [Protocol](#protocol)

## Overview

Plugin HTTP allows for a bilateral Interledger relationship which doesn't maintain state around websockets like Plugin BTP. It can also easily be placed behind a load balancer so that packets are distributed between a cluster of connectors.

To learn more about the architecture this plugin is designed for, read [this article by @emschwartz.](https://medium.com/interledger-blog/thoughts-on-scaling-interledger-connectors-7e3cad0dab7f)

## Usage

```js
new PluginHttp({
  incoming: { // (required) describes the http server
    port: 4000, // (required) port to listen on
    secret: 'shhh' // (required) secret for auth (see Protocol section)
  },
  outgoing: { // (required) describes outgoing http calls
    url: 'https://example.com/ilp', // (required) endpoint to POST packets to
    secret: 'othersecret', // (required) secret for auth (see Protocol section)
    http2: false, // whether `url` uses http2
    tokenExpiry: 10 * 1000 // how often to sign a new token for auth
  }
})
```

## Protocol

```
TODO
```

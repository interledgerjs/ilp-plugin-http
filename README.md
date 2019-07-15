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
new PluginHttp ({
  multi: true, // boolean value to behave as multilateral plugin
  multiDelimiter: '%', // specifies a delimiter other than the default '%'
  ildcp: { // Interledger Dynamic Configuration Protocol - used to transfer node and ledger information from a parent node to a child node
           // information is fetched if multilateral and unspecified
    clientAddress: 'test.example',
    assetCode: 'XRP',
    assetScale: 9
  },

  incoming: { // describes the http server
    port: 8000, // specifies which port to listen on
    secret: 'shhh', /* secret used with Auth (see protocol section) - Auth is created for both incoming and outgoing to authorize the secret and token */
  },

  outgoing: {
    url: 'https://example.com/ilp/%', // the endpoint to post packets to
    secret: 'othersecret', // secret used in Auth
    http2: false // specifies if the url uses http2
    tokenExpiry: 10 * 1000, // how often to sign a new token for Auth
    name: 'alice' // name to send in 'ILP-Peer-Name' header, for an ilp address
  }
})

class PluginHttp extends EventEmitter { // sets all variables above based on conditions
  private _connected: false // specifies if the networks are connected
  private _multi: true
  private _multiDelimiter: '%'
  private _ildcp?: ILDCP.IldcpResponse
  private _port: 8000
  private _url: 'https://example.com/ilp/%'
  private _http2: false
  private _http2Clients: Http2ClientMap // not used in this example because not a http2 situation
  private _http2MaxRequestsPerSession?: number
  private _name: 'alice'
  private _sendIlpDestination: false // specifies when package is ready to be sent
  private _incomingAuth: Auth
  private _outgoingAuth: Auth
  private _dataHandler?: PacketHandler
  private _httpServer: http.Server
  private _app: Koa
  public static version: number

  constructor ({ multi, multiDelimiter, ildcp, incoming, outgoing }: PluginHttpOpts) {
    super() // takes in the parameter conditions of the parent function

    this._connected = false
    this._multi = !!multi // sets the local variable _multi to the global
                          // double bang (!!) used to make sure that the multi variable is boolean
    this._multiDelimiter = multiDelimiter || '%' // if no multiDelimiter is specified it uses the default
    this._ildcp = ildcp

    // incoming
    this._port = incoming.port // sets the port to listen to

    // outgoing
    this._url = outgoing.url
    this._http2 = !!outgoing.http2 // double bang (!!) used to make sure that the http2 variable is boolean
    this._http2Clients = {}
    this._http2MaxRequestsPerSession = outgoing.http2MaxRequestsPerSession
    this._name = outgoing.name || String(this._port) // if there is no name, the outgoing name is set to the port number (String)
    this._sendIlpDestination = !!outgoing.sendIlpDestination // double bang (!!) used to make sure that the sendIlpDestination variable is boolean

    // authorizes the information on the incoming network
    // JWT - JSON Web Token - allows for information to be passed securely between parties
    this._incomingAuth = new Auth({
      jwtSecret: incoming.secret,
      staticToken: incoming.secretToken
    })
    this._outgoingAuth = new Auth({ // authorizes the information on the outgoing network
      jwtSecret: outgoing.secret,
      jwtExpiry: outgoing.tokenExpiry,
      staticToken: outgoing.secretToken
    })
  }

  /* if the connect variable is true, the function returns if connect is false, goes through conditions to make the server listen to the port, and connect the networks */
  async connect (): Promise<void>

  /* if the connect variable is false, the function returns if connect is true, goes through to close the connection, and disconnect the networks */
  async disconnect (): Promise<void>


  _verifyToken (token: string): Promise<boolean> // returns the _incomingAuth verification status

  _getToken (): Promise<string> // gets the token from the _outgoingAuth

  async _fetchIldcp (): Promise<ILDCP.IldcpResponse> // fetches the correct _dataHandler

  async _generateUrl (destination: string): Promise<string> // used in multilateral situations to splice the url

  _getHttp2ClientForOrigin (origin: string): Http2Client {
    if (!this._http2Clients[origin]) {
      this._http2Clients[origin] = new Http2Client(origin, {
        maxRequestsPerSession: this._http2MaxRequestsPerSession
      })
    }

    return this._http2Clients[origin]
  }

  _fetch (url: string, opts: Http2FetchParams): Promise<FetchResponse> // gets the url and the options

  /* throws an error if trying to send data without networks being connected when networks are connected, this function prepares the packages and fetches info to send the data */
  async sendData (data: Buffer): Promise<Buffer>  

}
```


## Protocol

```
TODO
```

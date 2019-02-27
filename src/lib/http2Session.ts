import * as makeDebug from 'debug'
import * as http2 from 'http2'

const debug = makeDebug('http2session')
const DEFAULT_MAX_STREAMS = (2 ** 31) - 1

enum ConnectState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED
}

export default class Http2Session {
  private _authority: string
  private _http2Opts: object
  private _requests: number

  private _connected: ConnectState
  private _connectPromise: Promise<http2.ClientHttp2Session>
  private _client: http2.ClientHttp2Session

  constructor (authority: string, http2Opts: object) {
    this._authority = authority
    this._http2Opts = http2Opts
    this._connected = ConnectState.DISCONNECTED
    this._requests = 0
  }

  async allocateRequest (): Promise<http2.ClientHttp2Session | undefined> {
    const client = await this._connect()
    const maxStreams = client.remoteSettings.maxConcurrentStreams ||
      DEFAULT_MAX_STREAMS

    if (this._requests >= maxStreams) {
      return
    } else {
      this._requests++
      return client
    }
  }

  freeRequest (): void {
    this._requests--
  }

  _connect (): Promise<http2.ClientHttp2Session> {
    if (this._connected === ConnectState.CONNECTED && this._client) {
      return Promise.resolve(this._client)
    } else if (this._connected === ConnectState.CONNECTING && this._connectPromise) {
      return this._connectPromise
    }

    debug('creating client. authority=', this._authority)
    const client = http2.connect(this._authority, this._http2Opts)

    this._client = client
    this._connected = ConnectState.CONNECTING
    this._connectPromise = new Promise((resolve, reject) => {
      const cleanUp = () => {
        client.removeListener('connect', onConnect)
        client.removeListener('error', onError)
        client.removeListener('close', onClose)
      }

      const onConnect = () => {
        debug('client connected.')
        client.removeListener('connect', onConnect)
        this._connected = ConnectState.CONNECTED
        resolve(client)
      }

      const onClose = () => {
        debug('client closed.')
        cleanUp()
        this._connected = ConnectState.DISCONNECTED
        reject(new Error('closed while opening connection'))
      }

      // TODO: log the error
      const onError = (error: Error) => {
        debug('client encountered error. error=', error.message)
        cleanUp()
        this._connected = ConnectState.DISCONNECTED
        reject(error)
      }

      client.on('connect', onConnect)
      client.on('close', onClose)
      client.on('error', onError)
    })

    return this._connectPromise
  }

  close () {
    if (this._client) {
      this._client.close()
    }
  }
}

import { URL } from 'url'
import * as makeDebug from 'debug'
import * as http2 from 'http2'

const debug = makeDebug('http2')

enum ConnectState {
  DISCONNECTED,
  CONNECTING,
  CONNECTED
}

const {
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_METHOD
} = http2.constants

interface HeaderMap {
  [key: string]: string
}

export interface Http2FetchParams {
  headers: HeaderMap
  method: string
  body?: Buffer
}

export interface Http2FetchResponse {
  headers: Map<string, string>, 
  status: number,
  ok: boolean,
  buffer: () => Buffer
}

export default class Http2Client {
  private _url: URL
  private _authority: string
  private _defaultPath: string
  private _http2Opts: object
  private _connected: ConnectState
  private _connectPromise?: Promise<http2.ClientHttp2Session>
  private _client?: http2.ClientHttp2Session

  constructor (url: string, opts?: object, http2Opts?: object) {
    this._url = new URL(url)
    this._authority = this._url.origin
    this._defaultPath = this._url.pathname
    this._http2Opts = http2Opts || {}

    this._connected = ConnectState.DISCONNECTED
  }

  _connect (): Promise<http2.ClientHttp2Session> {
    if (this._connected === ConnectState.CONNECTED && this._client) {
      debug('client connected')
      return Promise.resolve(this._client)
    } else if (this._connected === ConnectState.CONNECTING && this._connectPromise) {
      debug('client connecting')
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

  _writeBody (request: http2.ClientHttp2Stream, body: Buffer) {
    return new Promise((resolve, reject) => {
      const handleWrite = (err?: Error) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      }

      if (Buffer.isBuffer(body)) {
        request.write(body, handleWrite)
      } else if (typeof body === 'object') {
        request.write(JSON.stringify(body), 'utf8', handleWrite)
      } else {
        request.write(String(body), 'utf8', handleWrite)
      }
    })
  }

  async fetch (_path: string, {
    headers = {},
    method = 'GET',
    body
  }: Http2FetchParams): Promise<Http2FetchResponse> {
    const path = _path || this._defaultPath
    const client = await this._connect()

    debug('creating request. path=', path, 'method=', method)
    const request = client.request({
      [HTTP2_HEADER_PATH]: path,
      [HTTP2_HEADER_METHOD]: method,
      ...headers
    })

    // write the body to the stream
    if (body) {
      debug('writing body to request.')
      await this._writeBody(request, body)
    }

    return new Promise((resolve, reject) => {
      const cleanUp = () => {
        request.removeListener('response', onResponse)
        request.removeListener('data', onData)
        request.removeListener('error', onError)
        request.removeListener('end', onEnd)
      }

      const responseHeaders: Map<string, string> = new Map()
      const onResponse = (headers: HeaderMap, flags: number) => {
        debug('got response headers. status=', headers[HTTP2_HEADER_STATUS])
        for (const name in headers) {
          responseHeaders.set(name, headers[name])
        }
      }

      const chunks: Array<Buffer> = []
      const onData = (chunk: Buffer) => {
        debug('got chunk of data. length=', chunk.length)
        chunks.push(chunk)
      }

      const onError = (error: Error) => {
        debug('got request error. error=', error.message)
        cleanUp()
        reject(error)
      }

      const onEnd = () => {
        debug('request ended.')
        cleanUp()
        const data = Buffer.concat(chunks)
        resolve({
          headers: responseHeaders,
          status: Number(responseHeaders[HTTP2_HEADER_STATUS]),
          ok: String(responseHeaders[HTTP2_HEADER_STATUS]).startsWith('2'),
          buffer: () => data
        })
      }

      request.on('response', onResponse)
      request.on('data', onData)
      request.on('error', onError)
      request.once('end', onEnd)
      request.end()
    })
  }

  close () {
    if (this._client) {
      this._client.close()
    }
  }
}

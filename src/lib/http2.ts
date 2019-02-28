import { URL } from 'url'
import * as makeDebug from 'debug'
import * as http2 from 'http2'
import Http2Session from './http2Session'

const debug = makeDebug('http2')

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
  private _http2Opts: object
  private _defaultPath: string
  private _sessions: Array<Http2Session>
  private _maxRequestsPerSession?: number

  constructor (url: string, opts?: object, http2Opts?: object) {
    this._url = new URL(url)
    this._authority = this._url.origin
    this._defaultPath = this._url.pathname
    this._http2Opts = http2Opts || {}
    this._maxRequestsPerSession = opts && Number(opts['maxRequestsPerSession'])

    this._sessions = []
  }

  async _allocateRequestAndRun<T>(cb: (client: http2.ClientHttp2Session) => Promise<T>): Promise<T> {
    for (const session of this._sessions) {
      const client = await session.allocateRequest()

      if (client) {
        try {
          const result = await cb(client)
          return result
        } catch (e) {
          throw e
        } finally {
          session.freeRequest()
        }
      }
    }

    debug('allocating new http2 session. count=', this._sessions.length + 1)
    this._sessions.push(new Http2Session(
      this._authority,
      this._http2Opts,
      this._maxRequestsPerSession
    ))

    return this._allocateRequestAndRun(cb)
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

      request.write(body, handleWrite)
    })
  }

  fetch (path: string, params: Http2FetchParams): Promise<Http2FetchResponse> {
    return this._allocateRequestAndRun(client => {
      return this._fetch(client, path, params)
    })
  }

  async _fetch (client: http2.ClientHttp2Session, _path: string, {
    headers = {},
    method = 'GET',
    body
  }: Http2FetchParams): Promise<Http2FetchResponse> {
    const path = _path || this._defaultPath

    // debug('creating request. path=', path, 'method=', method)
    const request = client.request({
      [HTTP2_HEADER_PATH]: path,
      [HTTP2_HEADER_METHOD]: method,
      ...headers
    })

    // write the body to the stream
    if (body) {
      // debug('writing body to request.')
      await this._writeBody(request, body)
    }

    return new Promise((resolve, reject) => {
      const cleanUp = () => {
        setImmediate(() => {
          request.removeListener('response', onResponse)
          request.removeListener('data', onData)
          request.removeListener('error', onError)
          request.removeListener('end', onEnd)
        })
      }

      const responseHeaders: Map<string, string> = new Map()
      const onResponse = (headers: HeaderMap, flags: number) => {
        // debug('got response headers. status=', headers[HTTP2_HEADER_STATUS])
        for (const name in headers) {
          responseHeaders.set(name, headers[name])
        }
      }

      const chunks: Array<Buffer> = []
      const onData = (chunk: Buffer) => {
        // debug('got chunk of data. length=', chunk.length)
        chunks.push(chunk)
      }

      const onError = (error: Error) => {
        if (client.remoteSettings.maxConcurrentStreams !== 256) {
          console.log('error, logging remote settings', client.remoteSettings)
        }

        debug('got request error. error=', error.message)
        cleanUp()
        reject(error)
      }

      const onEnd = (...args: any) => {
        cleanUp()
        const data = Buffer.concat(chunks)

        // TODO: this is hacky, but it means that the error will go first if
        // error and end are emitted in the same tick.
        setImmediate(() => {
          resolve({
            headers: responseHeaders,
            status: Number(responseHeaders.get(HTTP2_HEADER_STATUS)),
            ok: String(responseHeaders.get(HTTP2_HEADER_STATUS)).startsWith('2'),
            buffer: () => data
          })
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
    for (const session of this._sessions) {
      session.close()
    }
  }
}

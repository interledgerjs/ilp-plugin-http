const { URL } = require('url')
const debug = require('debug')('http2')
const http2 = require('http2')

const ConnectStates = {
  DISCONNECTED: 0,
  CONNECTING: 1,
  CONNECTED: 2
}

const {
  HTTP2_HEADER_PATH,
  HTTP2_HEADER_STATUS,
  HTTP2_HEADER_METHOD
} = http2.constants

class Http2Client {
  constructor (url, opts = {}, http2Opts = {}) {
    this._url = new URL(url)
    this._authority = this._url.origin
    this._defaultPath = this._url.pathname
    this._http2Opts = http2Opts

    this._connected = ConnectStates.DISCONNECTED
    this._connectPromise = null
  }

  _connect () {
    if (this._connected === ConnectStates.CONNECTED) {
      debug('client connected')
      return
    } else if (this._connected === ConnectStates.CONNECTING) {
      debug('client connecting')
      return this._connectPromise
    }

    debug('creating client. authority=', this._authority)
    this._client = http2.connect(this._authority, this._http2Opts)
    this._connected = ConnectStates.CONNECTING
    this._connectPromise = new Promise((resolve, reject) => {
      const cleanUp = () => {
        this._client.removeListener('connect', onConnect)
        this._client.removeListener('error', onError)
        this._client.removeListener('close', onClose)
      }

      const onConnect = () => {
        debug('client connected.')
        this._client.removeListener('connect', onConnect)
        this._connected = ConnectStates.CONNECTED
        resolve(this._client)
      }

      const onClose = () => {
        debug('client closed.')
        cleanUp()
        this._connected = ConnectStates.DISCONNECTED
        reject(new Error('closed while opening connection'))
      }

      // TODO: log the error
      const onError = error => {
        debug('client encountered error. error=', error.message)
        cleanUp()
        this._connected = ConnectStates.DISCONNECTED
        reject(error)
      }

      this._client.on('connect', onConnect)
      this._client.on('close', onClose)
      this._client.on('error', onError)
    })

    return this._connectPromise
  }

  _writeBody (request, body) {
    return new Promise((resolve, reject) => {
      const handleWrite = (err) => {
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

  async fetch (_path, {
    headers = {},
    method = 'GET',
    body
  } = {}) {
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

    return new Promise((resolve) => {
      const cleanUp = () => {
        request.removeListener('response', onResponse)
        request.removeListener('data', onData)
        request.removeListener('error', onError)
        request.removeListener('end', onEnd)
      }

      const responseHeaders = {}
      const onResponse = (headers, flags) => {
        debug('got response headers. status=', headers[HTTP2_HEADER_STATUS])
        for (const name in headers) {
          responseHeaders[name] = headers[name]
        }
      }

      const chunks = []
      const onData = chunk => {
        debug('got chunk of data. length=', chunk.length)
        chunks.push(chunk)
      }

      const onError = error => {
        debug('got request error. error=', error.message)
        cleanUp()
        reject(error)
      }

      const onEnd = () => {
        debug('request ended.')
        cleanUp()
        resolve({
          headers: responseHeaders,
          status: responseHeaders[HTTP2_HEADER_STATUS],
          ok: String(responseHeaders[HTTP2_HEADER_STATUS]).startsWith('2'),
          data: Buffer.concat(chunks),
          buffer: () => Buffer.concat(chunks)
        })
      }

      request.on('response', onResponse)
      request.on('data', onData)
      request.on('error', onError)
      request.once('end', onEnd)
      request.end()
    })
  }
}

module.exports = Http2Client

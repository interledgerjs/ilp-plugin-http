const koa = require('koa')
const fetch = require('node-fetch')
const jwt = require('jsonwebtoken')
// TODO: module for http2

const MAX_ILP_PACKET_LENGTH = 32767

class PluginHttp {
  constructor ({ incoming = {}, outgoing = {} } = {}) {
    // TODO: validate args
    this._connected = false

    // incoming
    this._port = incoming.port
    this._incomingSecret = incoming.secret

    // outgoing
    this._url = outgoing.url
    this._http2 = !!outgoing.http2
    this._outgoingSecret = outgoing.secret

    this._token = null 
    this._tokenExpiry = outgoing.tokenExpiry || 30000
    this._tokenSignedAt = 0

    // TODO: support http2
    if (this._http2) {
      throw new Error('http2 is not yet supported')
    }
  }

  async connect () {
    if (this._connected) return

    this._app = new Koa()
    this._app.use(async (ctx, next) => {
      const verified = await this._verifyToken(ctx.headers.authorization)
      if (!verified) {
        ctx.throw(401, 'invalid authorization')
        return
      }

      if (!this._connected) {
        ctx.throw(502, 'server is closed')
        return
      }

      const packet = raw(ctx.req, {
        limit: MAX_ILP_PACKET_LENGTH 
      })

      if (!this._dataHandler) {
        ctx.throw(502, 'no handler registered.')
        return
      }

      ctx.body = await this._dataHandler(packet)
    })

    this._httpServer = this._app.listen(this._port)
    this._connected = true
  }

  async disconnect () {
    if (!this._connected) return

    this._connected = false
    this._httpServer.close()
  }

  _verifyToken (token) {
    return new Promise(resolve => {
      jwt.verify(token, this._incomingSecret, err => {
        resolve(!err)
      })
    })
  }

  _getToken () {
    if (this._tokenSignedAt > Date.now() + this._tokenExpiry / 2) {
      return this._token
    }

    this._signedAt = Date.now()
    return new Promise((resolve, reject) => {
      jwt.sign({}, this._outgoingSecret, {
        expiresIn: Math.floor(this._tokenExpiry / 1000)
      }, (err, token) => {
        if (err) reject(err)
        resolve(token)
      })
    })
  }

  async sendData (data) {
    if (!this._connected) {
      throw new Error('plugin is not connected.')
    }

    // TODO: is it possible to authenticate a whole connection at
    // establishment? maybe using client certs?

    const res = await fetch(this.url, {
      method: 'POST',
      body: data,
      headers: {
        Authorization: this._getToken(),
        'Content-Type': 'application/ilp+octet-stream'
      }
    })

    if (!res.ok) {
      throw new Error('failed to fetch. code=' + res.status)
    }

    // TODO: browser-safe way to do this, just in case
    return res.buffer()
  }

  // boilerplate methods
  isConnected () {
    return this._connected
  }

  registerDataHandler (handler) {
    this._dataHandler = handler
  }

  deregisterDataHandler () {
    delete this._dataHandler
  }

  // no-ops; this plugin doesn't do settlement
  registerMoneyHandler () {
    return
  }

  deregisterMoneyHandler () {
    return
  }

  sendMoney () {
    return
  }
}
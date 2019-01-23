const koa = require('koa')
const fetch = require('node-fetch')
const jwt = require('jsonwebtoken')
// TODO: module for http2

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
    this._tokenExpiry = outgoing.tokenExpiry || 30
    this._tokenSignedAt = 0

    // TODO: support http2
    if (this._http2) {
      throw new Error('http2 is not yet supported')
    }
  }

  async connect () {
    if (this._connected) return

    // TODO: start the server
  }

  async disconnect () {
    if (!this._connected) return

    // TODO: stop the server
  }

  async _getToken () {
    if (this._tokenSignedAt > Date.now() + this._tokenExpiry / 2) {
      return this._token
    }

    this._signedAt = Date.now()
    const token = await new Promise((resolve, reject) => {
      jwt.sign({}, this._outgoingSecret, {
        expiresIn: Math.floor(this._tokenExpiry / 1000)
      }, (err, token) => {
        if (err) reject(err)
        resolve(token)
      })
    })
  }

  sendData (data) {
    if (!this._connected) {
      throw new Error('plugin is not connected.')
    }

    // TODO: is it possible to authenticate a whole connection at
    // establishment? maybe using client certs?

    const res = await fetch(this.url, {
      method: 'POST',
      body: data,
      headers: {
        Authorization: this._getToken()
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

const Koa = require('koa')
const IlpPacket = require('ilp-packet')
const ILDCP = require('ilp-protocol-ildcp')
const fetch = require('node-fetch')
const EventEmitter = require('events')
const jwt = require('jsonwebtoken')
const raw = require('raw-body')
// TODO: module for http2

const MAX_ILP_PACKET_LENGTH = 32767
const INVALID_SEGMENT = new RegExp('[^A-Za-z0-9_\\-]')

class PluginHttp extends EventEmitter {
  constructor ({ multi, ildcp, incoming = {}, outgoing = {} } = {}) {
    super()

    // TODO: validate args
    this._connected = false
    this._multi = !!multi
    this._ildcp = ildcp

    // incoming
    this._port = incoming.port
    this._incomingSecret = incoming.secret

    // outgoing
    this._url = outgoing.url
    this._http2 = !!outgoing.http2
    this._outgoingSecret = outgoing.secret
    this._name = outgoing.name || this._port

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
      const verified = await this._verifyToken(ctx.get('authorization'))
      if (!verified) {
        ctx.throw(401, 'invalid authorization')
        return
      }

      if (!this._connected) {
        ctx.throw(502, 'server is closed')
        return
      }

      const packet = await raw(ctx.req, {
        limit: MAX_ILP_PACKET_LENGTH 
      })

      if (this._multi) {
        const parsed = IlpPacket.deserializeIlpPrepare(packet)
        const name = ctx.get('ilp-peer-name')

        if (parsed.destination === 'peer.config') {
          const ildcp = await this._fetchIldcp()
          ctx.body = ILDCP.serializeIldcpResponse({
            ...ildcp,
            clientAddress: ildcp.clientAddress + '.' + name
          })
          return
        }
      }

      if (!this._dataHandler) {
        ctx.throw(502, 'no handler registered.')
        return
      }

      ctx.body = await this._dataHandler(packet)
    })

    this._httpServer = this._app.listen(this._port)
    this._connected = true
    this.emit('connect')
  }

  async disconnect () {
    if (!this._connected) return

    this._connected = false
    this._httpServer.close()
    this.emit('disconnect')
  }

  _verifyToken (token) {
    return new Promise(resolve => {
      jwt.verify(token, this._incomingSecret, err => {
        resolve(!err)
      })
    })
  }

  async _getToken () {
    const now = Date.now()
    if (this._tokenSignedAt > now + this._tokenExpiry / 2) {
      return this._token
    }

    this._tokenSignedAt = now + this._tokenExpiry
    this._token = await new Promise((resolve, reject) => {
      jwt.sign({}, this._outgoingSecret, {
        expiresIn: Math.floor(this._tokenExpiry / 1000)
      }, (err, token) => {
        if (err) reject(err)
        resolve(token)
      })
    })

    return this._token
  }

  async _fetchIldcp () {
    if (!this._ildcp) {
      this._ildcp = await ILDCP.fetch(this._dataHandler)
    }
    return this._ildcp
  }

  // Only used in multilateral situation
  async _generateUrl (data) {
    const ildcp = await this._fetchIldcp()
    const { destination } = IlpPacket.deserializeIlpPrepare(data)
    const segment = destination
      .substring(ildcp.clientAddress.length + 1)
      .split('.')[0]

    if (INVALID_SEGMENT.test(segment)) {
      throw new Error('invalid address segment')
    }

    // splice the address segment into the URL
    return this._url.replace('%', segment)
  }

  async sendData (data) {
    if (!this._connected) {
      throw new Error('plugin is not connected.')
    }

    // TODO: is it possible to authenticate a whole connection at
    // establishment? maybe using client certs?

    // url may be templated in multilateral environment
    const url = this._multi
      ? await this._generateUrl(data)
      : this._url

    const res = await fetch(url, {
      method: 'POST',
      body: data,
      headers: {
        Authorization: await this._getToken(),
        'Content-Type': 'application/ilp+octet-stream',
        'Ilp-Peer-Name': this._name
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

PluginHttp.version = 2
module.exports = PluginHttp

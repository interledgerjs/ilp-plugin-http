import * as crypto from 'crypto'
import * as jwt from 'jsonwebtoken'

export interface AuthOptions {
  jwtSecret?: string,
  jwtExpiry?: number,
  staticToken?: string,
}

interface AuthMethod {
  verifyToken (token: string): Promise<boolean>,
  getToken (): Promise<string>,
}

export default class Auth {
  private _method: AuthMethod

  constructor (options: AuthOptions) {
    if (options.jwtSecret) {
      this._method = new JwtAuth({
        secret: options.jwtSecret,
        expiry: options.jwtExpiry || 30000,
        staticToken: options.staticToken
      })
    } else if (options.staticToken) {
      this._method = new StaticTokenAuth(options.staticToken)
    } else {
      throw new Error('invalid auth options')
    }
  }

  verifyToken (token: string): Promise<boolean> {
    return this._method.verifyToken(token)
  }

  getToken (): Promise<string> {
    return this._method.getToken()
  }
}

interface JwtAuthOptions {
  secret: string,
  expiry: number,
  staticToken?: string,
}

class JwtAuth implements AuthMethod {
  private _secret: string
  private _token?: string
  private _expiry: number
  private _tokenSignedAt: number
  private _staticToken?: Buffer

  constructor (options: JwtAuthOptions) {
    this._secret = options.secret
    this._expiry = options.expiry
    this._tokenSignedAt = 0
    this._staticToken = typeof options.staticToken === 'string'
      ? Buffer.from(options.staticToken, 'utf8')
      : undefined
  }

  verifyToken (token: string): Promise<boolean> {
    return new Promise(resolve => {
      if (this._staticToken) {
        const tokenBuffer = Buffer.from(token, 'utf8')
        if (verifyStaticToken(tokenBuffer, this._staticToken)) {
          return resolve(true)
        }
      }
      jwt.verify(token, this._secret, (err: Error) => {
        resolve(!err)
      })
    })
  }

  async getToken (): Promise<string> {
    const now = Date.now()
    if (this._tokenSignedAt > now + this._expiry / 2) {
      return this._token!
    }

    this._tokenSignedAt = now + this._expiry
    this._token = await new Promise((resolve, reject) => {
      jwt.sign({}, this._secret, {
        expiresIn: Math.floor(this._expiry / 1000)
      }, (err, token) => {
        if (err) reject(err)
        else resolve(token)
      })
    })

    return this._token!
  }
}

class StaticTokenAuth implements AuthMethod {
  private _token: string
  private _tokenBuffer: Buffer

  constructor (token: string) {
    this._token = token
    this._tokenBuffer = Buffer.from(token, 'utf8')
  }

  verifyToken (token: string): Promise<boolean> {
    const tokenBuffer = Buffer.from(token, 'utf8')
    return Promise.resolve(verifyStaticToken(tokenBuffer, this._tokenBuffer))
  }

  getToken (): Promise<string> {
    return Promise.resolve(this._token)
  }
}

function verifyStaticToken (gotToken: Buffer, wantToken: Buffer): boolean {
  return gotToken.length === wantToken.length &&
    crypto.timingSafeEqual(gotToken, wantToken)
}

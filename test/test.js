const crypto = require('crypto')
const getPort = require('get-port')
const PluginHttp = require('..')
const IlpConnector = require('ilp-connector')
const { createConnection, Server } = require('ilp-protocol-stream')

async function run () {
  const port1 = await getPort()
  const port2 = await getPort()
  const port3 = await getPort()
  const port4 = await getPort()

  const serverPlugin = new PluginHttp({
    incoming: {
      secret: 'secret_number_one',
      port: port1
    },
    outgoing: {
      secret: 'secret_number_two',
      url: 'http://localhost:' + port2
    }
  })

  await IlpConnector.createApp({
    spread: 0,
    backend: 'one-to-one',
    store: 'ilp-store-memory',
    initialConnectTimeout: 60000,
    ilpAddress: 'private.moneyd',
    accounts: {
      server: {
        relation: 'child',
        plugin: '../../../..',
        assetCode: 'XRP',
        assetScale: 9,
        options: {
          incoming: {
            secret: 'secret_number_two',
            port: port2
          },
          outgoing: {
            secret: 'secret_number_one',
            url: 'http://localhost:' + port1
          }
        }
      },
      client: {
        relation: 'child',
        plugin: '../../../..',
        assetCode: 'XRP',
        assetScale: 9,
        options: {
          incoming: {
            secret: 'secret_number_three',
            port: port3
          },
          outgoing: {
            secret: 'secret_number_four',
            url: 'http://localhost:' + port4
          }
        }
      }
    }
  }).listen()

  const clientPlugin = new PluginHttp({
    incoming: {
      secret: 'secret_number_four',
      port: port4
    },
    outgoing: {
      secret: 'secret_number_three',
      url: 'http://localhost:' + port3
    }
  })

  await serverPlugin.connect()
  await clientPlugin.connect()

  const server = new Server({
    plugin: serverPlugin,
    serverSecret: crypto.randomBytes(32)
  })

  server.on('connection', conn => {
    conn.on('stream', stream => {
      stream.setReceiveMax('100000000')
    })
  })

  console.log('starting stream server')
  await server.listen()

  console.log('opening stream connection')
  const connection = await createConnection({
    ...server.generateAddressAndSecret(),
    plugin: clientPlugin,
    slippage: 0.05
  })

  console.log('sending money on stream')
  const stream = connection.createStream()
  await stream.sendTotal('6000000', { timeout: 999999999 })

  console.log('sent')
  process.exit(0)
}

run()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })

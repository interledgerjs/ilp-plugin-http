const Http2Client = require('../build/lib/http2').default

async function run () {
  console.log('making client')
  const client = new Http2Client('https://coil.com')

  console.log('fetching site 5k times')
  const result = await Promise.all([ ...Array(5000).keys() ].map(() => {
    return client.fetch('/', {})
  }))

  console.log('fetched.')
  console.log(result[0])
  console.log(result[0].buffer().toString())
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch(e => {
    console.error(e)
    process.exit(1)
  })

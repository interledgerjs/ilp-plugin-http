const Http2Client = require('../build/lib/http2').default

async function run () {
  console.log('making client')
  const client = new Http2Client('https://coil.com')

  console.log('fetching site')
  const result = await client.fetch('/', {})

  console.log(result)
  console.log(result.buffer().toString())
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch(e => {
    console.error(e)
    process.exit(1)
  })

const Http2Client = require('../src/http2')

async function run () {
  console.log('making client')
  const client = new Http2Client('https://coil.com')

  console.log('fetching site')
  const result = await client.fetch()

  console.log(result)
  console.log(result.data.toString())
}

run()
  .then(() => {
    process.exit(0)
  })
  .catch(e => {
    console.error(e)
    process.exit(1)
  })

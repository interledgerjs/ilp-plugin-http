const Http2Client = require('../build/lib/http2').default

async function run () {
  console.log('making client')
  const client = new Http2Client('https://staging.coil.com')

  console.log('fetching site 5k times')
  let result

  let successes = 0
  let failures = 0

  for (let i = 0; i < 10; ++i) {
    console.log('iteration', i)
    result = await Promise.all([ ...Array(5000).keys() ].map(async () => {
      try {
        const result = await client.fetch('/', {})
        successes++
        return result
      } catch (e) {
        failures++
      }
    }))
  }

  console.log('fetched.')
  console.log('success:', successes)
  console.log('failure:', failures)
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

const Http2Client = require('../build/lib/http2').default

async function run () {
  console.log('making client')
  const client = new Http2Client('https://staging.coil.com', {
    maxRequestsPerSession: 900
  })

  const iterations = 75000
  const promises = []
  console.log(`fetching site ${iterations} times`)

  let successes = 0
  let failures = 0

  const startDate = Date.now()

  for (let i = 0; i < iterations; ++i) {
    if (i % 1000 === 0) {
      console.log('iteration', i)
    }
    promises.push(new Promise(async (resolve) => {
      try {
        const result = await client.fetch('/', {})
        successes++
        resolve(result)
      } catch (e) {
        failures++
        resolve()
      }
    }))
    await new Promise(resolve => setTimeout(resolve, 1))
  }

  const result = await Promise.all(promises)
  const endDate = Date.now()
  const rate = (iterations / ((endDate - startDate) / 1000)).toFixed(3)

  console.log('rate: ', rate, 'pps')
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

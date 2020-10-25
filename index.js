// TODO https://www.digitalocean.com/community/tutorial_series/how-to-code-in-node-js
// TODO https://www.digitalocean.com/community/tutorials/how-to-write-and-run-your-first-program-in-node-js

// TODO make the thing

// this automatically loads "config/default.yaml" if existant in the current working directory
// TODO or the one this file is located in, via: process.env["NODE_CONFIG_DIR"] = __dirname + "/configDir/";
// TODO config, see: https://github.com/lorenwest/node-config/wiki/Configuration-Files
const config = require('config')

const fs = require('fs') // TODO file system interaction

// i would be using the built-in https module, but it doesn't provide a promise-based interface, unlike the built-in http module, which makes zero sense, which is why i'm using axios
const axios = require('axios')

const cheerio = require('cheerio')

const Twitter = require('twitter')

class Logger {
  constructor(v0) {
    this.v0 = parseInt(v0)
  }

  #timestampify(message) {

    // stringify
    message = "" + message

    // add timestamp and pad everything but the first line accordingly
    const timestamp = new Date().toISOString() +  " - "
    const lines = message.split("\n")
    let first = lines[0]
    let rest = ""
    if (lines.length > 1) {
      first += "\n"
      rest = lines.slice(1).map(l => "".padStart(timestamp.length, ' ') + l).join("\n")
    }

    return timestamp + first + rest
  }

  #log(message) {
    console.log(this.#timestampify(message))
  }

  #err(message) {
    console.error(this.#timestampify(message))
  }

  debug(object) {
    if (this.v0 >= 2) {
      this.#log(JSON.stringify(object))
    }
  }

  status(message) {
    if (this.v0 >= 1) {
      this.#log(message)
    }
  }

  error(message) {
    if (this.v0 >= 0) {
      if (message.hasOwnProperty("stack")) {
        this.#err("A bad thing has happened:\n" + message.stack)
      } else {
        this.#err("A bad thing has happened:\n" + message)
      }
      process.exit(1)
    }
  }
}

// request list of wikipedias
function getWikipedias() {
  const wikipediasTableURL = 'https://meta.wikimedia.org/wiki/List_of_Wikipedias/Table'

  return axios.get(wikipediasTableURL)
    .then(src => {
      // parse html code
      const $ = cheerio.load(src.data)

      // extract all table rows
      const rows = $('.mw-parser-output table tr')

      let languages = []
      rows.each((_, e) => {
        // ignore table headings (which contain th elements instead of td)
        if ($(e).find('th').length > 0) {
          return
        }

        // extract only table cells from current row (i.e. drop text nodes in-
        // between which basically only contain whitespace anyway)
        const cells = $(e).find('td')

        // for each row, the second cell (=> index 1) contains the language name
        // (e.g. "English"), and the fourth (=> 3) contains the subdomain (e.g.
        // "en")
        const language = $(cells[1]).text().trim()
        const subdomain = $(cells[3]).text().trim()

        // accumulate them
        languages.push({ subdomain: subdomain, language: language })
      })

      // drop the last row's contribution (it stems from a summary table at the
      // bottom of the page)
      languages = languages.slice(0, -1)

      return languages
    })
}

function getStats(w) {
  const wikipediaStatsURL = 'https://' + w.subdomain + '.wikipedia.org/wiki/Special:Statistics'
  return axios.get(wikipediaStatsURL)
    .then(src => {
      // parse html code
      const $ = cheerio.load(src.data)

      // TODO do things here
    })
}

// TODO interact with cache
// config.get('cacheFile')


// TODO https://www.npmjs.com/package/twitter
/* const client = new Twitter({
  consumer_key: config.get('twitter.consumerKey'),
  consumer_secret: config.get('twitter.consumerSecret'),
  access_token_key: config.get('twitter.accessTokenKey'),
  access_token_secret: config.get('twitter.accessTokenSecret')
})
client.post('statuses/update', { status: 'testing' })
  .then(tweet => {
    console.log(tweet)
  })
  .catch(error => {
    throw error
  }) */

// TODO make storage format identical to haskell one, just for fun, so they're compatible?
// TODO https://stackabuse.com/reading-and-writing-json-files-with-node-js/

// TODO dict intersection: list1.filter(a => list2.some(b => a.userId === b.userId));
// via https://stackoverflow.com/a/54763194

async function run() {
  logger = new Logger(config.verbosity)
  logger.status("Successfully loaded configuration.")

  logger.status("Getting list of Wikipedias... ")
  const wikipedias = await getWikipedias().catch(error => logger.error(error));
  logger.debug(wikipedias)

  const m = wikipedias.length
  let n = 1
  wikipedias.forEach(async wiki => {
    // TODO hmm, make the status thingy less async, somehow? idk?
    logger.status("Getting stats for " + wiki.subdomain + ".wikipedia.org (" + n + "/" + m + ")... ")
    n++
    const stats = await getStats(wiki).catch(error => logger.error(error));
    // TODO more
    // TODO instead of erroring, maybe just emit a warning and carry on without this wikipedia? but do emit an error if there are more than a few errors? idk
  })




  // TODO
  /*
  load wikipedias list
  then
  for each wikipedia, load it and extract stats
  then
  load cache or, if not possible, make empty cache/skip tweeting
  then
  compare and construct tweets and send em
  then
  write new cache to disk
  */
}

run()

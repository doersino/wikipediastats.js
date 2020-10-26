// TODO https://www.digitalocean.com/community/tutorial_series/how-to-code-in-node-js
// TODO https://www.digitalocean.com/community/tutorials/how-to-write-and-run-your-first-program-in-node-js

// TODO make the thing

// this automatically loads "config/default.yaml" if existant in the current working directory
// TODO or the one this file is located in, via: process.env["NODE_CONFIG_DIR"] = __dirname + "/configDir/";
// TODO config, see: https://github.com/lorenwest/node-config/wiki/Configuration-Files
// TODO maybe keep twitter config separately (maybe optional: "if you wish to..., copy the twitter section of default.yaml to production.yaml and run with NODE_CONFIG_ENV=production"), see: https://github.com/lorenwest/node-config/wiki/Environment-Variables
const config = require('config')

const fs = require('fs/promises');

// i would be using the built-in https module, but it doesn't provide a promise-based interface, unlike the built-in http module, which makes zero sense, which is why i'm using axios
const axios = require('axios')

const cheerio = require('cheerio')

const Twitter = require('twitter')


const statDescriptions = {
  "mw-statistics-articles": s => "now features " + s + " articles",
  "mw-statistics-pages":    s => "now consists of " + s + " pages (including non-articles)",
  "mw-statistics-edits":    s => "has now received a total of " + s + " edits",
  "mw-statistics-users":    s => "has now been shaped by " + s + " registered users",
  "mw-statistics-hook":     s => "now contains more than " + s + " words",
  }


class Logger {
  constructor(v0) {
    this.v0 = parseInt(v0)
  }

  // TODO don't use # since standard can't deal with it
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

  warning(message) {
    if (this.v0 >= 0) {
      if (message.hasOwnProperty("stack")) {
        this.#err("Warning – A bad thing has happened, but we'll keep going:\n" + message.stack)
      } else if (typeof message != "string") {
        this.#err("Warning – A bad thing has happened, but we'll keep going:\n" + JSON.stringify(message))
      } else {
        this.#err("Warning – A bad thing has happened, but we'll keep going:\n" + message)
      }
    }
  }

  error(message) {
    if (this.v0 >= 0) {
      if (message.hasOwnProperty("stack")) {
        this.#err("Error – A bad thing has happened:\n" + message.stack)
      } else if (typeof message != "string") {
        this.#err("Warning – A bad thing has happened:\n" + JSON.stringify(message))
      } else {
        this.#err("Warning – A bad thing has happened:\n" + message)
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
  const wikipediaStatsURL = `https://${w.subdomain}.wikipedia.org/wiki/Special:Statistics?uselang=en`
  return axios.get(wikipediaStatsURL)
    .then(src => {
      // parse html code
      const $ = cheerio.load(src.data)

      let stats = {}
      for (const stat of Object.keys(statDescriptions)) {
        let number = $(`.${stat} .mw-statistics-numbers`).text()

        // if the current statistic doesn't exist for a given wikipedia, number will be an empty string – in this case, omit this stat for the current wikipedia
        if (number === "") {
          return;
        }

        // that's numberwang!
        number = parseInt(number.replace(/\D/g,''));

        stats[stat] = number
      }

      return stats
    })
}

// TODO comment: interact with cache
function readStats(path) {
  return fs.access(path)
    .then(() => {
      return fs.readFile(path)
        .then(data => {
          return JSON.parse(data);
        })
    })
    .catch(() => {
      return {};
    })
}

function writeStats(path, stats) {
  return fs.writeFile(path, JSON.stringify(stats))
}

function compareStats(oldStats, newStats) {
  let comp = [];
  Object.keys(oldStats).forEach(subdomain => {
    if (newStats.hasOwnProperty(subdomain)) {
      const oldS = oldStats[subdomain]
      const newS = newStats[subdomain]
      Object.keys(oldS).forEach(stat => {
        if (newS.hasOwnProperty(stat)) {
          const o = oldS[stat];
          const n = newS[stat];

          const newEclipsesOld = n > o
          const aboveThreshold = n > 10
          const firstDigitChanged = o.toString()[0] != n.toString()[0]

          const milestoneReached = newEclipsesOld && aboveThreshold && firstDigitChanged
          if (milestoneReached) {
            let v = parseInt(`${n.toString()[0]}${"".padStart(o.toString().length - 1, "0")}`)
            //console.log(subdomain, stat, v)
            comp.push({subdomain: subdomain, stat: stat, value: v});
          }
        }
      })
    }
  });

  return comp;
}

function formatStat(n) {
  if (n < 10000) {
    return n;
  }
  if (n < 1000000) {
    l = n.toString().length
    return `${n.toString().slice(0, l-3)},${n.toString().slice(l-3)}`
  }
  if (n < 1000000000) {
    return `${parseInt(n/1000000)} million`
  }
  if (n < 1000000000000) {
    return `${parseInt(n/1000000000)} billion`
  }
  return `${parseInt(n/1000000000000)} trillion`
}

function prettyComparedStats(comparedStats, wikipedias) {
  return comparedStats.map(stat => {

    // TODO eh
    let language = wikipedias.find(wiki => wiki.subdomain == stat.subdomain).language

    let text = ""
    if (stat.value.toString().charAt(0) === '1') {
      text += "Hooray! "
    }
    text += `The ${language} edition of #Wikipedia `
    text += statDescriptions[stat.stat](formatStat(stat.value))
    text += `! Explore more stats here: https://${stat.subdomain}.wikipedia.org/wiki/Special:Statistics`

    return text
  })
}

async function run() {
  logger = new Logger(config.verbosity)
  logger.status("Successfully loaded configuration.")

  logger.status("Getting list of Wikipedias... ")
  let wikipedias = await getWikipedias().catch(error => logger.error(error));
  wikipedias = wikipedias.slice(0, config.wikipediaLimit)
  logger.debug(wikipedias)

  logger.status("Getting stats for each Wikipedia... ")
  const m = wikipedias.length
  let n = 1
  const newStatsPromises = wikipedias.map(async wiki => {

    // throw warnings instead of errors
    const s = await getStats(wiki).catch(error => logger.warning(error));

    // instead of "n++", i should probably be using an atomic, but it seems to work – and since it's just for progress metering, it doesn't really matter if it's ever off by one
    logger.status(`Successfully got stats for ${wiki.subdomain}.wikipedia.org (${n++}/${m}).`)
    return {[wiki.subdomain]: s}  // TODO make this whole loop somehow return a dict instead?  https://dev.to/devtronic/javascript-map-an-array-of-objects-to-a-dictionary-3f42
  })
  let newStats = await Promise.all(newStatsPromises)
  newStats = Object.assign({}, ...newStats)  // convert from list of singleton dicts of subdomains and stats to dicto of subdomains and stats
  logger.debug(newStats)

  logger.status("Reading previous stats from cache...")
  const oldStats = await readStats(config.cacheFile)
  logger.debug(oldStats)

  // TODO if oldstats empty, skip straight to writing new stats?
  const firstRun = Object.keys(oldStats).length === 0
  if (firstRun) {
    config.warning("Since no cached stats were present, I've got nothing to compare them against. Run me again and I will.")
  } else {

    logger.status("Comparing newly downloaded stats with cached stats...")
    const comparedStats = compareStats(oldStats, newStats)
    logger.debug(comparedStats)

    logger.status("Turning comparison results into tweet texts and limiting to at most " + config.tweetLimit + "...")
    let tweetTexts = prettyComparedStats(comparedStats, wikipedias)
    tweetTexts = tweetTexts.slice(0, config.tweetLimit)
    logger.debug(tweetTexts)
    //tweetTexts = ["testing 1 2 3 4", "is this thing on? now", "testing more!!"]

    const tweetingPossible = !(!config.twitter.consumerKey || !config.twitter.consumerSecret || !config.twitter.accessTokenKey || !config.twitter.accessTokenSecret);
    if (!tweetingPossible) {
      logger.warning("Tweeting is disabled since not all API keys and secrets have been specified.")
    } else {
      const tweetingNecessary = tweetTexts.length > 0
      if (!tweetingNecessary) {
        logger.status("Nothing to tweet – no new milestones have been reached.")
      } else {
        logger.status("Tweeting...")
        const client = new Twitter({
          consumer_key: config.get('twitter.consumerKey'),
          consumer_secret: config.get('twitter.consumerSecret'),
          access_token_key: config.get('twitter.accessTokenKey'),
          access_token_secret: config.get('twitter.accessTokenSecret')
        })
        await Promise.all(tweetTexts.map(async text => {
          await client.post('statuses/update', { status: text })
            .then(tweet => logger.debug(tweet))
            .catch(error => logger.error(error))
          }))
      }
    }
  }

  logger.status("Writing updated stats to cache...")
  await writeStats(config.cacheFile, newStats).catch(error => logger.error(error));

  logger.status("All done.")
}

run()

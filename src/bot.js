// I would be using the built-in https module, but it doesn't seem to provide a
// promise-based interface, unlike the built-in http module. This makes zero
// sense, which is why I'm just using axios instead.
const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs/promises')

const Twitter = require('twitter')

const logging = require('./logging.js')

// The relevant stats and how to write about them in generated tweets.
const statDescriptions = {
  'mw-statistics-articles': s => `now features ${s} articles`,
  'mw-statistics-pages': s => `now consists of ${s} pages (including non-articles)`,
  'mw-statistics-edits': s => `has now received a total of ${s} edits`,
  'mw-statistics-users': s => `has now been shaped by ${s} registered users`,
  'mw-statistics-hook': s => `now contains more than ${s} words`
}

// Download and parse list of Wikipedias.
function getWikipedias () {
  const wikipediasTableURL = 'https://meta.wikimedia.org/wiki/List_of_Wikipedias/Table'

  return axios.get(wikipediasTableURL)
    .then(src => {
      // Parse HTML code.
      const $ = cheerio.load(src.data)

      // Extract all table rows.
      const rows = $('.mw-parser-output table tr')

      let languages = []
      rows.each((_, e) => {
        // Ignore table headings (which contain <th> elements instead of <td>).
        if ($(e).find('th').length > 0) {
          return
        }

        // Extract only table cells from current row (i.e. drop text nodes in-
        // between which basically only contain whitespace anyway).
        const cells = $(e).find('td')

        // For each row, the second cell (=> index 1) contains the language name
        // (e.g. "English"), and the fourth (=> 3) contains the subdomain (e.g.
        // "en").
        const language = $(cells[1]).text().trim()
        const subdomain = $(cells[3]).text().trim()

        // Accumulate them.
        languages.push({ subdomain: subdomain, language: language })
      })

      // Drop the last row's contribution (it stems from a summary table at the
      // bottom of the page).
      languages = languages.slice(0, -1)

      return languages
    })
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const random = (min, max) => Math.floor(Math.random() * (max - min) + min)

function getStats (w) {
  return sleep(random(0, 30000))
    .then(() => {
      const wikipediaStatsURL = `https://${w.subdomain}.wikipedia.org/wiki/Special:Statistics?uselang=en`
      return axios.get(wikipediaStatsURL)
        .then(src => {
          // Parse HTML code.
          const $ = cheerio.load(src.data)

          const stats = {}
          Object.keys(statDescriptions).forEach(stat => {
            // Extract value of current stat.
            let value = $(`.${stat} .mw-statistics-numbers`).text()

            // If the current stat doesn't exist for a given Wikipedia, value will
            // be an empty string – in this case, omit this stat for the current
            // Wikipedia. The comparison method is tuned to account for this.
            if (value === '') {
              return
            }

            // That's Numberwang!
            value = parseInt(value.replace(/\D/g, ''))

            // Accumulate.
            stats[stat] = value
          })

          return stats
        })
    })
}

// Reads the stats cache located at path, returning it as an object. If it
// doesn't exist, an empty object is returned instead.
function readStats (path) {
  return fs.access(path)
    .then(() => {
      return fs.readFile(path)
        .then(data => {
          return JSON.parse(data)
        })
    })
    .catch(() => {
      return {}
    })
}

// Writes a stats object to a path.
function writeStats (path, stats) {
  return fs.writeFile(path, JSON.stringify(stats))
}

// Compares to stats objects, returning a list of milestones reached.
function compareStats (oldStats, newStats) {
  const milestones = []

  Object.keys(oldStats).forEach(subdomain => {
    if (Object.prototype.hasOwnProperty.call(newStats, subdomain)) {
      const oldS = oldStats[subdomain]
      const newS = newStats[subdomain]

      Object.keys(oldS).forEach(stat => {
        if (Object.prototype.hasOwnProperty.call(newS, stat)) {
          const o = oldS[stat]
          const n = newS[stat]

          // These three conditions must be met for a new milestone.
          const newEclipsesOld = n > o
          const aboveThreshold = n > 10
          const firstDigitChanged = o.toString()[0] !== n.toString()[0]

          const milestoneReached = newEclipsesOld && aboveThreshold && firstDigitChanged
          if (milestoneReached) {
            // Round down to the nearest X000...0. I'm sure this could be done
            // much more elegantly.
            const v = parseInt(`${n.toString()[0]}${''.padStart(o.toString().length - 1, '0')}`)

            milestones.push({ subdomain: subdomain, stat: stat, value: v })
          }
        }
      })
    }
  })

  return milestones
}

// Format a milestone (i.e. a leading non-zero digit followed by a string of
// zeros) in a human-readable way. Nothing scientific about this, these
// representations just made sense to me.
function formatStat (n) {
  if (n < 10000) {
    return n
  }

  // Add a comma three digits from the end.
  if (n < 1000000) {
    const l = n.toString().length
    return `${n.toString().slice(0, l - 3)},${n.toString().slice(l - 3)}`
  }

  if (n < 1000000000) {
    return `${parseInt(n / 1000000)} million`
  }

  if (n < 1000000000000) {
    return `${parseInt(n / 1000000000)} billion`
  }

  return `${parseInt(n / 1000000000000)} trillion`
}

function prettyComparedStats (comparedStats, wikipedias) {
  return comparedStats.map(stat => {
    // This is a bit inelegant, but it's okay.
    const language = wikipedias.find(wiki => wiki.subdomain === stat.subdomain).language

    let text = ''
    if (stat.value.toString().charAt(0) === '1') {
      text += 'Hooray! '
    }
    text += `The ${language} edition of #Wikipedia `
    text += statDescriptions[stat.stat](formatStat(stat.value))
    text += `! Explore more stats here: https://${stat.subdomain}.wikipedia.org/wiki/Special:Statistics`

    return text
  })
}

async function run (config) {
  const logger = new logging.Logger(config.verbosity, config.logFile)

  logger.status('Running in ' + config.util.getEnv('NODE_CONFIG_ENV') + ' mode.')

  logger.status('Successfully loaded configuration.')
  logger.debug(config)

  logger.status('Getting list of Wikipedias... ')
  const allWikipedias = await getWikipedias().catch(error => logger.error(error))
  const wikipedias = allWikipedias.slice(0, config.wikipediaLimit)
  logger.debug(wikipedias)

  logger.status('Getting stats for each Wikipedia... ')
  const m = wikipedias.length
  let n = 1
  const newStatsPromises = wikipedias.map(async wiki => {
    const s = await getStats(wiki)
      .then(s => {
        logger.status(`Successfully got stats for ${wiki.subdomain}.wikipedia.org (${n}/${m}).`)
        return s
      })
      .catch(error => {
        logger.status(`Failed to get stats for ${wiki.subdomain}.wikipedia.org (${n}/${m}):`)
        // Throw warnings instead of errors – one or two Wikipedias might just
        // randomly fail on each run.
        logger.warning(error)
        return {}
      })

    // Instead of "n++", i should probably be using an atomic, but it seems to
    // work – and since it's just for progress metering, it doesn't really
    // matter if it's ever off by one.
    n++

    return { [wiki.subdomain]: s }
  })
  const newStatsList = await Promise.all(newStatsPromises)

  // Convert from list of singleton dicts of subdomains and stats to dicts of
  // subdomains and stats.
  const newStats = Object.assign({}, ...newStatsList)
  logger.debug(newStats)

  logger.status('Reading previous stats from cache...')
  const oldStats = await readStats(config.cacheFile)
  logger.debug(oldStats)

  const firstRun = Object.keys(oldStats).length === 0
  if (firstRun) {
    logger.warning("Since no cached stats were present, I've got nothing to compare them against. Run me again and I will.")
  } else {
    logger.status('Comparing newly downloaded stats with cached stats...')
    const comparedStats = compareStats(oldStats, newStats)
    logger.debug(comparedStats)

    logger.status('Turning comparison results into tweet texts and limiting to at most ' + config.tweetLimit + '...')
    let tweetTexts = prettyComparedStats(comparedStats, wikipedias)
    tweetTexts = tweetTexts.slice(0, config.tweetLimit)
    logger.debug(tweetTexts)

    const tweetingPossible = !(!config.twitter.consumerKey || !config.twitter.consumerSecret || !config.twitter.accessTokenKey || !config.twitter.accessTokenSecret)
    if (!tweetingPossible) {
      logger.warning('Tweeting is disabled since not all API keys and secrets have been specified.')
    } else {
      const tweetingNecessary = tweetTexts.length > 0
      if (!tweetingNecessary) {
        logger.status('Nothing to tweet – no new milestones have been reached.')
      } else {
        logger.status('Tweeting...')
        const client = new Twitter({
          consumer_key: config.twitter.consumerKey,
          consumer_secret: config.twitter.consumerSecret,
          access_token_key: config.twitter.accessTokenKey,
          access_token_secret: config.twitter.accessTokenSecret
        })

        await Promise.all(tweetTexts.map(async text => {
          await client.post('statuses/update', { status: text })
            .then(tweet => logger.debug(tweet))
            .catch(error => logger.error(error))
        }))
      }
    }
  }

  logger.status('Writing updated stats to cache...')
  await writeStats(config.cacheFile, newStats).catch(error => logger.error(error))

  logger.status('All done.')
}

exports.run = run

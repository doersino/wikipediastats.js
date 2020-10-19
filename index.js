// TODO https://www.digitalocean.com/community/tutorial_series/how-to-code-in-node-js
// TODO https://www.digitalocean.com/community/tutorials/how-to-write-and-run-your-first-program-in-node-js

// TODO make the thing

const config = require('config')

const fs = require('fs')  // TODO file system interaction

const axios = require('axios') // i would be using the built-in https module, but it doesn't provide a promise-based interface, unlike the built-in http module, which makes zero sense, which is why i'm using axios

const jsdom = require('jsdom')
const { JSDOM } = jsdom

const Twitter = require('twitter')

// TODO do this in ts? or might that be too much for this first project?
// TODO config, see: https://github.com/lorenwest/node-config/wiki/Configuration-Files

// TODO https://www.npmjs.com/package/twitter
var client = new Twitter({
  consumer_key: config.get('twitter.consumerKey'),
  consumer_secret: config.get('twitter.consumerSecret'),
  access_token_key: config.get('twitter.accessTokenKey'),
  access_token_secret: config.get('twitter.accessTokenSecret')
})

// TODO set up logging to console depending on verbosity

// TODO interact with cache

const wikipediasTableURL = 'https://meta.wikimedia.org/wiki/List_of_Wikipedias/Table'
const wikipediaStatsURL = subdomain => 'https://' + subdomain + '.wikipedia.org/wiki/Special:Statistics'

// TODO okay, actually make the thing


const getWikipedias = () => {
  axios.get(wikipediasTableURL)
    .then(src => {
      console.log(src.data)
      const dom = new JSDOM(src.data)
      //console.log(dom.window.document)
      // TODO this just doesn't parse out anything at all? but it doesn't yield an error, either.
      const rows = dom.window.document.querySelectorAll('.mw-parser-output table tbody tr td:nth-child(2n):nth-child(-n+4)')
      //console.log(rows)

    })
    .catch(err => console.log(err))
}

//getWikipedias()

const cheerio = require('cheerio')

axios.get('https://meta.wikimedia.org/wiki/List_of_Wikipedias/Table')
  .then(src => {
    //console.log(src.data)
    const $ = cheerio.load(src.data)
    //let test = $('.mw-parser-output table tbody tr td:nth-child(2n):nth-child(-n+4)').text()
    //console.log(test.split("\n"))
    let rows = $('.mw-parser-output table tr')
    //let rows2 = rows.map((i, row) => {
    //  return row.children.filter((i, e) => {this.type === 'td'})
    //});
    //console.log(rows2);
    for (var i = 0; i < rows.length; i++) {
      // need to first filter out theads somehow, ugh
      if (rows[i].children[3].children[0].type == "tag") {
        let language = rows[i].children[3].children[0].children[0].data
        let lang = rows[i].children[7].children[0].children[0].data
        // TODO $($(rows[i]).find("td")[1]).text()
        // TODO $($(rows[i]).find("td")[3]).text()
        // TODO rows.slice(0, -1).map((i,e) => [$($(e).find("td")[1]).text(), $($(e).find("td")[3]).text()])
        console.log([language, lang])
      }
      //console.log(rows.find("td"))
      //console.log(rows[i].children[1], rows[i].children[3])
      //console.log(rows[i].children.filter((i, e) => {console.log(e);return true || e.type == 'text'}))
    }
    // TOOD okay, can do things with this.
  })
  .catch(err => console.log(err))


/*axios.get('https://wikipedia.org')
  .then(src => {
    console.log(src.data)
    const dom = new JSDOM(src.data)
    console.log(dom)
    //console.log(Array.from(dom.window.document.querySelectorAll('li')).map(node => node.textContent))
    //dom.window.document.querySelectorAll('li').forEach(node => console.log(node.textContent))
  })
  .catch(err => console.log(err))*/

/* client.post('statuses/update', { status: 'testing' })
  .then(function (tweet) {
    console.log(tweet)
  })
  .catch(function (error) {
    throw error
  }) */

// TODO make storage format identical to haskell one, just for fun, so they're compatible?
// TODO https://stackabuse.com/reading-and-writing-json-files-with-node-js/

// TODO dict intersection: list1.filter(a => list2.some(b => a.userId === b.userId));
// via https://stackoverflow.com/a/54763194

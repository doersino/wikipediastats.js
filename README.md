# wikipediastats.js

*A Node.js-powered Twitter bot that posts milestones and statistics of various Wikipedias.*

While the main purpose of building this Twitter bot was to get myself acquainted with Node.js, it's actually doing semi-interesting stuff. Whenever you run this program, it

1. downloads and parses [a list of all the different-language Wikipedias](https://meta.wikimedia.org/wiki/List_of_Wikipedias),
2. **scrapes some of the more interesting [statistics](https://en.wikipedia.org/wiki/Special:Statistics)** for each of them,
3. **compares these stats to previously scraped and cached values** (unless the cache doesn't exist, in which case `goto 5`),
4. **posts a tweet if a milestone has been reached**, i.e. the first digit of a stat has changed (e.g. 49894 → 50002), and
5. refreshes the now-stale cache with the newly scraped values.


#### Now witness the ~~firepower~~results of this fully armed and operational ~~battle station~~Twitter bot and check out [@wikipediastats](https://twitter.com/wikipediastats)!

*Note that I've [previously implemented this bot in Haskell](https://github.com/doersino/wikipediastats). As it turned out, the otherwise-[excellent](https://uberspace.de) shared hosting plan I'm running all of my Twitter bots on limits RAM use to 1.5 GB per user, which was insufficient for building some of the Haskell variant's dependencies – hence this reimplementation (which also comes with improved logging versus the original).*


## Setup

Fairly typical for a modern server-side JavaScript thing, I believe. First, install a reasonably recent release of [Node.js](https://nodejs.org/en/) – it's almost certainly available through your package manager. Then:

```bash
$ git clone https://github.com/doersino/wikipediastats.js
$ cd wikipediastats.js
$ npm install
```

If that's been successful, navigate to `config/default.yaml` and configure your instance of this bot. Simply follow the instructions in the comments! This will involve entering your Twitter API credentials, ideally in a *separate* YAML file located at `config/production.yaml` – which will make sure the credentials never make their way into source control.

Run the bot for the first time:

```bash
$ NODE_CONFIG_ENV=production node .
```
This will populate the *stats cache*, based on which newly reached milestones are determined on each successive run.

If you're actually intending to use this as a Twitter bot, set up a cronjob to execute `node .` every hour or so, roughly like this:

```cron
0 * * * * cd PATH_TO_WIKIPEDIASTATSJS && NODE_CONFIG_ENV=production node .
```

(`NODE_CONFIG_ENV=production` is only [needed](https://github.com/lorenwest/node-config/wiki/Environment-Variables) if the Twitter API credentials are kept in `config/production.yaml`.)


## Development

The source code should conform to [JavaScript Standard Style](https://standardjs.com). To enforce this, `standard` is listed as a development dependency in `package.json` – you might need to run `npm install --production=false` to set it up. Then, make sure to run `standard --fix` before any commit.

You can configure your text editor to do this automatically, running a formatting pass either on save or via keystroke. For Sublime Text (which I use), install the [StandardFormat](https://packagecontrol.io/packages/StandardFormat) package. Plugins for other editors are listed [here](https://standardjs.com/#are-there-text-editor-plugins).

Debugging using Chrome's built-in developer tools is [super useful and comes for free](https://medium.com/@paul_irish/debugging-node-js-nightlies-with-chrome-devtools-7c4a1b95ae27) with recent versions of Node: Simply run `node --inspect-brk .`, navigate to `chrome://inspect/` and click "Open dedicated DevTools for Node".


## Notes

* This two-afternoon project was my first foray into Node.js, so don't expect elegance or adherence to best practices. Don't expect JavaScript from 2008, either – I've sprinkled on a healthy amount of `async`, `await` and `.then()`.
* An improvement I didn't care to implement: Store the largest tweeted value (for each stat, for each Wikipedia) in the cache in order to avoid duplicate tweets when the stat reaches a milestone, falls below it again due to article deletions or similar, then reaches the milestone again.

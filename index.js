const bot = require('./src/bot.js')

// Unless the NODE_CONFIG_DIR environment variable is set, the automatically
// loads "config/default.yaml" if existant in the current working directory.
const config = require('config')

// Pop off!
bot.run(config)

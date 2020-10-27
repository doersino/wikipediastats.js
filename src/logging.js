const fs = require('fs')

// Super basic logger that also writes to console with integer verbosity setting
// (the highest verbosity level applies to file logging):
// 0: Silent if things run smoothly but noisy if they don't, great when
//    running as a cronjob. Errors stop the program, warnings keep it going,
//    both use console.error().
// 1: Normal. Status messages emitted via console.log().
// 2: Verbose. Status messages and very verbose intermediate results, handy
//    for debugging, written using console.log().
class Logger {
  constructor (verbosity, logfile) {
    this.verbosity = parseInt(verbosity)
    this.logToFile = false
    if (logfile) {
      // We need to use low-level file system APIs here since we don't want any
      // caching, see https://stackoverflow.com/a/43662483.
      this.logFileHandle = fs.openSync(logfile, 'a')
      this.logToFile = true
    }
  }

  // Private methods are prefixed with __ instead of # since standard.js can't
  // deal with that.
  __preprocess (message) {
    // Exceptions: Extract stack.
    if (Object.prototype.hasOwnProperty.call(message, 'stack')) {
      return message.stack
    }

    // Objects: JSONify.
    if (typeof message !== 'string') {
      return JSON.stringify(message)
    }

    return message
  }

  __prefix(prefix, message) {
    // Stringify
    message = '' + message

    // Add prefix and pad everything but the first line accordingly.
    const lines = message.split('\n')
    let first = lines[0]
    let rest = ''
    if (lines.length > 1) {
      first += '\n'
      rest = lines.slice(1).map(l => ''.padStart(prefix.length, ' ') + l).join('\n')
    }

    return prefix + first + rest
  }

  __timestampify (message) {
    return this.__prefix(new Date().toISOString() + ' - ', message)
  }

  __logToFile (message) {
    if (this.logToFile) {
      fs.writeSync(this.logFileHandle, this.__timestampify(message) + '\n')
    }
  }

  debug (object) {
    object = JSON.stringify(object)
    this.__logToFile(object)
    if (this.verbosity >= 2) {
      console.log(this.__prefix('🤖  ', object))
    }
  }

  status (message) {
    this.__logToFile(message)
    if (this.verbosity >= 1) {
      console.log(this.__prefix('🤖  ', message))
    }
  }

  warning (message) {
    message = 'WARNING\n' + this.__preprocess(message)
    this.__logToFile(message)
    if (this.verbosity >= 0) {
      console.error(this.__prefix('⚠️  ', message))
    }
  }

  error (message) {
    message = 'ERROR\n' + this.__preprocess(message)
    this.__logToFile(message)
    if (this.verbosity >= 0) {
      console.error(this.__prefix('❌  ', message))
      process.exit(1)
    }
  }
}

exports.Logger = Logger

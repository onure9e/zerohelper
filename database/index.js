var jsonDatabasse = require('./jsondatabase/index')
var MongoDB = require('./mongodb/index')
var MySQL = require('./mysql/index')

module.exports = {
    JsonDatabase:  jsonDatabasse,
    MongoDB,
    MySQLDatabase:MySQL
}
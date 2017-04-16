#!/usr/bin/env node

const prog = require('caporal')
const os = require('os')
const bluebird = require('bluebird')
const _ = require('lodash')
const fs = bluebird.promisifyAll(require('fs'))
var sqlite3 = require('sqlite3').verbose();
const rm = require('find-remove')
const isValidPath = require('is-valid-path')

let db = new sqlite3.cached.Database('nodes.sqlite')
let sum = 0;

// get the HOME path of the machine
const home = os.homedir()

const nodeDefinitions = {
  connect: "",
  bind: "127.0.0.1",
  server: "1",
  listen: "1",
  daemon: "1",
  debug: "1",
  shrinkdebuglog: "1",
  listenonion: "0",
  maxconnections: "125",
  port: "",
  rpcuser: "",
  rpcpassword: "",
  rpcport: "",
  rpcallowip: "127.0.0.1",
  prune: 551
}

prog
  .version('1.0.0')
  // you specify arguments using .argument()
  // 'app' is required, 'env' is optional
  .command('init', 'Setup the entire bitcoin node network')
  .argument('<nodes>', 'Number of nodes', prog.INT)
  .argument('<port>', 'Starting port', prog.INT)
  .argument('<rpcport>', 'Starting RPC port', prog.INT)
  .argument('<masterip>', 'RPC ip of master node')
  .argument('<rpcmasterport>', 'RPC port of master node', prog.INT)
  .argument('[probability]', 'Nodes probability configuration to mine the next block', function(opt) {
    if (!isValidPath(opt)) {
      throw new Error("[Probability] argument must be a valid path");
    }
    return opt;
  }, 'default')
  .argument('[rpcuser]', 'RPC user (default: root)', /^[a-zA-Z0-9]*$/, 'root')
  .argument('[rpcpassword]', 'RPC password (default: root)', /^[a-zA-Z0-9]*$/, 'root')
  .argument('[rpcmasteruser]', 'RPC username of the master node', /^[a-zA-Z0-9]*$/, 'root')
  .argument('[rpcmasterpassword]', 'RPC password of the master node', /^[a-zA-Z0-9]*$/, 'root')
  .action(function(args, options, logger) {

    logger.info("Deleting previous Network folder if any ...")

    const result = rm(home + '/Network', {
      dir: "*",
      files: "*.*"
    })

    db.serialize(function() {
      db.run("DROP TABLE IF EXISTS Node")
      db.run("DROP TABLE IF EXISTS Master")
      db.run("CREATE TABLE Node (id INT, port INT, rpcusername VARCHAR(255), rpcpassword VARCHAR(255), rpcport INT, probability INT, active INT, bitcoind TEXT, bitcoincli TEXT)")
      db.run("CREATE TABLE Master (id INT, ip VARCHAR(255), rpcusername VARCHAR(255), rpcpassword VARCHAR(255), rpcport INT)")
    })

    let stmt = db.prepare("INSERT INTO Master VALUES (?, ?, ?, ?, ?)")
    stmt.run(1, args['masterip'], args['rpcmasteruser'], args['rpcmasterpassword'], args['rpcmasterport'])
    stmt.finalize()

    logger.info("Deleting all the entries in sqlite ...")

    if (!fs.existsSync(home + '/Network'))
      fs.mkdirSync(home + '/Network/')
    fs.mkdirSync(home + '/Network/Nodes')

    let probabilities = {}

    if (args['probability'] != 'default') {
      probabilities = JSON.parse(require('fs').readFileSync(args['probability'], 'utf8'));
    }

    let promises = []

    logger.info("Starting creating all the nodes folders ...")

    for (let i = 0; i < args.nodes; i++) {
      promises.push(createNode(home, i, args, nodeDefinitions, probabilities))
    }

    bluebird.all(promises)
      .then(res => {
        // db.close()
        logger.info("Done.")
      })
      .catch(res => console.log(res))
  });


// Create a new node (Directory and config)
function createNode(home, id, options, node, probabilities) {
  return new Promise(function(resolve, reject) {
    fs.mkdirSync(home + '/Network/Nodes/' + id)
    fs.closeSync(fs.openSync(home + '/Network/Nodes/' + id + "/bitcoin.conf", 'w'));
    createConfig(home + '/Network/Nodes/' + id + "/bitcoin.conf", id, options, node, probabilities)
    resolve('Nodes ' + id + " created.")
  });
}

// Write config data on file
function createConfig(path, id, options, node, probabilities) {
  let writer = fs.createWriteStream(path, {
    flags: 'a'
  })
  for (var key in node) {
    if (node[key] != "")
      writer.write(key + "=" + node[key] + '\n')
    else
      writer.write(costumConfigField(key, options, id))
  }
  for (var i = 0; i < options.nodes; i++) {
    if (i != id)
      writer.write('connect' + '=127.0.0.1:' + (options['port'] + i) + '\n')
  }
  const keys = Object.keys(probabilities)
  let stmt = db.prepare("INSERT INTO Node VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")

  if(keys.length > 0) {
    for (key of keys) {
      if (id >= key.split('..')[0] && id <= key.split('..')[1]) {
        sum += probabilities[key];
        stmt.run(id, options['port'] + id, options['rpcuser'], options['rpcpassword'], options['rpcport'] + id, probabilities[key], 0, "bitcoind -daemon -conf=$HOME/Network/Nodes/" + id + "/bitcoin.conf -datadir=$HOME/Network/Nodes/" + id + " -pid=$HOME/Network/Nodes/" + id + "/.pid -debug", "bitcoin-cli -rpcconnect=127.0.0.1 -rpcport=" + (options['rpcport'] + id) + " -rpcuser=" + options['rpcuser'] + " -rpcpassword=" + options['rpcpassword'])
      }
    }
  } else {
    stmt.run(id, options['port'] + id, options['rpcuser'], options['rpcpassword'], options['rpcport'] + id, 1, 0, "bitcoind -daemon -conf=$HOME/Network/Nodes/" + id + "/bitcoin.conf -datadir=$HOME/Network/Nodes/" + id + " -pid=$HOME/Network/Nodes/" + id + "/.pid -debug", "bitcoin-cli -rpcconnect=127.0.0.1 -rpcport=" + (options['rpcport'] + id) + " -rpcuser=" + options['rpcuser'] + " -rpcpassword=" + options['rpcpassword'])
  }
  stmt.finalize()
  writer.end()
}

// Custom field generation
function costumConfigField(key, options, id) {
  switch (key) {
    case "rpcuser":
      return (key + "=" + options['rpcuser'] + '\n')
    case "rpcpassword":
      return (key + "=" + options['rpcpassword'] + '\n')
    case "rpcport":
      return (key + "=" + (options['rpcport'] + id) + '\n')
    case "port":
      return (key + "=" + (options['port'] + id) + '\n')
    default:
      return ""
  }
}

prog.parse(process.argv)

#!/usr/bin/env node

const prog = require('caporal')
const os = require('os')
const bluebird = require('bluebird')
const _ = require('lodash')
const fs = bluebird.promisifyAll(require('fs'))
const redis = require('redis')
var sqlite3 = require('sqlite3').verbose();
const rm = require('find-remove')

let db = new sqlite3.cached.Database('nodes_sqlite');

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
  // txindex: "1",
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
  .argument('[rpcuser]', 'RPC user (default: root)', /^[a-zA-Z0-9]*$/, 'root')
  .argument('[rpcpassword]', 'RPC password (default: root)', /^[a-zA-Z0-9]*$/, 'root')
  .argument('[rpcmasteruser]', 'RPC username of the master node', /^[a-zA-Z0-9]*$/, 'root')
  .argument('[rpcmasterpassword]', 'RPC password of the master node', /^[a-zA-Z0-9]*$/, 'root')
  .action(function(args, options, logger) {

    logger.info("Deleting previous Network folder if any ...");

    const result = rm(home + '/NetworkTest', {
      dir: "*",
      files: "*.*"
    })

    db.serialize(function() {
      db.run("DROP TABLE IF EXISTS Node");
      db.run("DROP TABLE IF EXISTS Master");
      db.run("CREATE TABLE Node (port INT, rpcusername VARCHAR(255), rpcpassword VARCHAR(255), rpcport INT, bitcoind TEXT, bitcoincli TEXT);")
      db.run("CREATE TABLE Master (ip VARCHAR(255), rpcusername VARCHAR(255), rpcpassword VARCHAR(255), rpcport INT);")
    })

    let stmt = db.prepare("INSERT INTO Master VALUES (?, ?, ?, ?)")
    stmt.run(args['masterip'], args['rpcmasteruser'], args['rpcmasterpassword'], args['rpcmasterport'])
    stmt.finalize()

    logger.info("Deleting all the entries in redis db ...");

    if (!fs.existsSync(home + '/NetworkTest'))
      fs.mkdirSync(home + '/NetworkTest/')
    fs.mkdirSync(home + '/NetworkTest/Nodes')

    let promises = [];

    logger.info("Starting creating all the nodes folders ...");

    for (let i = 0; i < args.nodes; i++) {
      promises.push(createNode(home, i, args, nodeDefinitions))
    }

    bluebird.all(promises)
      .then(res => {
        db.close()
        logger.info("Done.")
      })
      .catch(res => console.log(res))
  });


// Create a new node (Directory and config)
function createNode(home, name, options, node) {
  return new Promise(function(resolve, reject) {
    fs.mkdirSync(home + '/NetworkTest/Nodes/' + name)
    fs.closeSync(fs.openSync(home + '/NetworkTest/Nodes/' + name + "/bitcoin.conf", 'w'));
    createConfig(home + '/NetworkTest/Nodes/' + name + "/bitcoin.conf", name, options, node)
    resolve('Nodes ' + name + " created.")
  });
}

// Write config data on file
function createConfig(path, name, options, node) {
  let writer = fs.createWriteStream(path, {
    flags: 'a' // 'a' means appending (old data will be preserved)
  })
  for (var key in node) {
    if (node[key] != "")
      writer.write(key + "=" + node[key] + '\n')
    else
      writer.write(costumConfigField(key, options, name))
  }
  for (var i = 0; i < options.nodes; i++) {
    if (i != name)
      writer.write('connect' + '=127.0.0.1:' + (options['port'] + i) + '\n')
  }

  let stmt = db.prepare("INSERT INTO Node VALUES (?, ?, ?, ?, ?, ?)")
  stmt.run(options['rpcport'] + name, options['rpcuser'], options['rpcpassword'], options['port'] + name, "bitcoind -daemon -conf=$HOME/NetworkTest/Nodes/" + name + "/bitcoin.conf -datadir=$HOME/NetworkTest/Nodes/" + name + " -pid=$HOME/NetworkTest/Nodes/" + name + "/.pid -debug", "bitcoin-cli -rpcconnect=127.0.0.1 -rpcport=" + (options['rpcport'] + name) + " -rpcuser=" + options['rpcuser'] + " -rpcpassword=" + options['rpcpassword'])
  stmt.finalize()

  writer.end()
}

// Custom field generation
function costumConfigField(key, options, name) {
  switch (key) {
    case "rpcuser":
      return (key + "=" + options['rpcuser'] + '\n')
    case "rpcpassword":
      return (key + "=" + options['rpcpassword'] + '\n')
    case "rpcport":
      return (key + "=" + (options['rpcport'] + name) + '\n')
    case "port":
      return (key + "=" + (options['port'] + name) + '\n')
    default:
      return ""
  }
}

prog.parse(process.argv);

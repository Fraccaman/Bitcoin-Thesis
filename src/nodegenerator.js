#!/usr/bin/env node

const prog = require('caporal')
const os = require('os')
const bluebird = require('bluebird')
const _ = require('lodash')
const fs = bluebird.promisifyAll(require('fs'))
const redis = require('redis')
const rm = require('find-remove')

// get the HOME path of the machine
const home = os.homedir()

const optionDefinitions = [{
    name: 'nodes',
    type: Number,
    alias: 'n'
  },
  {
    name: 'port',
    type: Number,
    alias: 'p'
  },
  {
    name: 'log',
    type: Boolean,
    alias: 'l',
    defaultOption: true
  },
  {
    name: 'rpcuser',
    type: String
  },
  {
    name: 'rpcpassword',
    type: String
  },
  {
    name: 'rpcport',
    type: Number
  }
]

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
  txindex: "1"
}

prog
  .version('1.0.0')
  // you specify arguments using .argument()
  // 'app' is required, 'env' is optional
  .command('init', 'Setup the entire bitcoin node network')
  .argument('<nodes>', 'Number of nodes', prog.INT)
  .argument('<port>', 'Starting port', prog.INT)
  .argument('<rpcport>', 'Starting RPC port', prog.INT)
  .argument('[rpcuser]', 'RPC user (default: root)', /^[a-zA-Z0-9]*$/, 'root')
  .argument('[rpcpassword]', 'RPC password (default: root)', /^[a-zA-Z0-9]*$/, 'root')
  .action(function(args, options, logger) {

    let client = redis.createClient()

    logger.info("Deleting previous Network folder if any ...");

    const result = rm(home + '/Network', {
      dir: "*",
      files: "*.*"
    })

    client.flushdb(function(err, succeeded) {});

    logger.info("Deleting all the entries in redis db ...");

    if (!fs.existsSync(home + '/Network'))
      fs.mkdirSync(home + '/Network/')
    fs.mkdirSync(home + '/Network/Nodes')

    let promises = [];

    logger.info("Starting creating all the nodes folders ...");

    for (let i = 0; i < args.nodes; i++) {
      promises.push(createNode(home, i, args, nodeDefinitions, client))
    }

    bluebird.all(promises).then(res => client.quit()).catch(res => console.log(res))

    logger.info("Done.");
  });


// Create a new node (Directory and config)
function createNode(home, name, options, node, client) {
  return new Promise(function(resolve, reject) {
    fs.mkdirSync(home + '/Network/Nodes/' + name)
    fs.closeSync(fs.openSync(home + '/Network/Nodes/' + name + "/bitcoin.conf", 'w'));
    createConfig(home + '/Network/Nodes/' + name + "/bitcoin.conf", name, options, node, client)
    resolve('Nodes ' + name + " created.")
  });
}

// Write config data on file
function createConfig(path, name, options, node, client) {
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
  client.set(name, JSON.stringify({
    rpcport: (options['rpcport'] + name),
    port: (options['port'] + name),
    bitcoind: "bitcoind -daemon -conf=$HOME/Network/Nodes/" + name + "/bitcoin.conf -datadir=$HOME/Network/Nodes/" + name + " -pid=$HOME/Network/Nodes/" + name + "/.pid -debug",
    bitcoincli: "bitcoin-cli -rpcconnect=127.0.0.1 -rpcport=" + (options['rpcport'] + name) + " -rpcuser=" + options['rpcuser'] + " -rpcpassword=" + options['rpcpassword']
  }));
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

#!/usr/local/bin/node
import commandLineArgs from 'command-line-args'
import redis from 'redis'
import bluebird from 'bluebird'
import fsSync from 'fs'
import os from 'os'
import path from 'path'
import exec from 'child_process'
import rm from 'find-remove'

let fs = bluebird.promisifyAll(fsSync)

// General definitions

const home = os.homedir()

const optionDefinitions = [
  { name: 'nodes', type: Number, alias: 'n' },
  { name: 'port', type: Number, alias: 'p' },
  { name: 'log', type: Boolean, alias: 'l', defaultOption: true },
  { name: 'rpcuser', type: String },
  { name: 'rpcpassword', type: String },
  { name: 'rpcport', type: Number }
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

const options = commandLineArgs(optionDefinitions)

let client = redis.createClient()

// Delete old directories

var result = rm(home + '/Network', {dir: "*", files: "*.*"})

// Start building the enviroment

if(!fs.existsSync(home + '/Network'))
  fs.mkdirSync(home + '/Network/')
fs.mkdirSync(home + '/Network/Nodes')

let promises = [];

for(let i = 0; i < options.nodes; i++){
  promises.push(createNode(home, i, options, nodeDefinitions))
}

bluebird.all(promises).then(res => console.log('Directories created.').catch(res => console.log(res)))

// Create a new node (Directory and config)
function createNode(home, name, options, node) {
    return new Promise(function (resolve, reject) {
        fs.mkdirSync(home + '/Network/Nodes/' + name)
        fs.closeSync(fs.openSync(home + '/Network/Nodes/' + name + "/bitcoin.conf", 'w'));
        createConfig(home + '/Network/Nodes/' + name + "/bitcoin.conf", name, options, node)
    });
}

// Write config data on file
function createConfig(path, name, options, node){
  let logger = fs.createWriteStream(path, {
    flags: 'a' // 'a' means appending (old data will be preserved)
  })
  for (var key in node) {
    if(node[key] != "")
      logger.write(key + "=" + node[key] + '\n')
    else
      logger.write(costumConfigField(key, options, name))
  }
  for (var i = 0; i < options.nodes; i++) {
    if(i != name)
      logger.write('connect' + '=127.0.0.1:' + (options['port'] + i) + '\n')
  }
  client.set(name, JSON.stringify({
    rpcport: (options['rpcport'] + name),
    port: (options['port'] + name),
    bitcoind: "-daemon -conf=$HOME/Network/Nodes/" + name + "/bitcoin.conf -datadir=$HOME/Network/Nodes/" + name + " -pid=$HOME/Network/Nodes/" + name + "/.pid -debug",
    bitcoincli: "-rpcconnect=127.0.0.1 -rpcport=" + (options['rpcport'] + name) + " -rpcuser=" + options['rpcuser'] + " -rpcpassword=" + options['rpcpassword']
  }));
  logger.end()
}

// Custom field generation
function costumConfigField(key, options, name){
  switch(key) {
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

client.quit()

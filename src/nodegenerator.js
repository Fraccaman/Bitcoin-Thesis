#!/usr/bin/env node

const prog = require('caporal')
const os = require('os')
const bluebird = require('bluebird')
const _ = require('lodash')
const fs = bluebird.promisifyAll(require('fs'))
var sqlite3 = require('sqlite3').verbose();
const rm = require('find-remove')
const isValidPath = require('is-valid-path')
const csv = require('csvtojson')
const WeightedList = require('js-weighted-list')
const sleep = require('sleep')
var loader = require('csv-load-sync')
const path = require('path')
const LineByLineReader = require('line-by-line')

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
  .argument('[probability]', 'Nodes probability configuration for mining election', function(opt) {
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
      db.run("CREATE TABLE Node (id INT, port INT, rpcusername VARCHAR(255), rpcpassword VARCHAR(255), rpcport INT, probability INT, active INT, bitcoind TEXT, bitcoincli TEXT, zone TEXT)")
      db.run("CREATE TABLE Master (id INT, ip VARCHAR(255), rpcusername VARCHAR(255), rpcpassword VARCHAR(255), rpcport INT)")
    })

    let stmt = db.prepare("INSERT INTO Master VALUES (?, ?, ?, ?, ?)")
    stmt.run(1, args['masterip'], args['rpcmasteruser'], args['rpcmasterpassword'], args['rpcmasterport'])
    stmt.finalize()

    logger.info("Deleting all the entries in sqlite ...")

    if (!fs.existsSync(home + '/Network'))
      fs.mkdirSync(home + '/Network/')
    fs.mkdirSync(home + '/Network/Nodes')

    let probabilities

    if (args['probability'] != 'default') {
      probabilities = loader(args['probability'])
    }

    const latencyMatrixPath = 'latencies.conf'
    const nodesDistribution = 'nodesDistribution.conf'
    let matrix = []
    let list = []

    csv({
        noheader: true
      })
      .fromFile(nodesDistribution)
      .on('json', (jsonObj) => {
        list.push(jsonObj)
      })
      .on('done', (error) => {
        var fData = list.map(function(item) {
          return [item.field1, Math.ceil(item.field2)]
        })
        console.log(fData);
        let test = new WeightedList(fData)
        let promises = []
        for (let i = 0; i < args.nodes; i++) {
          promises.push(createNode(home, i, args, nodeDefinitions, probabilities, test))
        }
        logger.info("Starting creating all the nodes folders ...")
        bluebird.all(promises)
          .then(res => {
            // db.close()
            logger.info("Done.")
          })
          .catch(res => console.log(res))
      })

  })
  .command('data', 'get data')
  .action(function(args, options, logger) {
    let nodesinfo = {}
    const dirs = fs.readdirSync(home + '/Network/Nodes').filter(file => fs.lstatSync(path.join(home + '/Network/Nodes', file)).isDirectory())
    for (var i = 0; i < dirs.length; i++) {
      nodesinfo[19500 + i] = []
    }
    let counter = 0
    for (let i = 0; i < dirs.length; i++) {
      lr = new LineByLineReader(home + '/Network/Nodes/' + dirs[i] + '/bitcoin.conf')

      lr.on('error', function(err) {
        console.log("scoppiato tutto pddc", err);
      })

      lr.on('line', function(line) {
        if (line.includes('connect=')) {
          nodesinfo[parseInt(line.split('=')[1].split(':')[1])].push(12600 + i)
        }
      })

      lr.on('end', function() {
        if (counter == (dirs.length -1)) {
          if (fs.existsSync(home + "/testino.csv")) fs.unlinkSync(home + "/testino.csv");
          fs.appendFileSync(home + "/testino.csv", 0 + ', ' + 0 + "\n");
          for (var i = 0; i < Object.keys(nodesinfo).length; i++) {
            fs.appendFileSync(home + "/testino.csv", i + ', ' + nodesinfo[Object.keys(nodesinfo)[i]].length + "\n");
          }
        } else {
          counter++
        }
      });
    }
    let distr = {}
    if (fs.existsSync(home + "/testino2.csv")) fs.unlinkSync(home + "/testino2.csv");
    getAllNodes().then(res => {
      for (node of res) {
        if(distr[node.zone])
          distr[node.zone] += 1
        else {
          distr[node.zone] = 1
        }
      }
      fs.appendFileSync(home + "/testino2.csv", 0 + ', ' + 0 + "\n");
      for (var i = 0; i < Object.keys(distr).length; i++) {
        fs.appendFileSync(home + "/testino2.csv", Object.keys(distr)[i] + ', ' + distr[Object.keys(distr)[i]] + "\n");
      }
    })
  })


// Create a new node (Directory and config)
function createNode(home, id, options, node, probabilities, zones) {
  return new Promise(function(resolve, reject) {
    fs.mkdirSync(home + '/Network/Nodes/' + id)
    fs.closeSync(fs.openSync(home + '/Network/Nodes/' + id + "/bitcoin.conf", 'w'));
    createConfig(home + '/Network/Nodes/' + id + "/bitcoin.conf", id, options, node, probabilities, zones)
    resolve('Nodes ' + id + " created.")
  });
}

// Write config data on file
function createConfig(path, id, options, node, probabilities, zone) {
  let writer = fs.createWriteStream(path, {
    flags: 'a'
  })
  for (var key in node) {
    if (node[key] != "")
      writer.write(key + "=" + node[key] + '\n')
    else
      writer.write(costumConfigField(key, options, id))
  }
  let already = []
  for (var i = 0; i <= Math.min(options.nodes, 8); i++) {
    if (i != id) {
      if (options.nodes < 8) {
        writer.write('connect' + '=127.0.0.1:' + (options['port'] + i) + '\n')
      } else {
        let id = Math.floor(Math.random() * (options.nodes - 0) + 0)
        while (already.includes(id)) {
          already.push(id)
          id = Math.floor(Math.random() * (options.nodes - 0) + 0)
        }
        already.push(id)
        writer.write('connect' + '=127.0.0.1:' + (options['port'] + id) + '\n')
      }
    }
  }
  const keys = probabilities != undefined ? Object.keys(probabilities) : []
  let stmt = db.prepare("INSERT INTO Node VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")

  let z = zone.peek()[0]
  let p = 0

  for (prob of probabilities) {
    if (prob.Zone == z) {
      p = prob.Hash;
      break
    }
  }

  if (p > 0) {
    stmt.run(id, options['port'] + id, options['rpcuser'], options['rpcpassword'], options['rpcport'] + id, p, 0, "bitcoind -daemon -conf=$HOME/Network/Nodes/" + id + "/bitcoin.conf -datadir=$HOME/Network/Nodes/" + id + " -pid=$HOME/Network/Nodes/" + id + "/.pid -debug", "bitcoin-cli -rpcconnect=127.0.0.1 -rpcport=" + (options['rpcport'] + id) + " -rpcuser=" + options['rpcuser'] + " -rpcpassword=" + options['rpcpassword'], z)
  } else {
    stmt.run(id, options['port'] + id, options['rpcuser'], options['rpcpassword'], options['rpcport'] + id, 1, 0, "bitcoind -daemon -conf=$HOME/Network/Nodes/" + id + "/bitcoin.conf -datadir=$HOME/Network/Nodes/" + id + " -pid=$HOME/Network/Nodes/" + id + "/.pid -debug", "bitcoin-cli -rpcconnect=127.0.0.1 -rpcport=" + (options['rpcport'] + id) + " -rpcuser=" + options['rpcuser'] + " -rpcpassword=" + options['rpcpassword'], z)
  }
  stmt.finalize()
  writer.end()
}

function getAllNodes() {
  return new Promise(function(resolve, reject) {
    db.all('SELECT * FROM Node', function(err, res) {
      if (err)
        return reject(err)
      resolve(res)
    })
  })
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

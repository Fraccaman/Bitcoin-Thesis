#!/usr/bin/env node

const prog = require('caporal')
const bluebird = require('bluebird')
const run = require('pshell')
const sqlite3 = require('sqlite3').verbose()
const WeightedList = require('js-weighted-list')
const prettyjson = require('prettyjson')
const axios = require('axios')
const crypto = require('crypto')

let db = new sqlite3.cached.Database('nodes.sqlite')

prog
  .version('1.0.0')

  /**
   * Command to start all non-running nodes
   */

  .command('startall', 'Start the entire network')
  .option('--reindex', 'Reindex the chain', prog.BOOL, false)
  .action(function(args, options, logger) {
    getAllDisabledNodeInfo()
      .then(res => {
        res.forEach(value => {
          run(value.bitcoind + (options.reindex ? ' --reindex' : ''), {
              echoCommand: false,
              captureOutput: true
            })
            .then(_ => {
              turnNodeOnOff(value.id, 1)
              console.log('Node ' + value.id + ' is running in background.')
            })
            .catch(err => {
              logger.error('Err: ' + err)
            })
        })
      })
      .catch(err => {
        console.log('Err: ' + err)
        db.close()
      })
  })

  /**
   * Command to start a node by giving his ID
   */

  .command('start', 'Start a single node')
  .argument('<node>', 'Node id to start', prog.INT)
  .option('--reindex', 'Reindex the chain', prog.BOOL, false)
  .action(function(args, options, logger) {
    getNodeInfo(args.node)
      .then(res => {
        run(res.bitcoind + (options.reindex ? ' --reindex' : ''), {
            echoCommand: false,
            captureOutput: true
          })
          .then(res => {
            turnNodeOnOff(res.id, 1)
            logger.info('Node ' + args['node'] + ' is running in background.');
          })
          .catch(err => {
            logger.info('Err: ', err);
          })
      })
  })

  /**
   * Command to stop all running nodes.
   */

  .command('stopall', 'Stop the entire network')
  .action(function(args, options, logger) {
    getAllActiveNodeInfo()
      .then(res => {
        res.forEach(client => {
          sendRpcRequest('127.0.0.1', client.rpcport, client.rpcusername, client.rpcpassword, 'stop')
            .then(res => {
              turnNodeOnOff(client.id, 0)
              console.log('Node ' + client.id + ': ' + res.data.result);
            })
            .catch(err => {
              console.log('Error: ' + err.code);
            })
        })
      })
      .catch(err => {
        console.log('Err: ' + err)
        db.close()
      })
  })

  /**
   * Command to stop a running node by ID.
   */

  .command('stop', 'Stop a single node')
  .argument('<node>', 'Node id to stop', prog.INT)
  .action(function(args, options, logger) {
    getNodeInfo(args.node)
      .then(client => {
        sendRpcRequest('127.0.0.1', client.rpcport, client.rpcusername, client.rpcpassword, 'stop')
          .then(res => {
            turnNodeOnOff(client.id, 0)
            console.log('Node ' + client.id + ': ' + res.data.result);
          })
          .catch(err => {
            console.log('Error: ' + err);
          })
      })
  })

  /**
   * Command to show all nodes in the network.
   * @param {active} --active - Display only running nodes.
   */

  .command('showall', 'Pretty print all nodes info in the network')
  .option('--active', 'Show only running node in the network', prog.BOOL, false)
  .action(function(args, options, logger) {
    if (!options.active) {
      getAllNodes()
        .then(res => {
          console.log(prettyjson.render({
            'Number of nodes': res.length
          }, {
            noColor: false
          }));
          console.log("-------------------------------------------");
          res.forEach(value => {
            delete value['bitcoind']
            delete value['bitcoincli']
            console.log(prettyjson.render(value, {
              noColor: false
            }));
            console.log("-------------------------------------------");
          })
          db.close()
        })
        .catch(err => {
          console.log('Err: ' + err)
          db.close()
        })
    } else {
      getAllActiveNodeInfo()
        .then(res => {
          if (res == undefined) {
            console.log("There are no active nodes.");
            return
          }
          console.log(prettyjson.render({
            'Number of active nodes': res.length
          }, {
            noColor: false
          }));
          console.log("-------------------------------------------");
          res.forEach(function(value) {
            delete value['bitcoind']
            delete value['bitcoincli']
            console.log(prettyjson.render(value, {
              noColor: false
            }));
            console.log("-------------------------------------------");
          })
          db.close()
        })
        .catch(err => {
          console.log('Err: ' + err)
          db.close()
        })
    }
  })

  /**
   * Iteract with a node seding commands.
   * @param {Int} node - the ID of the node receiving the command
   * @param {op} command - the command to be executed on the node
   * @param {params} paramters - optional paramters
   */

  .command('command', 'Send a command via RPC to a node by ID (use sendtx / sendblk to send transactions / blocks)')
  .argument('<node>', 'Node id that receive the command', prog.INT)
  .argument('<op>', 'Command to run on node <node>', /^((?!sendrawtransaction).)*$/)
  .argument('[params...]', 'Parameters for <op>')
  .action(function(args, options, logger) {
    getNodeInfo(args.node)
      .then(client => {
        sendRpcRequest('127.0.0.1', client.rpcport, client.rpcusername, client.rpcpassword, args.op, args.params)
          .then(res => {
            // console.log(prettyjson.render(res.data.result));
            console.log(res.data.result);
          })
          .catch(err => {
            console.log('Error: ' + err);
          })
      })
      .catch(res => console.log(res))
  })

  /**
   * Iteract with a node to send a transaction.
   * @param {Int} node - the ID of the node receiving the command
   * @param {string} hex - the HEX encoded string of the transaction
   */

  .command('sendtx', 'Send a transaction via RPC from a node by ID')
  .argument('<node>', 'Node ID', prog.INT)
  .argument('<hex>', 'Transaction hex format')
  .action(function(args, options, logger) {
    getNodeInfo(args.node)
      .then(res => {
        sendRpcRequest('127.0.0.1', res.rpcport, res.rpcusername, res.rpcpassword, 'sendrawtransaction', args.hex)
          .then(res => {
            console.log(prettyjson.render(res.data.result));
          })
          .catch(err => {
            console.log('Error: ' + err);
          })
      })
      .catch(res => console.log(res))
  })

  /**
   * Send a command to mine the next block.
   * @param {Int} node - optional paramter to choose the node that will mine the block
   */

  .command('mine', 'Mine and submit a block. If [node] is empty a random node will be choosen based on a weighted probability.')
  .argument('[node]', 'Node ID', prog.INT)
  .action(function(args, options, logger) {
    // if a node ID is passed as argument, we don't need to choose the the miner
    if (args.node != undefined && args.node != null) {
      getNodeInfo(args.node)
        .then(res => {
          run('python src/ntgbtminer.py ' + res.rpcport + ' ' + res.rpcusername + ' ' + res.rpcpassword, {
              echoCommand: false,
              captureOutput: true
            })
            .then(res => {
              console.log(res.stdout.trim())
            })
            .catch(err => {
              console.log(err.message)
            })
        })
    } else {
      getAllNodes()
        .then(res => {
          // get the next miner
          let minerList = []
          const weightedList = buildWeightedList(res)
          let nextMiner = getNextMiner(weightedList)
          // add miner to miner list
          minerList.push(mineBlock(res[nextMiner].rpcport, res[nextMiner].rpcusername, res[nextMiner].rpcpassword))
          console.log('Next miner: ' + nextMiner)
          // check if an orphan is generated
          const nOfOrphans = isOrphanGenerated()
          console.log('N. of orphans: ' + nOfOrphans)
          for (var i = 0; i < nOfOrphans; i++) {
            nextMiner = getNextMiner(weightedList)
            minerList.push(mineBlock(res[nextMiner].rpcport, res[nextMiner].rpcusername, res[nextMiner].rpcpassword))
          }
          bluebird.all(minerList)
            .then(res => console.log(res))
            .catch(res => console.log(res))
        })
        .catch(err => console.log(err))
    }
  })

// Return all the nodes in the network
function getAllNodes() {
  return new Promise(function(resolve, reject) {
    db.all('SELECT * FROM Node', function(err, res) {
      if (err)
        return reject(err)
      resolve(res)
    })
  })
}

// Return a single node by ID
function getNodeInfo(node) {
  return new Promise(function(resolve, reject) {
    db.get('SELECT * FROM Node WHERE id = ?', [node], function(err, row) {
      if (err)
        return reject(err)
      resolve(row)
    })
  })
}

// Return all the running nodes
function getAllActiveNodeInfo() {
  return new Promise(function(resolve, reject) {
    db.all('SELECT * FROM Node WHERE active = 1', function(err, rows) {
      if (err)
        return reject(err)
      resolve(rows)
    })
  })
}

// Return all the disabled nodes
function getAllDisabledNodeInfo() {
  return new Promise(function(resolve, reject) {
    db.all('SELECT * FROM Node WHERE active = 0', function(err, rows) {
      if (err)
        return reject(err)
      resolve(rows)
    })
  })
}

// Set a node proriety as running / shutdown
function turnNodeOnOff(node, status) {
  return new Promise(function(resolve, reject) {
    db.get('UPDATE Node SET active = ? WHERE id = ?', [status, node], function(err, rows) {
      if (err)
        return reject(err)
      resolve(rows)
    })
  })
}

// generate a random value
function randomValueHex(len) {
  return crypto.randomBytes(Math.ceil(len / 2))
    .toString('hex')
    .slice(0, len)
}

// return a flatten array where number are casted to Num
function normalizeParams(params) {
  return params[0] != undefined && params[0].length > 0 ?
    params.reduce(function iter(r, a) {
      if (!isNaN(a)) {
        return r.concat(parseInt(a));
      }
      return r.concat(a);
    }, []) : []
}

function buildWeightedList(data) {
  var fData = data.map(function(item) {
    return [item.id, item.probability]
  })
  return new WeightedList(fData)
}

function getNextMiner(weightedList) {
  return weightedList.pop()[0]
}

function isOrphanGenerated() {
  probabilitiesOrphans = JSON.parse(require('fs').readFileSync('orphan.conf', 'utf8'))
  const wl = new WeightedList(Object.entries(probabilitiesOrphans))
  return wl.peek()[0]
}

function mineBlock(port, username, password) {
  return new Promise(function(resolve, reject) {
    run('python src/ntgbtminer.py ' + port + ' ' + username + ' ' + password, {
        echoCommand: false,
        captureOutput: true
      })
      .then(res => {
        console.log('Start time for node with port ' + port + ': ' + process.hrtime())
        resolve(res.stdout.trim())
      })
      .catch(err => {
        reject(err.message)
      })
  })
}

// send a request to one of the miner
function sendRpcRequest(ip, port, user, password, method, ...params) {
  return new Promise(function(resolve, reject) {
    axios({
        method: 'post',
        url: 'http://' + ip + ':' + port,
        headers: {
          'content-type': 'text/plain'
        },
        data: {
          jsonrpc: '1.0',
          id: randomValueHex(2),
          method: method,
          params: normalizeParams(params)
        },
        auth: {
          username: user,
          password: password
        }
      })
      .then(res => resolve(res))
      .catch(err => {
        console.log("Rpc error: " + err)
        reject(err)
      })
  })
}

prog.parse(process.argv);

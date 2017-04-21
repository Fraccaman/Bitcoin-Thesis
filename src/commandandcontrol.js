#!/usr/bin/env node

const prog = require('caporal')
const run = require('pshell')
const sqlite3 = require('sqlite3').verbose()
const WeightedList = require('js-weighted-list')
const prettyjson = require('prettyjson')
const axios = require('axios')
const crypto = require('crypto')
const microstats = require('microstats')
const promiseLimit = require('promise-limit')
const sleep = require('system-sleep')
const _ = require('lodash')

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
            logger.info('Node ' + args.node + ' is running in background.');
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
            delete value.bitcoind
            delete value.bitcoincli
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
            delete value.bitcoind
            delete value.bitcoincli
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

  .command('commandall', 'Send a command via RPC to a node by ID (use sendtx / sendblk to send transactions / blocks)')
  .argument('<op>', 'Command to run on node <node>', /^((?!sendrawtransaction).)*$/)
  .argument('[params...]', 'Parameters for <op>')
  .action(function(args, options, logger) {
    getAllActiveNodeInfo()
      .then(clients => {
        for (client of clients) {
          sendRpcRequest('127.0.0.1', client.rpcport, client.rpcusername, client.rpcpassword, args.op, args.params)
            .then(res => {
              // console.log(prettyjson.render(res.data.result));
              console.log(res.data.result);
            })
            .catch(err => {
              console.log('Error: ' + err);
            })
        }
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
            console.log('Orphan Miner:' + nextMiner);
            minerList.push(mineBlock(res[nextMiner].rpcport, res[nextMiner].rpcusername, res[nextMiner].rpcpassword))
          }
          Promise.all(minerList)
            .then(res => console.log(res))
            .catch(res => console.log(res))
        })
        .catch(err => console.log(err))
    }
  })

  .command('sendnextblock', 'Send the next block')
  .argument('<height>', 'The height the framework need to start from', prog.INT)
  .argument('[node]', 'The node that will send the block', prog.INT)
  .action(async(args, options, logger) => {
    const master = await getMasterInfo()
    const nextBlockHex = await getNextBlockFromMaster(master, args.height, false)
    const node = await sendQuery('SELECT * FROM Node WHERE id = 0')
    await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'submitblock', nextBlockHex)
  })

  /**
   * Start collecting data with different protocol / network settings
   * @param {Int} nOfBlocks - required paramter describe on how many blocks the test should be done
   * @param {Int} blockSize - optional paramter describe the block size
   * @param {Int} interval - optional paramter describe the interval size
   * @param {Int} hashingConf - optional paramter path file describing the hashing power of nodes
   * @param {Int} orphanConf - optional paramter path to file describing the orphan rate
   * @param {Int} statusConf - optional paramter path to file describing the status probability
   */

  .command('run', 'Run the framework with with specific paramter')
  .argument('<nOfBlocks>', 'Number of blocks to test the protocol with', prog.INT)
  .argument('[height]', 'Custom height (testing) ', prog.INT)
  .argument('[crash]', 'Probability that a node crash [0-1]', prog.INT, 0)
  .argument('[restart]', 'Probability that a node restart from a shutdown [0-1]', prog.INT, 0)
  .argument('[blockSize]', 'Maximum size of a block in kilobyte', prog.INT, 1000)
  .argument('[interval]', 'Interval between blocks creation in seconds', prog.INT, 600)
  .argument('[rpcWorker]', 'Numbe of bitcoin rpc parallel handler', prog.INT, 16)
  .option('--alert', 'Alert on memory, cpu and disk usage (> 90%)')
  .action(async(args, options, logger) => {
    if (options.status) turnStatusAlert()
    if (!assertEnoughSpace()) process.exit(1)

    const currentHeight = args.height || await getNextHeight()
    const master = await getMasterInfo()

    const { tx: txList, time: blkTime, difficulty: blkDifficulty } = await getNextBlockFromMaster(master, currentHeight, true)
    let fullTxList = await buildFullTransaction(txList)
    // console.log('N. of txs: ' + txList.length);
    const coinbase = getCoinbase(fullTxList)

    let res = await sendTxs(fullTxList, args.blockSize)
    await mineNextBlock(coinbase)


    // const res = await sendTxs(master, txList, args.blockSize)

    // console.log(txList.length, blkTime, blkDifficulty);

    // const master = await getMasterInfo()
    // let height = args.height
    // const {
    //   tx: txList,
    //   time: blkTime
    // } = await getNextBlockFromMaster(master, args.height, true)
    // const coinbase = txList[0]
    // txList.shift()
    // const nOfTxSent = await sendTx(master, txList, args.blockSize)
    // console.log(nOfTxSent + ' over ' + txList.length);
    // const { time: txTime } = await getTransactionByTxId(master, txList[0])
    // const { hex: txHex, size: txSize, vin: coinbase } = await getTransactionByTxId(master, txList[0])

    // getTransactionByTxId(master, nextBlock.data.result.tx[0])
    //   .then(res => console.log(res.data.result))
  })

async function mineNextBlock(coinbase) {
  let hashingPowerNodes = await buildHashingPowerList()
  const nodeId = getNextMiner(hashingPowerNodes)
  const node = await getNodeInfo(nodeId)
  return new Promise(function(resolve, reject) {
    resolve(console.log('Node ' + node.id + ' is mining next block'))
    // run('python src/ntgbtminer.py ' + node.rpcport + ' ' + node.rpcusername + ' ' + node.rpcpassword, coinbase {
    //     echoCommand: false,
    //     captureOutput: true
    //   })
    //   .then(res => {
    //     console.log(res.stdout.trim())
    //   })
    //   .catch(err => {
    //     console.log(err.message)
    //   })
  })
}

function getCoinbase(fullTxList) {
  return fullTxList.shift()
}

async function buildHashingPowerList() {
  const data = await getAllActiveNodeInfo()
  var fData = data.map(function(item) {
    return [item.id, item.probability]
  })
  return new WeightedList(fData)
}

function getNextInterval(interval) {
  return marsagliaPolarMethod(interval, 8)
}

function getNextBlockSize(size) {
  return marsagliaPolarMethod(interval, 8)
}

function nodeWillCrash(probability) {
  return Math.random() < probability
}

function nodeWillRestart(probability) {
  return Math.random() < probability
}

async function getNextHeight() {
  const node = await sendQuery('SELECT * FROM Node WHERE id = 0')
  const res = await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getblockcount')
  return res.data.result
}

async function buildFullTransaction(txList) {
  const limit = promiseLimit(16)
  return new Promise(function(resolve, reject) {
    Promise.all(txList.map((tx) => {
      return limit(() => getTransactionByTxId(tx))
    })).then(fullTxList => {
      let sums = fullTxList.reduce(function(r, c, i) { r.push((r[i-1] || 0) + c.size); return r }, [] );
      let result = sums.map(function(val, index) { return { size: val, hex: fullTxList[index].hex } });
      resolve(result)
    })
    .catch(err => reject(err))
  })
}

function send(fullTxList) {
  return new Promise(function(resolve, reject) {

  })
}

async function sendTxs(fullTxList, size) {
  let maxSize = size * 1000
  let nOfTxSent = 0
  const row = await sendQuery('SELECT COALESCE(MAX(id), 0) as nOfNodes FROM Node')
  const limit = promiseLimit(16)

  return new Promise(function(resolve, reject) {
    Promise.all(fullTxList.map((tx) => {
      return limit(() => sendTx(tx, maxSize))
    })).then(results => resolve(console.log(results.length)))
    .catch(err => reject(err))
  })







  // for (let tx of txList) {
  //   try {
  //     const node = await sendQuery('SELECT * FROM Node WHERE id = ' + getRandomArbitrary(0, row.nOfNodes))
  //     console.log('Node ' + node.id + ' will send the tx ' + tx);
  //     const { hex: txHex, size: txSize, vin: coinbase } = await getTransactionByTxId(master, tx)
  //     // const res = await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'sendrawtransaction', txHex)
  //     maxSize -= txSize
  //     nOfTxSent++
  //   } catch (ex) {
  //     console.log(ex.response.data);
  //   }
  // }
  // return nOfTxSent
}

async function sendTx(tx, maxSize) {
  const row = await sendQuery('SELECT COALESCE(MAX(id), 0) as nOfNodes FROM Node')
  const node = await sendQuery('SELECT * FROM Node WHERE id = ' + getRandomArbitrary(0, row.nOfNodes))
  return new Promise(function(resolve, reject) {
    if (tx.size < maxSize)
      resolve(console.log('Node ' + node.id + ' will send the tx ' + tx + 'with total size of ' + tx.size));
      // sendRpcRequest(node.ip, node.rpcport, node.rpcusername, node.rpcpassword, 'sendrawtransaction', tx.hex)
      //   .then(res => resolve(res.data.result))
      //   .catch(err => reject(err))
    else resolve('Max size exceded.')
  })
}

function getRandomArbitrary(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

async function getTransactionByTxId(txId) {
  const master = await getMasterInfo()
  return new Promise(function(resolve, reject) {
    sendRpcRequest(master.ip, master.rpcport, master.rpcusername, master.rpcpassword, 'getrawtransaction', txId, true)
      .then(res => {
        resolve((({ hex, size }) => ({ hex, size }))(res.data.result))
      })
      .catch(err => reject(err))
  })
}

function getNextBlockFromMaster(master, currentHeight, isHex) {
  const height = ++currentHeight
  return new Promise(function(resolve, reject) {
    sendRpcRequest(master.ip, master.rpcport, master.rpcusername, master.rpcpassword, 'getblockhash', height.toString())
      .then(res => {
        return sendRpcRequest(master.ip, master.rpcport, master.rpcusername, master.rpcpassword, 'getblock', res.data.result, isHex)
      })
      .then(block => resolve(block.data.result))
      .catch(err => reject(err))
  })
}

function getMasterInfo() {
  return new Promise(function(resolve, reject) {
    db.get('SELECT * FROM Master', function(err, row) {
      if (err)
        return reject(err)
      resolve(row)
    })
  })
}

async function assertEnoughSpace() {
  const freeSpace = await checkDiskSpace()
  const row = await sendQuery('SELECT COALESCE(MAX(id)+1, 0) as nOfNodes FROM Node')
  // Im assuming 3 gigabytes are enough for every single node
  if (freeSpace < 3 * row.nOfNodes) {
    console.log('Not enough space.')
    return false
  }
  return true
}

function checkDiskSpace() {
  return new Promise(function(resolve, reject) {
    run('df -h | grep /dev/', {
        echoCommand: false,
        captureOutput: true
      })
      .then(res => {
        // get free gigabytes of space, parsing the stout
        resolve(res.stdout.trim().replace(/\s\s+/g, ' ').split(' ')[3].replace(/\D+/g, ''))
      })
      .catch(err => {
        console.log(err);
        reject(err.message)
      })
  })
}

function turnStatusAlert() {
  microstats.on('memory', function(value) {
    console.log('MEMORY:', value)
  })
  microstats.on('cpu', function(value) {
    console.log('CPU:', value)
  })
  microstats.on('disk', function(value) {
    console.log('DISK:', value)
  })
  options = {
    frequency: 'onalert',
    memoryalert: {
      used: '>90%'
    },
    cpualert: {
      load: '>90%'
    },
    diskalert: {
      used: '>90%'
    }
  }
  microstats.start(options, function(err) {
    if (err) console.log(err);
  })
}

// run a query against sqlite Database
function sendQuery(query) {
  return new Promise((resolve, reject) => {
    db.get(query, function(err, row) {
      if (err) return reject(err)
      resolve(row)
    })
  })
}

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
      if (!isNaN(a) && typeof(a) !== "boolean") {
        return r.concat(parseInt(a))
      }
      return _.uniq(params)
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
        console.log(port + ': ' + process.hrtime())
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
        console.log("Rpc error: " + err.response.data)
        reject(err)
      })
  })
}

// get a random number from a normal distribution
function marsagliaPolarMethod(mean, stdDev) {
  let spare;
  let isSpareReady = false;
  if (isSpareReady) {
    isSpareReady = false;
    return spare * stdDev + mean;
  } else {
    let u, v, s;
    do {
      u = Math.random() * 2 - 1;
      v = Math.random() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s == 0);
    let mul = Math.sqrt(-2.0 * Math.log(s) / s);
    spare = v * mul;
    isSpareReady = true;
    return mean + stdDev * u * mul;
  }
}

prog.parse(process.argv);

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
const sleep = require('sleep')
const _ = require('lodash')
const hashes = require('hashes')
const fs = require('fs-extra')
const os = require('os')
const path = require('path')
const decompress = require('decompress')
const json2csv = require('json2csv')
const LineByLineReader = require('line-by-line')
const csv = require('csvtojson')


let db = new sqlite3.cached.Database('nodes.sqlite')
let blockSizes = []
let intervals = []
let orph = []

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
          run(value.bitcoind + ' -minrelaytxfee=0.0' + ' -limitancestorcount=10000' + ' -limitancestorsize=500000' + ' -limitdescendantcount=10000' + ' -limitdescendantsize=10000' + ' -blockmaxsize=1000000' + ' -blockmintxfee=0.0' + ' -maxmempool=400' + ' -rpcthreads=8' + ' -rpcworkqueue=64' + (options.reindex ? ' --reindex' : ''), {
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
      .then(value => {
        run(value.bitcoind + ' -minrelaytxfee=0.0' + ' -limitancestorcount=100' + ' -limitancestorsize=1000' + ' -limitdescendantcount=100' + ' -limitdescendantsize=1000' + ' -blockmaxsize=1000000' + ' -blockmintxfee=0.0' + (options.reindex ? ' --reindex' : ''), {
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

  .command('restartall', 'Pretty print all nodes info in the network')
  .option('--reset', 'Reset the node before start', prog.BOOL, false)
  .option('--hard', 'Reset the node before start', prog.BOOL, false)
  .action(async(args, options, logger) => {

    const nodes = await getAllActiveNodeInfo()

    const pathToNetwork = os.homedir() + '/Network/Nodes'
    const pathToBackup = os.homedir() + '/node_backup.zip'
    const pathToUnzipedFiles = os.homedir() + '/test/'

    for (node of nodes) {
      await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'stop')
      sleep.sleep(2)
      await turnNodeOnOff(node.id, 0)

      if (options.hard) {
        const files = fs.readdirSync(pathToNetwork + '/' + node)
        for (const file of files) {
          if (file != 'bitcoin.conf') {
            await fs.remove(path.join(pathToNetwork + '/' + node, file))
          }
        }
        console.log('Done deleting node ' + node)
        const backupFiles = fs.readdirSync(pathToUnzipedFiles + '/0')
        for (file of backupFiles) {
          if (file != 'bitcoin.conf') {
            try {
              await fs.copy(pathToUnzipedFiles + '0/' + file, pathToNetwork + '/' + node + '/' + file)
            } catch (e) {
              console.log(e);
            }
          }
        }
        console.log('Done resetting node ' + node)
      }
      if (options.reset) {
        fs.removeSync(os.homedir() + '/Network/Nodes/' + node + '/mempool.dat')
        fs.removeSync(os.homedir() + '/Network/Nodes/' + node + '/debug.log')
        fs.removeSync(os.homedir() + '/Network/Nodes/' + node + '/db.log')
        console.log('Node ' + node + ' mempool has been deleted')
      }
      sleep.sleep(5)
      await run(node.bitcoind + ' -minrelaytxfee=0.0' + ' -limitancestorcount=100' + ' -limitancestorsize=1000' + ' -limitdescendantcount=100' + ' -limitdescendantsize=1000' + ' -blockmaxsize=1000000' + ' -blockmintxfee=0.0')
      await turnNodeOnOff(node.id, 1)
    }

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
   * Reset the environment mempool
   * @param {bool} hard - reset the network to the checkpoint status (height 398482)
   */

  .command('reset', 'Reset the test enviroment')
  .option('--hard', 'Reset the environment to the checkpoint ( NOT IMPLEMENTED ATM )', prog.BOOL, false)
  .action(async(args, options, logger) => {

    const nodes = await getAllActiveNodeInfo()

    for (node of nodes) {
      sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'stop')
      turnNodeOnOff(node.id, 0)
    }

    if (options.hard) {
      await run('python src/resetter.py')
    } else {
      const dirs = fs.readdirSync(os.homedir() + '/Network/Nodes').filter(file => fs.statSync(path.join(os.homedir() + '/Network/Nodes', file)).isDirectory())
      for (dir of dirs) {
        fs.removeSync(os.homedir() + '/Network/Nodes/' + dir + '/mempool.dat')
        fs.removeSync(os.homedir() + '/Network/Nodes/' + dir + '/debug.log')
        fs.removeSync(os.homedir() + '/Network/Nodes/' + dir + '/db.log')
        console.log('Node ' + dir + ' mempool has been deleted')
      }
    }
  })

  .command('check', 'Check the enviroment status')
  .option('--blkcount', 'Check block count is 398482 / equal for all', prog.BOOL, false)
  .option('--mempool', 'Check the mempool status', prog.BOOL, false)
  .action(async(args, options, logger) => {
    const nodes = await getAllActiveNodeInfo()

    // check heights

    if (!options.blkcount) {
      let heights = []
      for (node of nodes) {
        const height = await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getblockcount')
        heights.push(height.data.result)
      }

      const firstHeight = heights[0]
      if (firstHeight != 398482) console.log('Height is not at checkpoint (' + firstHeight + ')!')
      for (height of heights) {
        if (height != firstHeight) {
          console.log('Heights are different!');
          break;
        }
      }
    }

    // check mempool

    if (!options.mempool) {
      let mempools = []
      for (node of nodes) {
        const mempool = await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getmempoolinfo')
        mempools.push({
          mempool: mempool.data.result.size,
          node: node.id
        })
      }

      for (data of mempools) {
        if (data.mempool.size != 0) {
          console.log('Node ' + data.node + ' has mempool size of ' + data.mempool);
        }
      }
    }

  })

  /**
   * Emulate the real blocks
   * @param {Int} nOfBlocks - required paramter describe on how many blocks the test should be done
   */

  .command('emulate', 'Run the framework with with specific paramter')
  .argument('<nOfBlocks>', 'Number of blocks to test the protocol with', prog.INT)
  .action(async(args, options, logger) => {

    const master = await getMasterInfo()
    const node = await sendQuery('SELECT * FROM Node WHERE id = 0')

    let coinbases = []
    let nextHeight = await getNextHeight()

    debug('nextHeight', nextHeight)
    debug('args.nOfBlocks', args.nOfBlocks)

    console.log("Starting with blocks...");

    for (let k = 0; k < args.nOfBlocks; k++) {

      const {
        tx: txList
      } = await getNextBlockFromMaster(master, nextHeight, true)
      debug('txList size before coinbase', txList.length)

      await getCoinbase(master, txList, coinbases)
      debug('txList size after coinbase', txList.length)

      const fullTxList = await buildFullTransaction(txList)
      debug('fullTxList size', fullTxList.length)
      debug('coinbases size', coinbases.length)

      for (var i = 0; i < fullTxList.length; i++) {
        try {
          await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'sendrawtransaction', fullTxList[i].hex)
        } catch (e) {
          debug('Error:', e)
        }
      }

      const minerList = await buildMinerList(0)
      debug('minerList length', minerList.length)
      const coinbaseNextBlock = coinbases.shift()
      debug('coinbase', coinbaseNextBlock.address)

      try {
        while (!(await allNodesAreTxSynched())) {
          console.log('Synchronizing ... cya @ 15')
          sleep.sleep(15)
        }
      } catch (err) {
        console.log('err', err);
      }

      nextHeight++

      console.log('Start mining ...');

      sleep.sleep(2)

      const res = await mineBlock(minerList, coinbaseNextBlock.address, coinbaseNextBlock.coinbase, coinbaseNextBlock.sequence, coinbaseNextBlock.locktime, true, 2)

      console.log('Finished mining ...');

      sleep.sleep(2)

      console.log(' ------- END CYCLE ' + k + '-------');

    }

    while (!(await allNodesAreBlkSynched())) {
      console.log('Synchronizing ... cya @ 5s')
      sleep.sleep(5)
    }

  })


  /**
   * Start collecting data with different protocol / network settings
   * @param {Int} nOfBlocks - required paramter describe on how many blocks the test should be done
   * @param {Int} blockSize - optional paramter describe the block size
   * @param {Int} interval - optional paramter describe the interval size
   * @param {Int} difficulty - optional paramter describe the difficulty for the next blocks
   * @param {Int} hashingConf - optional paramter path file describing the hashing power of nodes
   * @param {Int} orphanConf - optional paramter path to file describing the orphan rate
   * @param {Int} statusConf - optional paramter path to file describing the status probability
   */

  .command('run', 'Run the framework with with specific paramter')
  .argument('<nOfBlocks>', 'Number of blocks to test the protocol with', prog.INT)
  .argument('[blockSize]', 'Mean size of a block in kilobyte', prog.INT, 900)
  .argument('[interval]', 'Mean Interval between blocks creation in seconds', prog.INT, 562)
  .argument('[difficulty]', 'Difficulty', prog.INT, 422170566883)
  .argument('[height]', 'Custom height (testing) ', prog.INT)
  .argument('[crash]', 'Probability that a node crash [0-1]', prog.INT, 0)
  .argument('[restart]', 'Probability that a node restart from a shutdown [0-1]', prog.INT, 0)
  .option('--alert', 'Alert on memory, cpu and disk usage (> 90%)')
  .option('--mine', 'If true, then mine the block', prog.BOOL, false)
  .option('--orphans', 'If true, orphans are generated', prog.BOOL, false)
  .option('--analysis', 'If true, data are saved to db', prog.BOOL, false)
  .option('--latency', 'If true, latencies are set based on the zone', prog.BOOL, false)
  .action(async(args, options, logger) => {

    if (options.status) turnStatusAlert()
    if (!assertEnoughSpace()) process.exit(1)

    if (options.latency)
      await setLatencies()

    const master = await getMasterInfo()
    const node = await sendQuery('SELECT * FROM Node WHERE id = 0')
    let tails = [];

    if (options.analysis)
      tails = await setupAnalysisEnvironment()

    let coinbases = []
    let nextHeight = args.height || await getNextHeight()

    debug('nextHeight', nextHeight)
    debug('args.nOfBlocks', args.nOfBlocks)

    console.log("Starting with blocks...");

    let nextBlockSize;
    let nextInterval;

    for (let k = 0; k < args.nOfBlocks; k++) {

      nextBlockSize = await getNextBlockSize(args.blockSize)
      blockSizes.push(nextBlockSize)
      debug('nextBlockSize', nextBlockSize)

      nextInterval = await getNextInterval(args.interval)
      intervals.push(nextInterval)
      debug('nextInterval', nextInterval)

      let actualMempoolSize = await getMempoolInfo('min')
      debug('actualMempoolSize min', actualMempoolSize)

      while (actualMempoolSize < nextBlockSize) {
        const {
          tx: txList
        } = await getNextBlockFromMaster(master, nextHeight, true)
        debug('txList size before coinbase', txList.length)

        await getCoinbase(master, txList, coinbases)
        debug('txList size after coinbase', txList.length)

        const fullTxList = await buildFullTransaction(txList)
        debug('fullTxList size', fullTxList.length)
        debug('coinbases size', coinbases.length)

        for (var i = 0; i < fullTxList.length; i++) {
          try {
            await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'sendrawtransaction', fullTxList[i].hex)
          } catch (e) {
            debug('Error:', e)
          }
        }

        try {
          actualMempoolSize = await getMempoolInfo('max')
        } catch (err) {
          console.log(err);
        }
        debug('update actualMempoolSize max', actualMempoolSize)
        nextHeight++
      }

      // TODO: add probability of orphan miner
      const nOfOrphans = areOrphansGenerated(nextBlockSize, nextInterval, args.difficulty, options.orphans)
      debug('nOfOrphans', nOfOrphans)
      orph.push(nOfOrphans)
      const minerList = await buildMinerList(0)
      debug('minerList length', minerList.length)
      const coinbaseNextBlock = coinbases.shift()
      debug('coinbase', coinbaseNextBlock.address)

      let index = 0
      try {
        while (!(await allNodesAreTxSynched()) && index < 12) {
          console.log('Synchronizing ... cya @ 15')
          sleep.sleep(15)
            ++index
        }
      } catch (err) {
        console.log('err', err);
      }

      console.log('Start mining ...');

      sleep.sleep(2)

      const res = await mineBlock(minerList, coinbaseNextBlock.address, coinbaseNextBlock.coinbase, coinbaseNextBlock.sequence, coinbaseNextBlock.locktime, options.mine, nextBlockSize)

      console.log('Finished mining ...');

      // nodesRestartingCrashing(args.restart, args.crash)

      sleep.sleep(2)

      console.log(' ------- END CYCLE ' + k + '-------');

    }

    while (!(await allNodesAreBlkSynched())) {
      console.log('Synchronizing ... cya @ 5s')
      sleep.sleep(5)
    }

    if (options.analysis)
      await processLogData()

    // process.exit()

  })

  .command('latency', 'test')
  .argument('[latencies...]', 'Set Latencies')
  .action(async(args, options, logger) => {

    await setLatencies()

  })

  // TESTING

  .command('test', 'test')
  .action(async(args, options, logger) => {

    // await setLatencies()

    await setupAnalysisEnvironment()
    await processLogData()

  })

async function setupAnalysisEnvironment() {
  const pathToNetwork = os.homedir() + '/Network/Nodes'
  const nodes = await getAllNodes()
  let tails = []
  let index = 0

  db.serialize(function() {
    db.run("DROP TABLE IF EXISTS BlockSent")
    db.run("DROP TABLE IF EXISTS BlockReceived")
    db.run("CREATE TABLE BlockSent(blockhash TEXT,minerId INTEGER, timestamp TEXT, nOfTx INTEGER, blockSize DOUBLE, interval DOUBLE, orphans NUMBER)")
    db.run("CREATE TABLE BlockReceived(blockhash TEXT, minerId INTEGER, timestamp TEXT)")
  })
}

async function processLogData() {
  const nodes = await getAllNodes()
  let res = await Promise.all(nodes.map(async(node) => await saveData(node))) // complimentato da MR. Scibona
}

async function saveData(node) {
  let copySizes = blockSizes.slice()
  let copyInterval = intervals.slice()
  const pathToNetwork = os.homedir() + '/Network/Nodes'
  lr = new LineByLineReader(pathToNetwork + '/' + node.id + '/debug.log')
  let hashes = []

  lr.on('error', function(err) {
    console.log("scoppiato tutto pddc", err);
  })

  lr.on('line', async function(line) {

    if (line.includes('Successfully reconstructed block')) {
      let first = line.split(' ')[0] + ' '
      let second = line.split(' ')[1]
      const timestamp = first.concat(second)
      const hash = line.split(' ')[5]
      if (!hashes.includes(hash)) {
        hashes.push(hash)
        newBlockIsArrived(hash, node.id, timestamp)
      }
    }

    if (line.includes('Requesting block')) {
      let first = line.split(' ')[0] + ' '
      let second = line.split(' ')[1]
      const timestamp = first.concat(second)
      const hash = line.split(' ')[4]
      if (!hashes.includes(hash)) {
        hashes.push(hash)
        newBlockIsArrived(hash, node.id, timestamp)
      }
    }

    if (line.includes('New Block has been mined: ')) {
      nextLine = false
      let first = line.split(' ')[0] + ' '
      let second = line.split(' ')[1]
      const timestamp = first.concat(second)
      console.log(line);
      const hash = line.split(' ')[7]
      const res = await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getblock', hash)
      newBlockIsSent(hash, node.id, timestamp, res.data.result.tx.length, copySizes.shift(), copyInterval.shift(), orph.shift())
    }

  })
}

function newBlockIsSent(hash, minerId, timestamp, nOfTxs, blocksize, interval, orph) {
  let stmt = db.prepare("INSERT INTO BlockSent VALUES (?, ?, ?, ?, ?, ?, ?)")
  stmt.run(hash, minerId, timestamp, nOfTxs, blocksize, interval, orph)
  stmt.finalize()
}

function newBlockIsArrived(hash, minerId, timestamp) {
  let stmt = db.prepare("INSERT INTO BlockReceived VALUES (?, ?, ?)")
  stmt.run(hash, minerId, timestamp)
  stmt.finalize()
}

async function nodesRestartingCrashing(restartProbability, crashProbability) {
  const nodes = await getAllActiveNodeInfo()
  const nodesId = nodes.map(node => node.id)
  const nOfNodes = await sendQuery('SELECT COALESCE(MAX(id), 0) as nOfNodes FROM Node')

  for (var i = 0; i < nOfNodes; i++) {
    if (nodesId.includes(i) && nodeWillCrash(crashProbability)) {
      await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'stop')
      await turnNodeOnOff(node.id, 0)
      debug('nodeWillCrash', node.id)
    } else if (nodeWillRestart(restartProbability)) {
      await run(node.bitcoind + ' -minrelaytxfee=0.0' + ' -limitancestorcount=100' + ' -limitancestorsize=1000' + ' -limitdescendantcount=100' + ' -limitdescendantsize=1000' + ' -blockmaxsize=1000000' + ' -blockmintxfee=0.0')
      await turnNodeOnOff(node.id, 1)
      debug('nodeWillRestart', node.id)
    }
  }
}

async function buildMinerList(nOfOrphans) {
  let minerListId = []
  let hashingPowerNodes = await buildHashingPowerList()
  const nodeId = minerListId.push(getNextMiner(hashingPowerNodes))
  for (var i = 0; i < nOfOrphans; i++) {
    minerListId.push(getNextMiner(hashingPowerNodes))
  }
  return minerListId
}

async function mineBlock(nodes, address, coinbase, sequence, locktime, mineflag, blocksize) {
  blocksize = Math.trunc(blocksize * 1000000)
  let miners = await Promise.all(nodes.map(async(node) => await getNodeInfo(node)))
  if (mineflag) {
    const res = await Promise.all(miners.map(async(miner) => await mine(miner.rpcusername, miner.rpcpassword, miner.rpcport, address, coinbase, sequence, locktime, blocksize)))
    return res[0].stdout.replace(/\W+/g, " ").trim().split(' ')
  } else {
    miners.map(miner => console.log('python src/ntgbtminer.py ' + miner.rpcport + ' ' + miner.rpcusername + ' ' + miner.rpcpassword + ' ' + address + ' ' + coinbase + ' ' + sequence))
  }
}

async function setLatencies() {
  const latencyMatrixPath = 'latencies.conf'
  const nodesDistribution = 'nodesDistribution.conf'
  const nodes = await getAllNodes()
  let matrix = []

  let check = true

  csv()
    .fromFile(latencyMatrixPath)
    .on('json', (jsonObj) => {
      let obj = {}
      let country = jsonObj['from/to']
      delete jsonObj['from/to']
      obj[country] = jsonObj
      matrix.push(obj)
    })
    .on('done', (error) => {
        for (var i = 0; i < nodes.length; i++) {
          let lat;
          for (country of matrix) {
            if (Object.keys(country)[0] == nodes[i].zone) {
              lat = Object.values(country)
            }
          }
          for (var j = 0; j < nodes.length; j++) {
            let commandIn;
            let commandOut;
            if (nodes[i].port != nodes[j].port && nodes[i].zone != 'Unknown' && nodes[j].zone != 'Unknown') {
              // console.log(nodes[i].zone);
              commandIn = 'sudo tcset --device lo --delay ' + Math.floor(lat[0][nodes[j].zone] + 1)  + ' --src-port ' + nodes[i].port + ' --dst-port ' + nodes[j].port + ' --delay-distro 20 ' + ((check == true) ? '' : '--add')
              console.log(1,commandIn);
              // run(commandIn,{
              //   echoCommand: false,
              //   captureOutput: true
              // }).then(res => JSON.stringify('1', res.stdout))
            } else {
              if (nodes[i].zone == 'Unknown' && nodes[i].port != nodes[j].port) {
                commandIn = 'sudo tcset --device lo --delay ' + Math.floor(Math.random() * (500 - 0) + 0) + ' --src-port ' + nodes[i].port + ' --dst-port ' + nodes[j].port + ' --delay-distro 20 ' + ((check == true) ? '' : '--add')
                console.log(2, commandIn);
                // run(commandIn, {
                //   echoCommand: false,
                //   captureOutput: true
                // }).then(res => JSON.stringify('2', res.stdout))
              } else if (nodes[j].zone == 'Unknown' && nodes[i].port != nodes[j].port) {
                commandIn = 'sudo tcset --device lo --delay ' + Math.floor(Math.random() * (500 - 0) + 0) + ' --src-port ' + nodes[i].port + ' --dst-port ' + nodes[j].port + ' --delay-distro 20 ' + ((check == true) ? '' : '--add')
                console.log(3, commandIn);
                // run(commandIn,{
                //   echoCommand: false,
                //   captureOutput: true
                // }).then(res => JSON.stringify('3', res.stdout))
              } else {
                // console.log('else');
              }
              check = false
            }
          }
        }
    })
}

function mine(username, password, rpcport, address, coinbase, sequence, locktime, blocksize) {
  debug('blocksize', blocksize)
  const shell_cmd = 'python src/ntgbtminer.py ' + rpcport + ' ' + username + ' ' + password + ' ' + address + ' ' + coinbase + ' ' + sequence + ' ' + blocksize + ' ' + locktime
  return run(shell_cmd, {
    echoCommand: false,
    captureOutput: true
  })
}

async function getMempoolInfo(type) {
  const nodes = await getAllActiveNodeInfo()
  let nodesMempool = [];

  for (node of nodes) {
    try {
      let test = await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getmempoolinfo')
      nodesMempool.push(test)
    } catch (err) {
      console.log(err);
    }
  }
  let bytes = nodesMempool.map(m => m.data.result.bytes)

  return (type == 'max') ? Math.max(...bytes) / 1000000 : Math.min(...bytes) / 1000000
}

async function updateMempoolTxs(minerId) {
  const node = await sendQuery('SELECT * FROM Node WHERE id = ' + minerId[0])
  const actualMempool = await sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getmempoolinfo')

  return actualMempool.data.result.bytes / 1000000
}

async function allNodesAreTxSynched() {
  const nodes = await getAllActiveNodeInfo()
  let promises = []
  for (node of nodes) {
    // debug('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getmempoolinfo')
    // console.log('MAYBE ERROR:', '127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getmempoolinfo')
    promises.push(sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getmempoolinfo'))
  }
  let res;
  try {
    res = (await Promise.all(promises)).map(e => e.data.result)
  } catch (err) {
    console.log('allNodesAreTxSynched', err);
  }
  return res.every(x => Object.is(res[0].size, x.size))
}

async function allNodesAreBlkSynched() {
  const nodes = await getAllActiveNodeInfo()
  let promises = []
  for (node of nodes) {
    promises.push(sendRpcRequest('127.0.0.1', node.rpcport, node.rpcusername, node.rpcpassword, 'getblockcount'))
  }
  let res;
  try {
    res = (await Promise.all(promises)).map(e => e.data.result)
  } catch (err) {
    console.log(err);
  }
  return res.every(x => Object.is(res[0], x))
}

async function getCoinbase(master, txList, coinbases) {
  const cb = await sendRpcRequest(master.ip, master.rpcport, master.rpcusername, master.rpcpassword, 'getrawtransaction', txList.shift(), true)
  coinbases.push({
    address: cb.data.result.vout[0].scriptPubKey.addresses[0],
    coinbase: cb.data.result.vin[0].coinbase,
    sequence: cb.data.result.vin[0].sequence,
    locktime: cb.data.result.locktime
  })
}

async function buildHashingPowerList() {
  const data = await getAllActiveNodeInfo()
  var fData = data.map(function(item) {
    return [item.id, item.probability]
  })
  return new WeightedList(fData)
}

function getNextInterval(interval) {
  return marsagliaPolarMethod(interval, 20)
}

function getNextBlockSize(size) {
  return marsagliaPolarMethod(size, 25) / 1000
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
  return res.data.result + 1
}

async function buildFullTransaction(txList) {
  const limit = promiseLimit(1)
  return new Promise(function(resolve, reject) {
    Promise.all(txList.map((tx) => {
        return limit(() => getTransactionByTxId(tx))
      })).then(fullTxList => {
        let sums = fullTxList.reduce(function(r, c, i) {
          r.push((r[i - 1] || 0) + c.size);
          return r
        }, []);
        // let result = sums.map(function(val, index) { return { size: val, hex: fullTxList[index].hex, txHash: fullTxList[index].hash } });
        resolve(fullTxList)
      })
      .catch(err => reject(err))
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
        resolve(res.data.result)
        // resolve((({ hex, size, hash }) => ({ hex, size, hash }))(res.data.result))
      })
      .catch(err => reject(err))
  })
}

function debug(key, value) {
  console.log(key + ': ' + value);
}

function getMaxSize(mempool) {
  return mempool.size[mempool.length - 1]
}

function getNextBlockFromMaster(master, currentHeight, isHex) {
  debug('getNextBlockFromMaster - height', currentHeight)
  return new Promise(function(resolve, reject) {
    sendRpcRequest(master.ip, master.rpcport, master.rpcusername, master.rpcpassword, 'getblockhash', currentHeight.toString())
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
      return _.uniq(_.flattenDeep((params)))
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

function areOrphansGenerated(blockSize, interval, difficulty, none) {
  if (!none)
    return 0

  const orph1 = scientificToDecimal(1.766e-01) +
    (difficulty * (-1 * scientificToDecimal(5.988e-13))) +
    (blockSize * scientificToDecimal(2.067e-01)) +
    (interval * scientificToDecimal(3.231e-03));

  const orph2 = scientificToDecimal(1.348e-01) +
    (difficulty * (-1 * scientificToDecimal(3.453e-14))) +
    (blockSize * (-1 * scientificToDecimal(2.552e-02))) +
    (interval * (-1 * scientificToDecimal(5.835e-03)));

  const random = Math.random();

  if (random < orph2)
    return 2
  else if (random < orph1)
    return 1
  else return 0

}

function scientificToDecimal(num) {
  //if the number is in scientific notation remove it
  if (/\d+\.?\d*e[\+\-]*\d+/i.test(num)) {
    var zero = '0',
      parts = String(num).toLowerCase().split('e'), //split into coeff and exponent
      e = parts.pop(), //store the exponential part
      l = Math.abs(e), //get the number of zeros
      sign = e / l,
      coeff_array = parts[0].split('.');
    if (sign === -1) {
      num = zero + '.' + new Array(l).join(zero) + coeff_array.join('');
    } else {
      var dec = coeff_array[1];
      if (dec) l = l - dec.length;
      num = coeff_array.join('') + new Array(l + 1).join(zero);
    }
  }

  return num;
};

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
      .then(res => {
        resolve(res)
      })
      .catch(err => {
        console.log("Rpc error: " + JSON.stringify(err.response.data))
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

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error.message);
});

prog.parse(process.argv);

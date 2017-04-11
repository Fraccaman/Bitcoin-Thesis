#!/usr/bin/env node

const prog = require('caporal')
const bluebird = require('bluebird')
const _ = require('lodash')
const run = require('pshell')
const sqlite3 = require('sqlite3').verbose()
const WeightedList = require('js-weighted-list')

let db = new sqlite3.cached.Database('nodes.sqlite')

prog
  .version('1.0.0')
  .command('startall', 'Start the entire network')
  .action(function(args, options, logger) {
    getAllNodes()
      .then(res => {
        res.forEach(function(value) {
          run(value['bitcoind'], {
              echoCommand: false,
              captureOutput: true
            })
            .catch(err => {
              logger.error('Err: ' + err)
            })
        })
        logger.info(res.length + ' are running in background.')
        db.close()
      })
      .catch(err => {
        console.log('Err: ' + err)
        db.close()
      })
  })
  .command('start', 'Start a single node')
  .argument('<node>', 'Node id to start', prog.INT)
  .action(function(args, options, logger) {
    getNodeInfo(args['node'])
      .then(res => {
        run(res['bitcoind'], {
            echoCommand: false,
            captureOutput: true
          })
          .then(res => {
            logger.info('Node ' + args['node'] + ' is running in background.');
            db.close()
          })
          .catch(err => {
            logger.info('Err: ', err);
            db.close()
          })
      })
  })
  .command('stopall', 'Stop the entire network')
  .action(function(args, options, logger) {
    getAllNodes()
      .then(res => {
        res.forEach(function(value) {
          run(value['bitcoincli'] + ' stop', {
              echoCommand: false,
              captureOutput: true
            })
            .catch(err => {
              logger.error('Err: ' + err)
            })
        })
        logger.info(res.length + ' have been stopped.')
        db.close()
      })
      .catch(err => {
        console.log('Err: ' + err)
        db.close()
      })
  })
  .command('stop', 'Stop a single node')
  .argument('<node>', 'Node id to start', prog.INT)
  .action(function(args, options, logger) {
    getNodeInfo(args['node'])
      .then(res => {
        run(res['bitcoincli'] + ' stop', {
            echoCommand: false,
            captureOutput: true
          })
          .then(res => {
            logger.info('Node ' + args['node'] + ' has been stopped.');
          })
          .catch(err => {
            logger.info('Err: ', err);
          })
      })
  })
  .command('showall', 'Pretty print all nodes info in the network')
  .action(function(args, options, logger) {
    getAllNodes()
      .then(res => {
        res.forEach(function(value) {
          console.log(res, null, 2);
        })
        db.close()
      })
      .catch(err => {
        console.log('Err: ' + err)
        db.close()
      })
  })
  .command('command', 'Send a command via RPC to a node by ID (use txsend to send transactions)')
  .argument('<node>', 'Node id to start', prog.INT)
  .argument('<op>', 'Command to run on node <node>')
  .argument('[params...]', 'Parameters for <op>')
  .action(function(args, options, logger) {
    getNodeInfo(args['node'])
      .then(res => {
        if (args['op'] !== 'sendrawtransaction') {
          console.log("DEBUG " + res['bitcoincli'] + ' ' + args['op'] + ' ' + args['params'].join(' '));
          run(res['bitcoincli'] + ' ' + args['op'] + ' ' + args['params'].join(' '), {
              echoCommand: false,
              captureOutput: true
            })
            .then(res => {
              logger.info(res.stdout.trim());
              db.close()
            })
            .catch(err => {
              logger.error(err.message)
              db.close()
            })
        } else {
          console.log('Send transactions with [sendtx] and blocks with [sendblock] commands.');
          db.close()
        }
      })
      .catch(res => console.log(res))
  })
  .command('sendtx', 'Send a transaction via RPC from a node by ID')
  .argument('<node>', 'Node ID', prog.INT)
  .argument('<hex>', 'Transaction hex format')
  .action(function(args, options, logger) {
    getNodeInfo(args['node'])
      .then(res => {
        run(res['bitcoincli'] + ' ' + 'sendrawtransaction' + ' ' + args['hex'], {
            echoCommand: false,
            captureOutput: true
          })
          .then(res => {
            logger.info(JSON.stringify(res.stdout.trim()));
          })
          .catch(err => {
            logger.error(err.message)
          })
      })
      .catch(res => console.log(res))
  })
  .command('mine', 'Mine and submit a block using the transaction in the mempool.')
  .argument('[node]', 'Node ID', prog.INT)
  .action(function(args, options, logger) {
    getAllNodes()
      .then(res => {
        const data = res.map(function(item) {
          return [item['id'], item['probability']]
        })
        let wl = new WeightedList(data)
        const nextNode = wl.peek()
        getNodeInfo(args['node'] || nextNode[0])
          .then(res => {
            // console.log('python src/ntgbtminer.py ' + res['rpcport'] + ' ' + res['rpcusername'] + ' ' + res['rpcpassword']);
            // run('python src/ntgbtminer.py ' + res['rpcport'] + ' ' + res['rpcusername'] + ' ' + res['rpcpassword'], {
            run('python src/ntgbtminer.py ' + 16593 + ' ' + 'root' + ' ' + 'root', {
                echoCommand: false,
                captureOutput: true
              })
              .then(res => {
                logger.info(res.stdout.trim());
              })
              .catch(err => {
                logger.error(err.message)
              })
          })
      })
      .catch(res => console.log(res))
  })

function getAllNodes() {
  return new Promise(function(resolve, reject) {
    db.all('SELECT * FROM Node', function(err, res) {
      if (err)
        return reject(err)
      resolve(res)
    })
  })
}

function getNodeInfo(node) {
  return new Promise(function(resolve, reject) {
    db.get('SELECT * FROM Node WHERE id = ?', [node], function(err, row) {
      if (err)
        return reject(err)
      resolve(row)
    })
  })
}

prog.parse(process.argv);

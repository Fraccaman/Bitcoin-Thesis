#!/usr/bin/env node

const prog = require('caporal')
const bluebird = require('bluebird')
const _ = require('lodash')
const redis = require('redis')
const run = require('pshell')

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

let client = redis.createClient()
let node;
let count = 0;

prog
  .version('1.0.0')
  // you specify arguments using .argument()
  // 'app' is required, 'env' is optional
  .command('startall', 'Start the entire network')
  .action(function(args, options, logger) {
    client.keys('*', function(err, keys) {
      Promise.all(keys.map(key => client.getAsync(key)))
        .then(values => {
          for (var i = 0; i < values.length; i++) {
            run(JSON.parse(values[i])['bitcoind'], {
                echoCommand: false,
                captureOutput: true
              })
              .then(res => {
                logger.info('Node is running in background.')
              })
              .catch(err => {
                logger.error('Err: ' + err)
              })
          }
        })
        .then(function() {
          client.quit();
        })
        .catch(err => console.log(err))
    })
  })
  .command('start', 'Start a single node')
  .argument('<node>', 'Node id to start', prog.INT)
  .action(function(args, options, logger) {
    getNodeInfo(client, args['node'])
      .then(res => {
        run(JSON.parse(res)['bitcoind'], {
            echoCommand: false,
            captureOutput: true
          })
          .then(res => {
            client.quit();
            console.log('Node ' + args['node'] + ' is running in background');
          })
          .catch(err => {
            console.error('Err: ', err);
          })
      })
      .catch(res => console.log(res))
  })
  .command('shutdownall', 'Stop the entire network')
  .action(function(args, options, logger) {
    client.keys('*', function(err, keys) {
      Promise.all(keys.map(key => client.getAsync(key)))
        .then(values => {
          for (var i = 0; i < values.length; i++) {
            run(JSON.parse(values[i])['bitcoincli'] + ' stop', {
                echoCommand: false,
                captureOutput: true
              })
              .then(res => {
                logger.info('Node has been stopped')
              })
              .catch(err => {
                logger.error('Err: ' + err)
              })
          }
        })
        .then(function() {
          client.quit();
        })
        .catch(err => console.log(err))
    })
  })
  .command('shutdown', 'Stop a single node')
  .argument('<node>', 'Node id to start', prog.INT)
  .action(function(args, options, logger) {
    getNodeInfo(client, args['node'])
      .then(res => {
        run(JSON.parse(res)['bitcoincli'] + ' stop', {
            echoCommand: false,
            captureOutput: true
          })
          .then(res => {
            client.quit();
            console.log('Node ' + args['node'] + ' is running in background');
          })
          .catch(err => {
            console.error('Err: ', err);
          })
      })
      .catch(res => console.log(res))
  })
  .command('showall', 'Pretty print all nodes info in the network')
  .action(function(args, options, logger) {
    client.keys('*', function(err, keys) {
      Promise.all(keys.map(key => client.getAsync(key)))
        .then(values => {
          for (var i = 0; i < values.length; i++) {
            console.log('Node ' + i + ': ' + JSON.stringify(JSON.parse(values[i], null, 2)));
          }
        })
        .then(function() {
          client.quit();
        })
        .catch(err => console.log(err))
    })
  })
  .command('command', 'Send a command via RPC to a node by ID')
  .argument('<node>', 'Node id to start', prog.INT)
  .argument('<op>', 'Command to run on node <node>')
  .argument('[params...]', 'Parameters for <op>')
  .action(function(args, options, logger) {
    getNodeInfo(client, args['node'])
      .then(res => {
        run(JSON.parse(res)['bitcoincli'] + ' ' + args['op'] + ' ' + (args[0] ? args[0] : ''), {
            echoCommand: false,
            captureOutput: true
          })
          .then(res => {
            logger.info(JSON.stringify(res.stdout.trim()));
            client.quit()
          })
          .catch(err => {
            logger.error(err.message)
          })
      })
      .catch(res => console.log(res))
  })
  command('sendtx', 'Send a transaction via RPC from a node by ID')
  .argument('<node>', 'Node ID', prog.INT)
  .argument('<hex>', 'Transaction hex format')
  .action(function(args, options, logger) {
    getNodeInfo(client, args['node'])
      .then(res => {
        run(JSON.parse(res)['bitcoincli'] + ' ' + 'sendrawtransaction' + ' ' + args['hex'], {
            echoCommand: false,
            captureOutput: true
          })
          .then(res => {
            logger.info(JSON.stringify(res.stdout.trim()));
            client.quit()
          })
          .catch(err => {
            logger.error(err.message)
          })
      })
      .catch(res => console.log(res))
  })

function getNodeInfo(client, node) {
  return new Promise(function(resolve, reject) {
    client.get(node, function(err, value) {
      if (err) return reject(err)
      resolve(value)
    })
  })
}

prog.parse(process.argv);

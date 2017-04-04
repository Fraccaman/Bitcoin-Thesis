#!/usr/local/bin/node

import commandLineArgs from 'command-line-args'
import RpcClient from 'bitcoind-rpc-client'
import redis from 'redis'
import bluebird from 'bluebird'
import cmd from 'node-cmd'

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const optionDefinitions = [{
    name: 'node',
    type: Number,
    alias: 'n'
  },
  {
    name: 'command',
    type: String,
    alias: 'c',
    multiple: true
  },
  {
    name: 'shownodes',
    type: Boolean,
    alias: 's'
  },
  {
    name: 'shutdown',
    type: Boolean
  },
  {
    name: 'startall',
    type: Boolean
  }
]

const options = commandLineArgs(optionDefinitions)
let client = redis.createClient()
let node;

if (options['node']) {
  getNodeInfo(client, options['node'])
    .then(res => {
      node = new RpcClient({
        host: '127.0.0.1',
        port: JSON.parse(res)['rpcport'],
        user: 'root',
        pass: 'root'
      });
      node.cmd(options['command'].join())
        .then(result => console.log("Result for node " + options['node'] + ": " + JSON.stringify(result['result'])))
        .catch(result => console.log('err ' + result))
    })
    .catch(res => console.log(res))
} else if (options['shownodes']) {
  client.keys('*', function(err, keys) {
    if (err) return console.log(err);
    for (var i = 0; i < keys.length; i++) {
      console.log(keys[i]);
    }
  })
} else if (options['shutdown']) {
  client.keys('*', function(err, keys) {
    Promise.all(keys.map(key => client.getAsync(key)))
      .then(values => {
        for (var i = 0; i < values.length; i++) {
          node = new RpcClient({
            host: '127.0.0.1',
            port: JSON.parse(values[i])['rpcport'],
            user: 'root',
            pass: 'root'
          });
          node.cmd('stop')
            .then(result => console.log("Result for node " + i + ": " + JSON.stringify(result['result'])))
            .catch(err => {
              console.log('Error for node: ' + i + ": " + err);
            })
        }
      })
      .then(function() {

        client.quit();
      })
      .catch(err => console.log(err))
  })
} else if (options['startall']) {
  client.keys('*', function(err, keys) {
    Promise.all(keys.map(key => client.getAsync(key)))
      .then(values => {
        for (var i = 0; i < values.length; i++) {
          cmd.run('bitcoind ' + JSON.parse(values[i])['bitcoind']);
          console.log('Node ' + i + " is running in background");
        }
      })
      .then(function() {
        client.quit();
      })
      .catch(err => console.log(err))
  })
}

function getNodeInfo(client, node) {
  return new Promise(function(resolve, reject) {
    client.get(node, function(err, value) {
      if (err) return reject(err)
      resolve(value)
    });
  })
}

// client.quit();

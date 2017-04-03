#!/usr/local/bin/node
import commandLineArgs from 'command-line-args'
import RpcClient from 'bitcoind-rpc-client'
import redis from 'redis'

const optionDefinitions = [
  { name: 'node', type: Number, alias: 'n' },
  { name: 'command', type: String, alias: 'c', multiple: true },
  { name: 'shownodes', type: Boolean, alias: 's' }
]

const options = commandLineArgs(optionDefinitions)
let client = redis.createClient()
let node;

if (!options['shownodes'] && options['node']) {
  getNodeInfo(client, options['node'])
    .then(res => {
      node = new RpcClient({
        host: '127.0.0.1',
        port: JSON.parse(res)['rpcport'],
        user: 'private',
        pass: 'root'
      });
      node.cmd(options['command'].join())
        .then(result => console.log("Result for node " + options['node'] + ": " + JSON.stringify(result['result'])))
        .catch(result => console.log('err ' + result))
    })
    .catch(res => console.log(res))
  } else if (options['shownodes']) {
    client.keys('*', function (err, keys) {
      if (err) return console.log(err);
      for(var i = 0, len = keys.length; i < len; i++) {
        console.log(keys[i]);
      }
    });
  }

function getNodeInfo(client, node) {
  return new Promise(function(resolve, reject){
    client.get(node, function (err, value) {
      if (err) return reject(err)
      resolve(value)
    });
  })
}

client.quit();

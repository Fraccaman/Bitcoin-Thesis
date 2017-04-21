#!/usr/bin/env node

const axios = require('axios')
const crypto = require('crypto')

function standalone_miner(coinbase_message, address, port, user, password) {

  RPC_URL = "127.0.0.1"
  RPC_PORT = port
  RPC_USER = user
  RPC_PASS = password

  console.log("Mining new block template...");

  let blockTemplate = sendRpcRequest(RPC_URL, RPC_PORT, RPC_USER, RPC_PASS, 'getblocktemplate')
    .then(res => {
      console.log(res.data.result)
    })
    .catch(err => console.log(err))

}

function main(args) {
  standalone_miner(args[2], args[3], args[4], args[5], args[6])
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
      .catch(err => reject(err))
  })
}

main(process.argv)

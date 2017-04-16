#!/usr/bin/env node

// const Plotly = require('plotly.js/lib/core');
const sortBy = require('sort-by')
const fs = require('fs');
const _ = require('lodash')

const path = 'data.json'

fs.readFile(path, 'utf8', function(err, data) {
  if (err) throw err;
  let obj = JSON.parse(data).values.sort(sortBy('-y'));
  let objGroupBy = _.groupBy(obj, function(n) {
    return n.y;
  })
  var json = {
    x: Object.keys(objGroupBy),
    y: Object.keys(objGroupBy).map(item => objGroupBy[item].length),
    type: 'scatter'
  }
  fs.writeFile("data.js", JSON.stringify(json), function(err) {
    if (err) {
      return console.log(err);
    }
    console.log("The file was saved!");
  });

});

function unixTime(unixtime) {

  var u = new Date(unixtime * 1000);

  return u.getUTCFullYear() +
    '-' + ('0' + u.getUTCMonth()).slice(-2) +
    '-' + ('0' + u.getUTCDate()).slice(-2) +
    ' ' + ('0' + u.getUTCHours()).slice(-2) +
    ':' + ('0' + u.getUTCMinutes()).slice(-2) +
    ':' + ('0' + u.getUTCSeconds()).slice(-2) +
    '.' + (u.getUTCMilliseconds() / 1000).toFixed(3).slice(2, 5)
};

// var trace1 = {
//   x: data.map(function(item) {
//     return [item.x]
//   }),
//   y: res.map(function(item) {
//     return [item.y]
//   }),
//   type: 'scatter'
// };

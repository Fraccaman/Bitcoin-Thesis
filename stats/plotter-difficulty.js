#!/usr/bin/env node

// const Plotly = require('plotly.js/lib/core');
const sortBy = require('sort-by')
const fs = require('fs')
const _ = require('lodash')
const stats = require('simple-statistics')

const path = 'stats/data-difficulty-3y.json'

fs.readFile(path, 'utf8', function(err, data) {
  if (err) throw err;
  let obj = JSON.parse(data).values.slice(0, 364)

  var json = {
    x: Array.from(Array(365), (_, i) => i),
    y: Object.keys(obj).map(item => obj[item].y),
    type: 'scatter',
    name: '1st year',
  }

  console.log('MIN: ' + stats.min(json.y));
  console.log('MAX: ' + stats.max(json.y));
  console.log('MEAN: ' + stats.mean(json.y));
  console.log('----------------------------')

  let obj2 = JSON.parse(data).values.slice(365, 729);
  var json2 = {
    x: Array.from(Array(365), (_, i) => i),
    y: Object.keys(obj2).map(item => obj2[item].y),
    type: 'scatter',
    name: '2nd year',
  }

  console.log('MIN: ' + stats.min(json2.y));
  console.log('MAX: ' + stats.max(json2.y));
  console.log('MEAN: ' + stats.mean(json2.y));
  console.log('----------------------------')

  let obj3 = JSON.parse(data).values.slice(730, JSON.parse(data).values.length);
  var json3 = {
    x: Array.from(Array(365), (_, i) => i),
    y: Object.keys(obj3).map(item => obj3[item].y),
    type: 'scatter',
    name: '3rd year',
  }

  console.log('MIN: ' + stats.min(json3.y));
  console.log('MAX: ' + stats.max(json3.y));
  console.log('MEAN: ' + stats.mean(json3.y));

  const index  =
  `<head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  </head>

  <body>

    <div id="myDiv1" style="width: 100%; height: 100%;"></div>
    <div id="myDiv2" style="width: 100%; height: 100%;"></div>
    <script>
      var data = [${JSON.stringify(json)}, ${JSON.stringify(json2)}, ${JSON.stringify(json3)}]
      Plotly.newPlot('myDiv1', data);
      // var data2 = [${JSON.stringify(json2)}]
      // Plotly.newPlot('myDiv2', data2);
    </script>
  </body>`

  fs.writeFile("stats/index.html", index, function(err) {
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

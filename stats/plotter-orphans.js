#!/usr/bin/env node

// const Plotly = require('plotly.js/lib/core');
const sortBy = require('sort-by')
const fs = require('fs');
const _ = require('lodash')

const path = 'stats/data-orphans.json'

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

  const index  =
  `<head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  </head>

  <body>

    <div id="myDiv" style="width: 100%; height: 100%;">
      <!-- Plotly chart will be drawn inside this DIV -->
    </div>
    <script>
      var data = [${JSON.stringify(json)}]
      Plotly.newPlot('myDiv', data);
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

#!/usr/bin/env node

// const Plotly = require('plotly.js/lib/core');
const sortBy = require('sort-by')
const fs = require('fs');
const _ = require('lodash')

const path = 'stats/data-orphans-3y.json'

fs.readFile(path, 'utf8', function(err, data) {
  if (err) throw err;
  let obj = JSON.parse(data).values.slice(0, 364).sort(sortBy('-y'))
  let objGroupBy = _.groupBy(obj, function(n) {
    return n.y;
  })
  var json = {
    x: Object.keys(objGroupBy),
    y: Object.keys(objGroupBy).map(item => objGroupBy[item].length),
    type: 'scatter',
    name: '1st year',
  }

  let obj2 = JSON.parse(data).values.slice(365, 729);
  let objGroupBy2 = _.groupBy(obj2, function(n) {
    return n.y;
  })
  var json2 = {
    x: Object.keys(objGroupBy2),
    y: Object.keys(objGroupBy2).map(item => objGroupBy2[item].length),
    type: 'scatter',
    name: '2nd year',
  }

  let obj3 = JSON.parse(data).values.slice(730, JSON.parse(data).values.length).sort(sortBy('-y'));
  let objGroupBy3 = _.groupBy(obj3, function(n) {
    return n.y;
  })
  var json3 = {
    x: Object.keys(objGroupBy3),
    y: Object.keys(objGroupBy3).map(item => objGroupBy3[item].length),
    type: 'scatter',
    name: '3rd year',
  }

  var json4 = {
    x: [30436124847.167282, 82813528994.3985, 285952065701.3271],
    y: [261, 217, 95],
    type: 'scatter',
    name: 'testing'
  }

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
      var data2 = [${JSON.stringify(json4)}]
      Plotly.newPlot('myDiv2', data2);
    </script>
  </body>`

  fs.writeFile("stats/index2.html", index, function(err) {
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

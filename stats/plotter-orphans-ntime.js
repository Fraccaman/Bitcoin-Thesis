#!/usr/bin/env node

const sortBy = require('sort-by')
const fs = require('fs');
const _ = require('lodash')
const stats = require('simple-statistics')
var sleep = require('system-sleep');

const path = 'stats/data-orphans-3y.json'
const path2 = 'stats/data-difficulty-3y.json'
const path3  = 'stats/data-hashrate-3y.json'

let diff;
let orph;
let hash;

fs.readFile(path2, 'utf8', function(err, data) {

  let pdata = JSON.parse(data).values

  var total = []

  let tmp = {
    type: 'scatter',
    x: [],
    y: []
  }

  for (let i = 0; i < Math.floor(pdata.length / 30); i++) {
    let tempX = []
    let tempY = []
    for (let j = 30*i; j < 30*i + 30; j++) {
      tempX.push(j)
      tempY.push(pdata[j].y)
    }
      tmp.x.push(tempX[0])
      tmp.y.push(stats.mean(tempY))
  }

  diff = tmp;

  const index  =
  `<head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  </head>

  <body>
    <div id="myDiv2" style="width: 100%; height: 100%;"></div>
    <script>
      var data2 = [${JSON.stringify(tmp)}]
      Plotly.newPlot('myDiv2', data2);
    </script>
  </body>`

  fs.writeFile("stats/index3.html", index, function(err) {
    if (err) {
      return console.log(err);
    }
    console.log("The file was saved!");
  });

});

fs.readFile(path, 'utf8', function(err, data) {

  let pdata = JSON.parse(data).values

  var total = []

  let tmp = {
    type: 'scatter',
    x: [],
    y: []
  }

  for (let i = 0; i < Math.floor(pdata.length / 30); i++) {
    let tempX = []
    let tempY = []
    for (let j = 30*i; j < 30*i + 30; j++) {
      tempX.push(j)
      tempY.push(pdata[j].y)
    }
      tmp.x.push(tempX[0])
      tmp.y.push(stats.mean(tempY))
  }

  orph = tmp

  const index  =
  `<head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  </head>

  <body>
    <div id="myDiv2" style="width: 100%; height: 100%;"></div>
    <script>
      var data2 = [${JSON.stringify(tmp)}]
      Plotly.newPlot('myDiv2', data2);
    </script>
  </body>`

  fs.writeFile("stats/index4.html", index, function(err) {
    if (err) {
      return console.log(err);
    }
    console.log("The file was saved!");
  });

});

fs.readFile(path3, 'utf8', function(err, data) {

  let pdata = JSON.parse(data).values

  var total = []

  let tmp = {
    type: 'scatter',
    x: [],
    y: []
  }

  for (let i = 0; i < Math.floor(pdata.length / 30); i++) {
    let tempX = []
    let tempY = []
    for (let j = 30*i; j < 30*i + 30; j++) {
      tempX.push(j)
      tempY.push(pdata[j].y)
    }
      tmp.x.push(tempX[0])
      tmp.y.push(stats.mean(tempY))
  }

  hash = tmp

  const index  =
  `<head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  </head>

  <body>
    <div id="myDiv2" style="width: 100%; height: 100%;"></div>
    <script>
      var data2 = [${JSON.stringify(tmp)}]
      Plotly.newPlot('myDiv2', data2);
    </script>
  </body>`

  fs.writeFile("stats/index6.html", index, function(err) {
    if (err) {
      return console.log(err);
    }
    console.log("The file was saved!");
  });

});

sleep(2000);

fs.readFile(path, 'utf8', function(err, data) {

  test = []
  for (var i = 0; i < hash.y.length; i++) {
    test.push({ ratio: diff.y[i] / hash.y[i] , orp: orph.y[i] })
  }

  test.sort(function(a, b) {
    return a.ratio - b.ratio
  })

  console.log(test);


  let temp = {
    type: 'scatter',
    x: test.map(function(item, index) { return item.ratio } ),
    y: test.map(function(item, index) { return item.orp } )
  }

  let newx = temp.x.sort(function(a, b) {
    return a - b
  })

  temp.x = newx

  const index  =
  `<head>
    <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
  </head>

  <body>
    <div id="myDiv2" style="width: 100%; height: 100%;"></div>
    <script>
      var data2 = [${JSON.stringify(temp)}]
      Plotly.newPlot('myDiv2', data2);
    </script>
  </body>`

  fs.writeFile("stats/index7.html", index, function(err) {
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

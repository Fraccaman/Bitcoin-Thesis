#!/usr/bin/env node

const sortBy = require('sort-by')
const fs = require('fs');
const _ = require('lodash')
const stats = require('simple-statistics')

const pathInterval = 'stats/data-time-interval.json'
const pathOrphans = 'stats/data-orphans-3y.json'
const pathDifficulty = 'stats/data-difficulty.json'

fs.readFile(pathInterval, 'utf8', function(err, data) {
  if (err) throw err;

  // FORMAT INTERVAL

  let blocksTime = Object.entries(JSON.parse(data)).reduce(function(a, b) {
    a.push(b[1]['Time Between Blocks'])
    return a
  }, [])

  blocksTime.sort(function(a, b) {
    return a - b
  })

  var jsonInterval = {
    x: Array.from(Array(blocksTime.length), (_, i) => i),
    y: blocksTime,
    type: 'scatter'
  }

  fs.readFile(pathOrphans, 'utf8', function(err, data) {
    if (err) throw err;
    let obj = JSON.parse(data).values.sort(sortBy('-y'));
    // FORMAT ORPHANS

    let objGroupBy = _.groupBy(obj, function(n) {
      return n.y;
    })
    // var jsonOrphans = {
    //   x: Object.keys(objGroupBy),
    //   y: Object.keys(objGroupBy).map(item => objGroupBy[item].length),
    //   type: 'scatter'
    // }

    var jsonOrphans = {
      x: Array.from(Array(objGroupBy.length), (_, i) => i),
      y: obj.map(item => console.log(item.y)),
      type: 'scatter'
    }


    fs.readFile(pathDifficulty, 'utf8', function(err, data) {
      // if (err) throw err;
      // let obj = JSON.parse(data)
      //
      // // FORMAT DIFFICULTY
      //
      // let objGroupBy = _.groupBy(obj, function(n) {
      //   return n.y;
      // })
      // var jsonDifficulty = {
      //   x: Array.from(Array(blocksTime.length), (_, i) => i),
      //   y: Object.keys(objGroupBy).map(item => objGroupBy[item].length),
      //   type: 'scatter'
      // }

      const index =
      `<head>
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
      </head>

      <body>

        <div id="myDiv" style="width: 100%; height: 100%;">
          <!-- Plotly chart will be drawn inside this DIV -->
        </div>
        <script>
          var data = [${JSON.stringify(jsonOrphans)}, ${JSON.stringify(jsonInterval)}]
          Plotly.newPlot('myDiv', data);
        </script>
      </body>`

      fs.writeFile("stats/index.html", index, function(err) {
        if (err) {
          return console.log(err);
        }
        console.log("The file was saved!");
      });
    })
  })
});

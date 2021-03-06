#!/usr/bin/env node

const sortBy = require('sort-by')
const fs = require('fs');
const _ = require('lodash')
const stats = require('simple-statistics')

const path = 'stats/data-time-interval.json'

fs.readFile(path, 'utf8', function(err, data) {
  if (err) throw err;

  let blocksTime = Object.entries(JSON.parse(data)).reduce(function(a, b) {
    a.push(b[1]['Time Between Blocks'])
    return a
  }, [])

  console.log('MIN: ' + stats.min(blocksTime));
  console.log('MAX: ' + stats.max(blocksTime));
  console.log('MEAN: ' + stats.mean(blocksTime));
  console.log('SD: ' + stats.standardDeviation(blocksTime));
  console.log('VARIANCE: ' + stats.variance(blocksTime));
  console.log('MAD: ' + stats.medianAbsoluteDeviation(blocksTime));
  console.log('SS: ' + stats.sampleSkewness(blocksTime));

  // make a bunch of standard variates
  let test = []
  const n = 2000


  // use medianAbsoluteDeviation instead of standard deviation
  for (i = 0; i < n; i++) {
    test.push(marsagliaPolarMethod(stats.mean(blocksTime), stats.medianAbsoluteDeviation(blocksTime)));
  }

  console.log('MIN-MPM: ' + stats.min(test));
  console.log('MAX-MPM: ' + stats.max(test));

  test.sort(function(a, b) {
    return a - b
  });

  var json = {
    x: Array.from(Array(n), (_, i) => i),
    y: test,
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

// get a random number from a normal distribution
function marsagliaPolarMethod(mean, stdDev) {
  let spare;
  let isSpareReady = false;
  if (isSpareReady) {
    isSpareReady = false;
    return spare * stdDev + mean;
  } else {
    let u, v, s;
    do {
      u = Math.random() * 2 - 1;
      v = Math.random() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s == 0);
    let mul = Math.sqrt(-2.0 * Math.log(s) / s);
    spare = v * mul;
    isSpareReady = true;
    return mean + stdDev * u * mul;
  }
}

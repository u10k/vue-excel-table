const betterWebpackProgressCompact = require('./compact');
const betterWebpackProgressDetailed = require('./detailed');
const betterWebpackProgressBar = require('./bar');


module.exports = function betterWebpackProgress(options) {
  if (options && options.mode === 'detailed') {
    return betterWebpackProgressDetailed(options);
  }
  else if (options && options.mode === 'bar') {
    return betterWebpackProgressBar(options);
  }
  else {
    return betterWebpackProgressCompact(options);
  }
}

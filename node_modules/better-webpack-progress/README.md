# Better Webpack progress

A callback function to pass to Webpack [`ProgressPlugin`](https://github.com/webpack/docs/wiki/internal-webpack-plugins#progresspluginhandler) to get a nicer output. Heavily inspired by [dominique-mueller/simple-progress-webpack-plugin](https://github.com/dominique-mueller/simple-progress-webpack-plugin)


## Installation

Install with your favorite package manager:

```bash
$ yarn add --dev better-webpack-progress
```


## Usage

This package is designed to be used with the default Webpack `ProgressPlugin`.

```javascript
const webpack = require('webpack');
const betterProgress = require('better-webpack-progress');

module.exports = {
  // ... rest of Webpack config
  plugins: [
    new webpack.ProgressPlugin(betterProgress({
      mode: 'compact',  // or 'detailed' or 'bar'
    })),
  ]
  // ... rest of Webpack config
};
```

## Modes

There are three output modes:

 - **compact**: Is better suited for usage during development. Reuses CLI lines when logging.
 - **bar**: Is better suited for usage during development. Reuses CLI lines when logging.
 - **detailed**: Is better suited for usage in a CI environment. Doesn't reuse CLI lines when logging.


## LICENSE

[MIT](LICENSE)

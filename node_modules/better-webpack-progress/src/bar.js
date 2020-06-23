const chalk = require('chalk');
const ProgressBar = require('@larsbs/progress');
const logUpdate = require('log-update');
const cliTruncate = require('cli-truncate');
const figures = require('figures');


process.on('SIGINT', () =>  process.exit() );


function capitalize(str) {
  if (str == null || str === '') return str;
  return str[0].toUpperCase() + str.slice(1);
}


function getShortenedPath(moduleName) {
  if ( ! moduleName) {
    return '';
  }
  return moduleName.replace(process.cwd() + '/', '');
}


function parseModuleProgress(moduleProgress) {
  if ( ! moduleProgress) {
    return '';
  }
  const [ current, total ] = moduleProgress.split('/');
  return `${current} of ${total}`;
}


function truncate(message) {
  const width = process.stdout.columns ? process.stdout.columns - 10 : 50;
  return cliTruncate(message, width, { position: 'middle' });
}


function getModulesMessage(moduleProgress, moduleName) {
  const modulesMessage = `${parseModuleProgress(moduleProgress)} :: ${getShortenedPath(moduleName)}`;
  return (moduleProgress && moduleName) ? modulesMessage : '';
}


module.exports = function betterWebpackProgressBar(options) {
  const format = `${chalk.bold(':msg')}  :bar  ${chalk.green(':percent')} :mpr`;
  const progressBar = new ProgressBar(format, {
    complete: chalk.green('═'),
    incomplete: chalk.grey('─'),
    width: 30,
    total: 100,
    raw: true,
  });
  return (percentage, message, moduleProgress, activeModules, moduleName) => {
    const detailedMessage = truncate(getModulesMessage(moduleProgress, moduleName)) || moduleProgress;
    progressBar.update(percentage, {
      msg: capitalize(message),
      mpr: `\n ${chalk.grey(`→ ${detailedMessage}`)}`,
    });
    logUpdate(progressBar.lastDraw);
    if (percentage == 1) {
      logUpdate.clear();
      logUpdate.done();
      if (options.customSummary) {
        options.customSummary();
      }
    }
  };
}

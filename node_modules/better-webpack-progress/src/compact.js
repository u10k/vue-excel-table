const chalk = require('chalk');
const figures = require('figures');
const ora = require('ora');
const cliTruncate = require('cli-truncate');


process.on('SIGINT', () => {
  process.exit();
});


function clearTerminal() {
  return process.stdout.write('\033c');
}


function toUpperCase(message) {
  if ( ! message) {
    return '';
  }
  return message[0].toUpperCase() + message.slice(1);
}


function getSimpleMessage(message) {
  if (message.match(/building|sealing/i)) {
    return 'Building modules';
  }
  if (message.match(/asset optimization/i)) {
    return 'Processing modules';
  }
  if (message.match(/optimization|optimizing|reviving/i)) {
    return 'Optimizing modules';
  }
  if (message.match(/processing|hashing|recording/i)) {
    return 'Processing modules';
  }
  return toUpperCase(message);
}


function getShortenedPath(moduleName) {
  if ( ! moduleName) {
    return '';
  }
  return moduleName.replace(process.cwd() + '/', '');
}


function initialMessage() {
  console.log(chalk.grey.bold('Webpack starting...'))
}


function parseModuleProgress(moduleProgress) {
  if ( ! moduleProgress) {
    return '';
  }
  const [ current, total ] = moduleProgress.split('/');
  return `${current} of ${total}`;
}


function getModulesMessage(moduleProgress, moduleName) {
  const modulesMessage = chalk.grey.dim(`${figures.arrowRight} ${parseModuleProgress(moduleProgress)} :: ${getShortenedPath(moduleName)}`);

  if (process.stdout.columns != null) {
    return cliTruncate(
      (moduleProgress && moduleName) ? '\n  ' + modulesMessage : '',
      process.stdout.columns,
      { position: 'middle' },
    );
  }
  else {
    return (moduleProgress && moduleName) ? '\n  ' + modulesMessage : '';
  }
}


function getLogMessage(percentage, message, moduleProgress, moduleName) {
  const newMessage = getSimpleMessage(message);
  const modulesMessage = getModulesMessage(moduleProgress, moduleName);
  return `${newMessage} (${Math.floor(percentage * 100)}%)` + modulesMessage;
}


module.exports = function betterWebpackProgressCompact(options) {
  initialMessage();
  const spinner = ora({ hideCursor: false });
  let latestMessage = null;
  return (percentage, message, moduleProgress, activeModules, moduleName) => {
    const newMessage = getSimpleMessage(message);
    if ( ! latestMessage || newMessage === latestMessage) {
      spinner.text = getLogMessage(percentage, message, moduleProgress, moduleName);
      spinner.start();
    }
    else if (percentage === 1) {
      spinner.text = getLogMessage(percentage, message, moduleProgress, moduleName);
      spinner.succeed(latestMessage);
    }
    else {
      spinner.succeed(latestMessage);
      spinner.text = getLogMessage(percentage, message, moduleProgress, moduleName);
      spinner.start();
    }
    latestMessage = newMessage;
  };
};

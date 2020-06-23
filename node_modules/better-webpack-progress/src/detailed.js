const chalk = require('chalk');
const figures = require('figures');
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


function getPercentage(percentage) {
  return Math.floor(percentage * 100) + '%';
}


function truncate(message) {
  if ( ! process.stdout.colums) {
    return message;
  }
  return cliTruncate(message, process.stdout.columns, { position: 'middle' });
}


function getModulesMessage(moduleProgress, moduleName) {
  const modulesMessage = `${parseModuleProgress(moduleProgress)} :: ${getShortenedPath(moduleName)}`;
  return (moduleProgress && moduleName) ? modulesMessage : '';
}


function getLogMessage(percentage, message, moduleProgress, moduleName) {
  const modulesMessage = getModulesMessage(moduleProgress, moduleName);
  const finalMessage = `  ${figures.arrowRight} [${getPercentage(percentage)}] ${modulesMessage}`
  return modulesMessage ? finalMessage : '';
}


module.exports = function betterWebpackProgressCompact(options) {
  initialMessage();
  let latestMessage = null;
  return (percentage, message, moduleProgress, activeModules, moduleName) => {
    const newMessage = getSimpleMessage(message);
    if (newMessage === latestMessage) {
      const logMessage = getLogMessage(percentage, message, moduleProgress, moduleName);
      if (logMessage) {
        console.log(chalk.grey.dim(truncate(logMessage)));
      }
    }
    else if (percentage === 1 && newMessage) {
      console.log(figures.pointer + ' ' + newMessage);
    }
    else {
      if (newMessage) {
        console.log(figures.pointer + ' ' + newMessage);
      }
      const logMessage = getLogMessage(percentage, message, moduleProgress, moduleName);
      if (logMessage) {
        console.log(chalk.grey.dim(truncate(logMessage)));
      }
    }
    latestMessage = newMessage;
  };
};

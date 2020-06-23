'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _minimatch = require('minimatch');

var _minimatch2 = _interopRequireDefault(_minimatch);

var _importType = require('../core/importType');

var _importType2 = _interopRequireDefault(_importType);

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const defaultGroups = ['builtin', 'external', 'parent', 'sibling', 'index'];

// REPORTING AND FIXING

function reverse(array) {
  return array.map(function (v) {
    return {
      name: v.name,
      rank: -v.rank,
      node: v.node
    };
  }).reverse();
}

function getTokensOrCommentsAfter(sourceCode, node, count) {
  let currentNodeOrToken = node;
  const result = [];
  for (let i = 0; i < count; i++) {
    currentNodeOrToken = sourceCode.getTokenOrCommentAfter(currentNodeOrToken);
    if (currentNodeOrToken == null) {
      break;
    }
    result.push(currentNodeOrToken);
  }
  return result;
}

function getTokensOrCommentsBefore(sourceCode, node, count) {
  let currentNodeOrToken = node;
  const result = [];
  for (let i = 0; i < count; i++) {
    currentNodeOrToken = sourceCode.getTokenOrCommentBefore(currentNodeOrToken);
    if (currentNodeOrToken == null) {
      break;
    }
    result.push(currentNodeOrToken);
  }
  return result.reverse();
}

function takeTokensAfterWhile(sourceCode, node, condition) {
  const tokens = getTokensOrCommentsAfter(sourceCode, node, 100);
  const result = [];
  for (let i = 0; i < tokens.length; i++) {
    if (condition(tokens[i])) {
      result.push(tokens[i]);
    } else {
      break;
    }
  }
  return result;
}

function takeTokensBeforeWhile(sourceCode, node, condition) {
  const tokens = getTokensOrCommentsBefore(sourceCode, node, 100);
  const result = [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (condition(tokens[i])) {
      result.push(tokens[i]);
    } else {
      break;
    }
  }
  return result.reverse();
}

function findOutOfOrder(imported) {
  if (imported.length === 0) {
    return [];
  }
  let maxSeenRankNode = imported[0];
  return imported.filter(function (importedModule) {
    const res = importedModule.rank < maxSeenRankNode.rank;
    if (maxSeenRankNode.rank < importedModule.rank) {
      maxSeenRankNode = importedModule;
    }
    return res;
  });
}

function findRootNode(node) {
  let parent = node;
  while (parent.parent != null && parent.parent.body == null) {
    parent = parent.parent;
  }
  return parent;
}

function findEndOfLineWithComments(sourceCode, node) {
  const tokensToEndOfLine = takeTokensAfterWhile(sourceCode, node, commentOnSameLineAs(node));
  let endOfTokens = tokensToEndOfLine.length > 0 ? tokensToEndOfLine[tokensToEndOfLine.length - 1].range[1] : node.range[1];
  let result = endOfTokens;
  for (let i = endOfTokens; i < sourceCode.text.length; i++) {
    if (sourceCode.text[i] === '\n') {
      result = i + 1;
      break;
    }
    if (sourceCode.text[i] !== ' ' && sourceCode.text[i] !== '\t' && sourceCode.text[i] !== '\r') {
      break;
    }
    result = i + 1;
  }
  return result;
}

function commentOnSameLineAs(node) {
  return token => (token.type === 'Block' || token.type === 'Line') && token.loc.start.line === token.loc.end.line && token.loc.end.line === node.loc.end.line;
}

function findStartOfLineWithComments(sourceCode, node) {
  const tokensToEndOfLine = takeTokensBeforeWhile(sourceCode, node, commentOnSameLineAs(node));
  let startOfTokens = tokensToEndOfLine.length > 0 ? tokensToEndOfLine[0].range[0] : node.range[0];
  let result = startOfTokens;
  for (let i = startOfTokens - 1; i > 0; i--) {
    if (sourceCode.text[i] !== ' ' && sourceCode.text[i] !== '\t') {
      break;
    }
    result = i;
  }
  return result;
}

function isPlainRequireModule(node) {
  if (node.type !== 'VariableDeclaration') {
    return false;
  }
  if (node.declarations.length !== 1) {
    return false;
  }
  const decl = node.declarations[0];
  const result = decl.id && (decl.id.type === 'Identifier' || decl.id.type === 'ObjectPattern') && decl.init != null && decl.init.type === 'CallExpression' && decl.init.callee != null && decl.init.callee.name === 'require' && decl.init.arguments != null && decl.init.arguments.length === 1 && decl.init.arguments[0].type === 'Literal';
  return result;
}

function isPlainImportModule(node) {
  return node.type === 'ImportDeclaration' && node.specifiers != null && node.specifiers.length > 0;
}

function isPlainImportEquals(node) {
  return node.type === 'TSImportEqualsDeclaration' && node.moduleReference.expression;
}

function canCrossNodeWhileReorder(node) {
  return isPlainRequireModule(node) || isPlainImportModule(node) || isPlainImportEquals(node);
}

function canReorderItems(firstNode, secondNode) {
  const parent = firstNode.parent;

  var _sort = [parent.body.indexOf(firstNode), parent.body.indexOf(secondNode)].sort(),
      _sort2 = _slicedToArray(_sort, 2);

  const firstIndex = _sort2[0],
        secondIndex = _sort2[1];

  const nodesBetween = parent.body.slice(firstIndex, secondIndex + 1);
  for (var nodeBetween of nodesBetween) {
    if (!canCrossNodeWhileReorder(nodeBetween)) {
      return false;
    }
  }
  return true;
}

function fixOutOfOrder(context, firstNode, secondNode, order) {
  const sourceCode = context.getSourceCode();

  const firstRoot = findRootNode(firstNode.node);
  const firstRootStart = findStartOfLineWithComments(sourceCode, firstRoot);
  const firstRootEnd = findEndOfLineWithComments(sourceCode, firstRoot);

  const secondRoot = findRootNode(secondNode.node);
  const secondRootStart = findStartOfLineWithComments(sourceCode, secondRoot);
  const secondRootEnd = findEndOfLineWithComments(sourceCode, secondRoot);
  const canFix = canReorderItems(firstRoot, secondRoot);

  let newCode = sourceCode.text.substring(secondRootStart, secondRootEnd);
  if (newCode[newCode.length - 1] !== '\n') {
    newCode = newCode + '\n';
  }

  const message = '`' + secondNode.name + '` import should occur ' + order + ' import of `' + firstNode.name + '`';

  if (order === 'before') {
    context.report({
      node: secondNode.node,
      message: message,
      fix: canFix && (fixer => fixer.replaceTextRange([firstRootStart, secondRootEnd], newCode + sourceCode.text.substring(firstRootStart, secondRootStart)))
    });
  } else if (order === 'after') {
    context.report({
      node: secondNode.node,
      message: message,
      fix: canFix && (fixer => fixer.replaceTextRange([secondRootStart, firstRootEnd], sourceCode.text.substring(secondRootEnd, firstRootEnd) + newCode))
    });
  }
}

function reportOutOfOrder(context, imported, outOfOrder, order) {
  outOfOrder.forEach(function (imp) {
    const found = imported.find(function hasHigherRank(importedItem) {
      return importedItem.rank > imp.rank;
    });
    fixOutOfOrder(context, found, imp, order);
  });
}

function makeOutOfOrderReport(context, imported) {
  const outOfOrder = findOutOfOrder(imported);
  if (!outOfOrder.length) {
    return;
  }
  // There are things to report. Try to minimize the number of reported errors.
  const reversedImported = reverse(imported);
  const reversedOrder = findOutOfOrder(reversedImported);
  if (reversedOrder.length < outOfOrder.length) {
    reportOutOfOrder(context, reversedImported, reversedOrder, 'after');
    return;
  }
  reportOutOfOrder(context, imported, outOfOrder, 'before');
}

function getSorter(ascending) {
  let multiplier = ascending ? 1 : -1;

  return function importsSorter(importA, importB) {
    let result;

    if (importA < importB || importB === null) {
      result = -1;
    } else if (importA > importB || importA === null) {
      result = 1;
    } else {
      result = 0;
    }

    return result * multiplier;
  };
}

function mutateRanksToAlphabetize(imported, alphabetizeOptions) {
  const groupedByRanks = imported.reduce(function (acc, importedItem) {
    if (!Array.isArray(acc[importedItem.rank])) {
      acc[importedItem.rank] = [];
    }
    acc[importedItem.rank].push(importedItem.name);
    return acc;
  }, {});

  const groupRanks = Object.keys(groupedByRanks);

  const sorterFn = getSorter(alphabetizeOptions.order === 'asc');
  const comparator = alphabetizeOptions.caseInsensitive ? (a, b) => sorterFn(String(a).toLowerCase(), String(b).toLowerCase()) : (a, b) => sorterFn(a, b);
  // sort imports locally within their group
  groupRanks.forEach(function (groupRank) {
    groupedByRanks[groupRank].sort(comparator);
  });

  // assign globally unique rank to each import
  let newRank = 0;
  const alphabetizedRanks = groupRanks.sort().reduce(function (acc, groupRank) {
    groupedByRanks[groupRank].forEach(function (importedItemName) {
      acc[importedItemName] = parseInt(groupRank, 10) + newRank;
      newRank += 1;
    });
    return acc;
  }, {});

  // mutate the original group-rank with alphabetized-rank
  imported.forEach(function (importedItem) {
    importedItem.rank = alphabetizedRanks[importedItem.name];
  });
}

// DETECTING

function computePathRank(ranks, pathGroups, path, maxPosition) {
  for (let i = 0, l = pathGroups.length; i < l; i++) {
    var _pathGroups$i = pathGroups[i];
    const pattern = _pathGroups$i.pattern,
          patternOptions = _pathGroups$i.patternOptions,
          group = _pathGroups$i.group;
    var _pathGroups$i$positio = _pathGroups$i.position;
    const position = _pathGroups$i$positio === undefined ? 1 : _pathGroups$i$positio;

    if ((0, _minimatch2.default)(path, pattern, patternOptions || { nocomment: true })) {
      return ranks[group] + position / maxPosition;
    }
  }
}

function computeRank(context, ranks, name, type, excludedImportTypes) {
  const impType = (0, _importType2.default)(name, context);
  let rank;
  if (!excludedImportTypes.has(impType)) {
    rank = computePathRank(ranks.groups, ranks.pathGroups, name, ranks.maxPosition);
  }
  if (typeof rank === 'undefined') {
    rank = ranks.groups[impType];
  }
  if (type !== 'import') {
    rank += 100;
  }

  return rank;
}

function registerNode(context, node, name, type, ranks, imported, excludedImportTypes) {
  const rank = computeRank(context, ranks, name, type, excludedImportTypes);
  if (rank !== -1) {
    imported.push({ name, rank, node });
  }
}

function isInVariableDeclarator(node) {
  return node && (node.type === 'VariableDeclarator' || isInVariableDeclarator(node.parent));
}

const types = ['builtin', 'external', 'internal', 'unknown', 'parent', 'sibling', 'index'];

// Creates an object with type-rank pairs.
// Example: { index: 0, sibling: 1, parent: 1, external: 1, builtin: 2, internal: 2 }
// Will throw an error if it contains a type that does not exist, or has a duplicate
function convertGroupsToRanks(groups) {
  const rankObject = groups.reduce(function (res, group, index) {
    if (typeof group === 'string') {
      group = [group];
    }
    group.forEach(function (groupItem) {
      if (types.indexOf(groupItem) === -1) {
        throw new Error('Incorrect configuration of the rule: Unknown type `' + JSON.stringify(groupItem) + '`');
      }
      if (res[groupItem] !== undefined) {
        throw new Error('Incorrect configuration of the rule: `' + groupItem + '` is duplicated');
      }
      res[groupItem] = index;
    });
    return res;
  }, {});

  const omittedTypes = types.filter(function (type) {
    return rankObject[type] === undefined;
  });

  return omittedTypes.reduce(function (res, type) {
    res[type] = groups.length;
    return res;
  }, rankObject);
}

function convertPathGroupsForRanks(pathGroups) {
  const after = {};
  const before = {};

  const transformed = pathGroups.map((pathGroup, index) => {
    const group = pathGroup.group,
          positionString = pathGroup.position;

    let position = 0;
    if (positionString === 'after') {
      if (!after[group]) {
        after[group] = 1;
      }
      position = after[group]++;
    } else if (positionString === 'before') {
      if (!before[group]) {
        before[group] = [];
      }
      before[group].push(index);
    }

    return Object.assign({}, pathGroup, { position });
  });

  let maxPosition = 1;

  Object.keys(before).forEach(group => {
    const groupLength = before[group].length;
    before[group].forEach((groupIndex, index) => {
      transformed[groupIndex].position = -1 * (groupLength - index);
    });
    maxPosition = Math.max(maxPosition, groupLength);
  });

  Object.keys(after).forEach(key => {
    const groupNextPosition = after[key];
    maxPosition = Math.max(maxPosition, groupNextPosition - 1);
  });

  return {
    pathGroups: transformed,
    maxPosition: maxPosition > 10 ? Math.pow(10, Math.ceil(Math.log10(maxPosition))) : 10
  };
}

function fixNewLineAfterImport(context, previousImport) {
  const prevRoot = findRootNode(previousImport.node);
  const tokensToEndOfLine = takeTokensAfterWhile(context.getSourceCode(), prevRoot, commentOnSameLineAs(prevRoot));

  let endOfLine = prevRoot.range[1];
  if (tokensToEndOfLine.length > 0) {
    endOfLine = tokensToEndOfLine[tokensToEndOfLine.length - 1].range[1];
  }
  return fixer => fixer.insertTextAfterRange([prevRoot.range[0], endOfLine], '\n');
}

function removeNewLineAfterImport(context, currentImport, previousImport) {
  const sourceCode = context.getSourceCode();
  const prevRoot = findRootNode(previousImport.node);
  const currRoot = findRootNode(currentImport.node);
  const rangeToRemove = [findEndOfLineWithComments(sourceCode, prevRoot), findStartOfLineWithComments(sourceCode, currRoot)];
  if (/^\s*$/.test(sourceCode.text.substring(rangeToRemove[0], rangeToRemove[1]))) {
    return fixer => fixer.removeRange(rangeToRemove);
  }
  return undefined;
}

function makeNewlinesBetweenReport(context, imported, newlinesBetweenImports) {
  const getNumberOfEmptyLinesBetween = (currentImport, previousImport) => {
    const linesBetweenImports = context.getSourceCode().lines.slice(previousImport.node.loc.end.line, currentImport.node.loc.start.line - 1);

    return linesBetweenImports.filter(line => !line.trim().length).length;
  };
  let previousImport = imported[0];

  imported.slice(1).forEach(function (currentImport) {
    const emptyLinesBetween = getNumberOfEmptyLinesBetween(currentImport, previousImport);

    if (newlinesBetweenImports === 'always' || newlinesBetweenImports === 'always-and-inside-groups') {
      if (currentImport.rank !== previousImport.rank && emptyLinesBetween === 0) {
        context.report({
          node: previousImport.node,
          message: 'There should be at least one empty line between import groups',
          fix: fixNewLineAfterImport(context, previousImport)
        });
      } else if (currentImport.rank === previousImport.rank && emptyLinesBetween > 0 && newlinesBetweenImports !== 'always-and-inside-groups') {
        context.report({
          node: previousImport.node,
          message: 'There should be no empty line within import group',
          fix: removeNewLineAfterImport(context, currentImport, previousImport)
        });
      }
    } else if (emptyLinesBetween > 0) {
      context.report({
        node: previousImport.node,
        message: 'There should be no empty line between import groups',
        fix: removeNewLineAfterImport(context, currentImport, previousImport)
      });
    }

    previousImport = currentImport;
  });
}

function getAlphabetizeConfig(options) {
  const alphabetize = options.alphabetize || {};
  const order = alphabetize.order || 'ignore';
  const caseInsensitive = alphabetize.caseInsensitive || false;

  return { order, caseInsensitive };
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      url: (0, _docsUrl2.default)('order')
    },

    fixable: 'code',
    schema: [{
      type: 'object',
      properties: {
        groups: {
          type: 'array'
        },
        pathGroupsExcludedImportTypes: {
          type: 'array'
        },
        pathGroups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string'
              },
              patternOptions: {
                type: 'object'
              },
              group: {
                type: 'string',
                enum: types
              },
              position: {
                type: 'string',
                enum: ['after', 'before']
              }
            },
            required: ['pattern', 'group']
          }
        },
        'newlines-between': {
          enum: ['ignore', 'always', 'always-and-inside-groups', 'never']
        },
        alphabetize: {
          type: 'object',
          properties: {
            caseInsensitive: {
              type: 'boolean',
              default: false
            },
            order: {
              enum: ['ignore', 'asc', 'desc'],
              default: 'ignore'
            }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    }]
  },

  create: function importOrderRule(context) {
    const options = context.options[0] || {};
    const newlinesBetweenImports = options['newlines-between'] || 'ignore';
    const pathGroupsExcludedImportTypes = new Set(options['pathGroupsExcludedImportTypes'] || ['builtin', 'external']);
    const alphabetize = getAlphabetizeConfig(options);
    let ranks;

    try {
      var _convertPathGroupsFor = convertPathGroupsForRanks(options.pathGroups || []);

      const pathGroups = _convertPathGroupsFor.pathGroups,
            maxPosition = _convertPathGroupsFor.maxPosition;

      ranks = {
        groups: convertGroupsToRanks(options.groups || defaultGroups),
        pathGroups,
        maxPosition
      };
    } catch (error) {
      // Malformed configuration
      return {
        Program: function (node) {
          context.report(node, error.message);
        }
      };
    }
    let imported = [];
    let level = 0;

    function incrementLevel() {
      level++;
    }
    function decrementLevel() {
      level--;
    }

    return {
      ImportDeclaration: function handleImports(node) {
        if (node.specifiers.length) {
          // Ignoring unassigned imports
          const name = node.source.value;
          registerNode(context, node, name, 'import', ranks, imported, pathGroupsExcludedImportTypes);
        }
      },
      TSImportEqualsDeclaration: function handleImports(node) {
        let name;
        if (node.moduleReference.type === 'TSExternalModuleReference') {
          name = node.moduleReference.expression.value;
        } else {
          name = null;
        }
        registerNode(context, node, name, 'import', ranks, imported, pathGroupsExcludedImportTypes);
      },
      CallExpression: function handleRequires(node) {
        if (level !== 0 || !(0, _staticRequire2.default)(node) || !isInVariableDeclarator(node.parent)) {
          return;
        }
        const name = node.arguments[0].value;
        registerNode(context, node, name, 'require', ranks, imported, pathGroupsExcludedImportTypes);
      },
      'Program:exit': function reportAndReset() {
        if (newlinesBetweenImports !== 'ignore') {
          makeNewlinesBetweenReport(context, imported, newlinesBetweenImports);
        }

        if (alphabetize.order !== 'ignore') {
          mutateRanksToAlphabetize(imported, alphabetize);
        }

        makeOutOfOrderReport(context, imported);

        imported = [];
      },
      FunctionDeclaration: incrementLevel,
      FunctionExpression: incrementLevel,
      ArrowFunctionExpression: incrementLevel,
      BlockStatement: incrementLevel,
      ObjectExpression: incrementLevel,
      'FunctionDeclaration:exit': decrementLevel,
      'FunctionExpression:exit': decrementLevel,
      'ArrowFunctionExpression:exit': decrementLevel,
      'BlockStatement:exit': decrementLevel,
      'ObjectExpression:exit': decrementLevel
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9vcmRlci5qcyJdLCJuYW1lcyI6WyJkZWZhdWx0R3JvdXBzIiwicmV2ZXJzZSIsImFycmF5IiwibWFwIiwidiIsIm5hbWUiLCJyYW5rIiwibm9kZSIsImdldFRva2Vuc09yQ29tbWVudHNBZnRlciIsInNvdXJjZUNvZGUiLCJjb3VudCIsImN1cnJlbnROb2RlT3JUb2tlbiIsInJlc3VsdCIsImkiLCJnZXRUb2tlbk9yQ29tbWVudEFmdGVyIiwicHVzaCIsImdldFRva2Vuc09yQ29tbWVudHNCZWZvcmUiLCJnZXRUb2tlbk9yQ29tbWVudEJlZm9yZSIsInRha2VUb2tlbnNBZnRlcldoaWxlIiwiY29uZGl0aW9uIiwidG9rZW5zIiwibGVuZ3RoIiwidGFrZVRva2Vuc0JlZm9yZVdoaWxlIiwiZmluZE91dE9mT3JkZXIiLCJpbXBvcnRlZCIsIm1heFNlZW5SYW5rTm9kZSIsImZpbHRlciIsImltcG9ydGVkTW9kdWxlIiwicmVzIiwiZmluZFJvb3ROb2RlIiwicGFyZW50IiwiYm9keSIsImZpbmRFbmRPZkxpbmVXaXRoQ29tbWVudHMiLCJ0b2tlbnNUb0VuZE9mTGluZSIsImNvbW1lbnRPblNhbWVMaW5lQXMiLCJlbmRPZlRva2VucyIsInJhbmdlIiwidGV4dCIsInRva2VuIiwidHlwZSIsImxvYyIsInN0YXJ0IiwibGluZSIsImVuZCIsImZpbmRTdGFydE9mTGluZVdpdGhDb21tZW50cyIsInN0YXJ0T2ZUb2tlbnMiLCJpc1BsYWluUmVxdWlyZU1vZHVsZSIsImRlY2xhcmF0aW9ucyIsImRlY2wiLCJpZCIsImluaXQiLCJjYWxsZWUiLCJhcmd1bWVudHMiLCJpc1BsYWluSW1wb3J0TW9kdWxlIiwic3BlY2lmaWVycyIsImlzUGxhaW5JbXBvcnRFcXVhbHMiLCJtb2R1bGVSZWZlcmVuY2UiLCJleHByZXNzaW9uIiwiY2FuQ3Jvc3NOb2RlV2hpbGVSZW9yZGVyIiwiY2FuUmVvcmRlckl0ZW1zIiwiZmlyc3ROb2RlIiwic2Vjb25kTm9kZSIsImluZGV4T2YiLCJzb3J0IiwiZmlyc3RJbmRleCIsInNlY29uZEluZGV4Iiwibm9kZXNCZXR3ZWVuIiwic2xpY2UiLCJub2RlQmV0d2VlbiIsImZpeE91dE9mT3JkZXIiLCJjb250ZXh0Iiwib3JkZXIiLCJnZXRTb3VyY2VDb2RlIiwiZmlyc3RSb290IiwiZmlyc3RSb290U3RhcnQiLCJmaXJzdFJvb3RFbmQiLCJzZWNvbmRSb290Iiwic2Vjb25kUm9vdFN0YXJ0Iiwic2Vjb25kUm9vdEVuZCIsImNhbkZpeCIsIm5ld0NvZGUiLCJzdWJzdHJpbmciLCJtZXNzYWdlIiwicmVwb3J0IiwiZml4IiwiZml4ZXIiLCJyZXBsYWNlVGV4dFJhbmdlIiwicmVwb3J0T3V0T2ZPcmRlciIsIm91dE9mT3JkZXIiLCJmb3JFYWNoIiwiaW1wIiwiZm91bmQiLCJmaW5kIiwiaGFzSGlnaGVyUmFuayIsImltcG9ydGVkSXRlbSIsIm1ha2VPdXRPZk9yZGVyUmVwb3J0IiwicmV2ZXJzZWRJbXBvcnRlZCIsInJldmVyc2VkT3JkZXIiLCJnZXRTb3J0ZXIiLCJhc2NlbmRpbmciLCJtdWx0aXBsaWVyIiwiaW1wb3J0c1NvcnRlciIsImltcG9ydEEiLCJpbXBvcnRCIiwibXV0YXRlUmFua3NUb0FscGhhYmV0aXplIiwiYWxwaGFiZXRpemVPcHRpb25zIiwiZ3JvdXBlZEJ5UmFua3MiLCJyZWR1Y2UiLCJhY2MiLCJBcnJheSIsImlzQXJyYXkiLCJncm91cFJhbmtzIiwiT2JqZWN0Iiwia2V5cyIsInNvcnRlckZuIiwiY29tcGFyYXRvciIsImNhc2VJbnNlbnNpdGl2ZSIsImEiLCJiIiwiU3RyaW5nIiwidG9Mb3dlckNhc2UiLCJncm91cFJhbmsiLCJuZXdSYW5rIiwiYWxwaGFiZXRpemVkUmFua3MiLCJpbXBvcnRlZEl0ZW1OYW1lIiwicGFyc2VJbnQiLCJjb21wdXRlUGF0aFJhbmsiLCJyYW5rcyIsInBhdGhHcm91cHMiLCJwYXRoIiwibWF4UG9zaXRpb24iLCJsIiwicGF0dGVybiIsInBhdHRlcm5PcHRpb25zIiwiZ3JvdXAiLCJwb3NpdGlvbiIsIm5vY29tbWVudCIsImNvbXB1dGVSYW5rIiwiZXhjbHVkZWRJbXBvcnRUeXBlcyIsImltcFR5cGUiLCJoYXMiLCJncm91cHMiLCJyZWdpc3Rlck5vZGUiLCJpc0luVmFyaWFibGVEZWNsYXJhdG9yIiwidHlwZXMiLCJjb252ZXJ0R3JvdXBzVG9SYW5rcyIsInJhbmtPYmplY3QiLCJpbmRleCIsImdyb3VwSXRlbSIsIkVycm9yIiwiSlNPTiIsInN0cmluZ2lmeSIsInVuZGVmaW5lZCIsIm9taXR0ZWRUeXBlcyIsImNvbnZlcnRQYXRoR3JvdXBzRm9yUmFua3MiLCJhZnRlciIsImJlZm9yZSIsInRyYW5zZm9ybWVkIiwicGF0aEdyb3VwIiwicG9zaXRpb25TdHJpbmciLCJhc3NpZ24iLCJncm91cExlbmd0aCIsImdyb3VwSW5kZXgiLCJNYXRoIiwibWF4Iiwia2V5IiwiZ3JvdXBOZXh0UG9zaXRpb24iLCJwb3ciLCJjZWlsIiwibG9nMTAiLCJmaXhOZXdMaW5lQWZ0ZXJJbXBvcnQiLCJwcmV2aW91c0ltcG9ydCIsInByZXZSb290IiwiZW5kT2ZMaW5lIiwiaW5zZXJ0VGV4dEFmdGVyUmFuZ2UiLCJyZW1vdmVOZXdMaW5lQWZ0ZXJJbXBvcnQiLCJjdXJyZW50SW1wb3J0IiwiY3VyclJvb3QiLCJyYW5nZVRvUmVtb3ZlIiwidGVzdCIsInJlbW92ZVJhbmdlIiwibWFrZU5ld2xpbmVzQmV0d2VlblJlcG9ydCIsIm5ld2xpbmVzQmV0d2VlbkltcG9ydHMiLCJnZXROdW1iZXJPZkVtcHR5TGluZXNCZXR3ZWVuIiwibGluZXNCZXR3ZWVuSW1wb3J0cyIsImxpbmVzIiwidHJpbSIsImVtcHR5TGluZXNCZXR3ZWVuIiwiZ2V0QWxwaGFiZXRpemVDb25maWciLCJvcHRpb25zIiwiYWxwaGFiZXRpemUiLCJtb2R1bGUiLCJleHBvcnRzIiwibWV0YSIsImRvY3MiLCJ1cmwiLCJmaXhhYmxlIiwic2NoZW1hIiwicHJvcGVydGllcyIsInBhdGhHcm91cHNFeGNsdWRlZEltcG9ydFR5cGVzIiwiaXRlbXMiLCJlbnVtIiwicmVxdWlyZWQiLCJkZWZhdWx0IiwiYWRkaXRpb25hbFByb3BlcnRpZXMiLCJjcmVhdGUiLCJpbXBvcnRPcmRlclJ1bGUiLCJTZXQiLCJlcnJvciIsIlByb2dyYW0iLCJsZXZlbCIsImluY3JlbWVudExldmVsIiwiZGVjcmVtZW50TGV2ZWwiLCJJbXBvcnREZWNsYXJhdGlvbiIsImhhbmRsZUltcG9ydHMiLCJzb3VyY2UiLCJ2YWx1ZSIsIlRTSW1wb3J0RXF1YWxzRGVjbGFyYXRpb24iLCJDYWxsRXhwcmVzc2lvbiIsImhhbmRsZVJlcXVpcmVzIiwicmVwb3J0QW5kUmVzZXQiLCJGdW5jdGlvbkRlY2xhcmF0aW9uIiwiRnVuY3Rpb25FeHByZXNzaW9uIiwiQXJyb3dGdW5jdGlvbkV4cHJlc3Npb24iLCJCbG9ja1N0YXRlbWVudCIsIk9iamVjdEV4cHJlc3Npb24iXSwibWFwcGluZ3MiOiJBQUFBOzs7O0FBRUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7OztBQUVBLE1BQU1BLGdCQUFnQixDQUFDLFNBQUQsRUFBWSxVQUFaLEVBQXdCLFFBQXhCLEVBQWtDLFNBQWxDLEVBQTZDLE9BQTdDLENBQXRCOztBQUVBOztBQUVBLFNBQVNDLE9BQVQsQ0FBaUJDLEtBQWpCLEVBQXdCO0FBQ3RCLFNBQU9BLE1BQU1DLEdBQU4sQ0FBVSxVQUFVQyxDQUFWLEVBQWE7QUFDNUIsV0FBTztBQUNMQyxZQUFNRCxFQUFFQyxJQURIO0FBRUxDLFlBQU0sQ0FBQ0YsRUFBRUUsSUFGSjtBQUdMQyxZQUFNSCxFQUFFRztBQUhILEtBQVA7QUFLRCxHQU5NLEVBTUpOLE9BTkksRUFBUDtBQU9EOztBQUVELFNBQVNPLHdCQUFULENBQWtDQyxVQUFsQyxFQUE4Q0YsSUFBOUMsRUFBb0RHLEtBQXBELEVBQTJEO0FBQ3pELE1BQUlDLHFCQUFxQkosSUFBekI7QUFDQSxRQUFNSyxTQUFTLEVBQWY7QUFDQSxPQUFLLElBQUlDLElBQUksQ0FBYixFQUFnQkEsSUFBSUgsS0FBcEIsRUFBMkJHLEdBQTNCLEVB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QUFtQzlDLFFBQW5DLEVBQTZDOEosc0JBQTdDO0FBQ0Q7O0FBRUQsWUFBSVEsWUFBWXZILEtBQVosS0FBc0IsUUFBMUIsRUFBb0M7QUFDbENpQyxtQ0FBeUJoRixRQUF6QixFQUFtQ3NLLFdBQW5DO0FBQ0Q7O0FBRUQvRiw2QkFBcUJ6QixPQUFyQixFQUE4QjlDLFFBQTlCOztBQUVBQSxtQkFBVyxFQUFYO0FBQ0QsT0EzREk7QUE0RExxTSwyQkFBcUJWLGNBNURoQjtBQTZETFcsMEJBQW9CWCxjQTdEZjtBQThETFksK0JBQXlCWixjQTlEcEI7QUErRExhLHNCQUFnQmIsY0EvRFg7QUFnRUxjLHdCQUFrQmQsY0FoRWI7QUFpRUwsa0NBQTRCQyxjQWpFdkI7QUFrRUwsaUNBQTJCQSxjQWxFdEI7QUFtRUwsc0NBQWdDQSxjQW5FM0I7QUFvRUwsNkJBQXVCQSxjQXBFbEI7QUFxRUwsK0JBQXlCQTtBQXJFcEIsS0FBUDtBQXVFRDtBQTVLYyxDQUFqQiIsImZpbGUiOiJvcmRlci5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0J1xuXG5pbXBvcnQgbWluaW1hdGNoIGZyb20gJ21pbmltYXRjaCdcbmltcG9ydCBpbXBvcnRUeXBlIGZyb20gJy4uL2NvcmUvaW1wb3J0VHlwZSdcbmltcG9ydCBpc1N0YXRpY1JlcXVpcmUgZnJvbSAnLi4vY29yZS9zdGF0aWNSZXF1aXJlJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxuY29uc3QgZGVmYXVsdEdyb3VwcyA9IFsnYnVpbHRpbicsICdleHRlcm5hbCcsICdwYXJlbnQnLCAnc2libGluZycsICdpbmRleCddXG5cbi8vIFJFUE9SVElORyBBTkQgRklYSU5HXG5cbmZ1bmN0aW9uIHJldmVyc2UoYXJyYXkpIHtcbiAgcmV0dXJuIGFycmF5Lm1hcChmdW5jdGlvbiAodikge1xuICAgIHJldHVybiB7XG4gICAgICBuYW1lOiB2Lm5hbWUsXG4gICAgICByYW5rOiAtdi5yYW5rLFxuICAgICAgbm9kZTogdi5ub2RlLFxuICAgIH1cbiAgfSkucmV2ZXJzZSgpXG59XG5cbmZ1bmN0aW9uIGdldFRva2Vuc09yQ29tbWVudHNBZnRlcihzb3VyY2VDb2RlLCBub2RlLCBjb3VudCkge1xuICBsZXQgY3VycmVudE5vZGVPclRva2VuID0gbm9kZVxuICBjb25zdCByZXN1bHQgPSBbXVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICBjdXJyZW50Tm9kZU9yVG9rZW4gPSBzb3VyY2VDb2RlLmdldFRva2VuT3JDb21tZW50QWZ0ZXIoY3VycmVudE5vZGVPclRva2VuKVxuICAgIGlmIChjdXJyZW50Tm9kZU9yVG9rZW4gPT0gbnVsbCkge1xuICAgICAgYnJlYWtcbiAgICB9XG4gICAgcmVzdWx0LnB1c2goY3VycmVudE5vZGVPclRva2VuKVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gZ2V0VG9rZW5zT3JDb21tZW50c0JlZm9yZShzb3VyY2VDb2RlLCBub2RlLCBjb3VudCkge1xuICBsZXQgY3VycmVudE5vZGVPclRva2VuID0gbm9kZVxuICBjb25zdCByZXN1bHQgPSBbXVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcbiAgICBjdXJyZW50Tm9kZU9yVG9rZW4gPSBzb3VyY2VDb2RlLmdldFRva2VuT3JDb21tZW50QmVmb3JlKGN1cnJlbnROb2RlT3JUb2tlbilcbiAgICBpZiAoY3VycmVudE5vZGVPclRva2VuID09IG51bGwpIHtcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIHJlc3VsdC5wdXNoKGN1cnJlbnROb2RlT3JUb2tlbilcbiAgfVxuICByZXR1cm4gcmVzdWx0LnJldmVyc2UoKVxufVxuXG5mdW5jdGlvbiB0YWtlVG9rZW5zQWZ0ZXJXaGlsZShzb3VyY2VDb2RlLCBub2RlLCBjb25kaXRpb24pIHtcbiAgY29uc3QgdG9rZW5zID0gZ2V0VG9rZW5zT3JDb21tZW50c0FmdGVyKHNvdXJjZUNvZGUsIG5vZGUsIDEwMClcbiAgY29uc3QgcmVzdWx0ID0gW11cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoY29uZGl0aW9uKHRva2Vuc1tpXSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHRva2Vuc1tpXSlcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIHRha2VUb2tlbnNCZWZvcmVXaGlsZShzb3VyY2VDb2RlLCBub2RlLCBjb25kaXRpb24pIHtcbiAgY29uc3QgdG9rZW5zID0gZ2V0VG9rZW5zT3JDb21tZW50c0JlZm9yZShzb3VyY2VDb2RlLCBub2RlLCAxMDApXG4gIGNvbnN0IHJlc3VsdCA9IFtdXG4gIGZvciAobGV0IGkgPSB0b2tlbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoY29uZGl0aW9uKHRva2Vuc1tpXSkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHRva2Vuc1tpXSlcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0LnJldmVyc2UoKVxufVxuXG5mdW5jdGlvbiBmaW5kT3V0T2ZPcmRlcihpbXBvcnRlZCkge1xuICBpZiAoaW1wb3J0ZWQubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIFtdXG4gIH1cbiAgbGV0IG1heFNlZW5SYW5rTm9kZSA9IGltcG9ydGVkWzBdXG4gIHJldHVybiBpbXBvcnRlZC5maWx0ZXIoZnVuY3Rpb24gKGltcG9ydGVkTW9kdWxlKSB7XG4gICAgY29uc3QgcmVzID0gaW1wb3J0ZWRNb2R1bGUucmFuayA8IG1heFNlZW5SYW5rTm9kZS5yYW5rXG4gICAgaWYgKG1heFNlZW5SYW5rTm9kZS5yYW5rIDwgaW1wb3J0ZWRNb2R1bGUucmFuaykge1xuICAgICAgbWF4U2VlblJhbmtOb2RlID0gaW1wb3J0ZWRNb2R1bGVcbiAgICB9XG4gICAgcmV0dXJuIHJlc1xuICB9KVxufVxuXG5mdW5jdGlvbiBmaW5kUm9vdE5vZGUobm9kZSkge1xuICBsZXQgcGFyZW50ID0gbm9kZVxuICB3aGlsZSAocGFyZW50LnBhcmVudCAhPSBudWxsICYmIHBhcmVudC5wYXJlbnQuYm9keSA9PSBudWxsKSB7XG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudFxuICB9XG4gIHJldHVybiBwYXJlbnRcbn1cblxuZnVuY3Rpb24gZmluZEVuZE9mTGluZVdpdGhDb21tZW50cyhzb3VyY2VDb2RlLCBub2RlKSB7XG4gIGNvbnN0IHRva2Vuc1RvRW5kT2ZMaW5lID0gdGFrZVRva2Vuc0FmdGVyV2hpbGUoc291cmNlQ29kZSwgbm9kZSwgY29tbWVudE9uU2FtZUxpbmVBcyhub2RlKSlcbiAgbGV0IGVuZE9mVG9rZW5zID0gdG9rZW5zVG9FbmRPZkxpbmUubGVuZ3RoID4gMFxuICAgID8gdG9rZW5zVG9FbmRPZkxpbmVbdG9rZW5zVG9FbmRPZkxpbmUubGVuZ3RoIC0gMV0ucmFuZ2VbMV1cbiAgICA6IG5vZGUucmFuZ2VbMV1cbiAgbGV0IHJlc3VsdCA9IGVuZE9mVG9rZW5zXG4gIGZvciAobGV0IGkgPSBlbmRPZlRva2VuczsgaSA8IHNvdXJjZUNvZGUudGV4dC5sZW5ndGg7IGkrKykge1xuICAgIGlmIChzb3VyY2VDb2RlLnRleHRbaV0gPT09ICdcXG4nKSB7XG4gICAgICByZXN1bHQgPSBpICsgMVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgaWYgKHNvdXJjZUNvZGUudGV4dFtpXSAhPT0gJyAnICYmIHNvdXJjZUNvZGUudGV4dFtpXSAhPT0gJ1xcdCcgJiYgc291cmNlQ29kZS50ZXh0W2ldICE9PSAnXFxyJykge1xuICAgICAgYnJlYWtcbiAgICB9XG4gICAgcmVzdWx0ID0gaSArIDFcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIGNvbW1lbnRPblNhbWVMaW5lQXMobm9kZSkge1xuICByZXR1cm4gdG9rZW4gPT4gKHRva2VuLnR5cGUgPT09ICdCbG9jaycgfHwgIHRva2VuLnR5cGUgPT09ICdMaW5lJykgJiZcbiAgICAgIHRva2VuLmxvYy5zdGFydC5saW5lID09PSB0b2tlbi5sb2MuZW5kLmxpbmUgJiZcbiAgICAgIHRva2VuLmxvYy5lbmQubGluZSA9PT0gbm9kZS5sb2MuZW5kLmxpbmVcbn1cblxuZnVuY3Rpb24gZmluZFN0YXJ0T2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIG5vZGUpIHtcbiAgY29uc3QgdG9rZW5zVG9FbmRPZkxpbmUgPSB0YWtlVG9rZW5zQmVmb3JlV2hpbGUoc291cmNlQ29kZSwgbm9kZSwgY29tbWVudE9uU2FtZUxpbmVBcyhub2RlKSlcbiAgbGV0IHN0YXJ0T2ZUb2tlbnMgPSB0b2tlbnNUb0VuZE9mTGluZS5sZW5ndGggPiAwID8gdG9rZW5zVG9FbmRPZkxpbmVbMF0ucmFuZ2VbMF0gOiBub2RlLnJhbmdlWzBdXG4gIGxldCByZXN1bHQgPSBzdGFydE9mVG9rZW5zXG4gIGZvciAobGV0IGkgPSBzdGFydE9mVG9rZW5zIC0gMTsgaSA+IDA7IGktLSkge1xuICAgIGlmIChzb3VyY2VDb2RlLnRleHRbaV0gIT09ICcgJyAmJiBzb3VyY2VDb2RlLnRleHRbaV0gIT09ICdcXHQnKSB7XG4gICAgICBicmVha1xuICAgIH1cbiAgICByZXN1bHQgPSBpXG4gIH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBpc1BsYWluUmVxdWlyZU1vZHVsZShub2RlKSB7XG4gIGlmIChub2RlLnR5cGUgIT09ICdWYXJpYWJsZURlY2xhcmF0aW9uJykge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIGlmIChub2RlLmRlY2xhcmF0aW9ucy5sZW5ndGggIT09IDEpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICBjb25zdCBkZWNsID0gbm9kZS5kZWNsYXJhdGlvbnNbMF1cbiAgY29uc3QgcmVzdWx0ID0gZGVjbC5pZCAmJlxuICAgIChkZWNsLmlkLnR5cGUgPT09ICdJZGVudGlmaWVyJyB8fCBkZWNsLmlkLnR5cGUgPT09ICdPYmplY3RQYXR0ZXJuJykgJiZcbiAgICBkZWNsLmluaXQgIT0gbnVsbCAmJlxuICAgIGRlY2wuaW5pdC50eXBlID09PSAnQ2FsbEV4cHJlc3Npb24nICYmXG4gICAgZGVjbC5pbml0LmNhbGxlZSAhPSBudWxsICYmXG4gICAgZGVjbC5pbml0LmNhbGxlZS5uYW1lID09PSAncmVxdWlyZScgJiZcbiAgICBkZWNsLmluaXQuYXJndW1lbnRzICE9IG51bGwgJiZcbiAgICBkZWNsLmluaXQuYXJndW1lbnRzLmxlbmd0aCA9PT0gMSAmJlxuICAgIGRlY2wuaW5pdC5hcmd1bWVudHNbMF0udHlwZSA9PT0gJ0xpdGVyYWwnXG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gaXNQbGFpbkltcG9ydE1vZHVsZShub2RlKSB7XG4gIHJldHVybiBub2RlLnR5cGUgPT09ICdJbXBvcnREZWNsYXJhdGlvbicgJiYgbm9kZS5zcGVjaWZpZXJzICE9IG51bGwgJiYgbm9kZS5zcGVjaWZpZXJzLmxlbmd0aCA+IDBcbn1cblxuZnVuY3Rpb24gaXNQbGFpbkltcG9ydEVxdWFscyhub2RlKSB7XG4gIHJldHVybiBub2RlLnR5cGUgPT09ICdUU0ltcG9ydEVxdWFsc0RlY2xhcmF0aW9uJyAmJiBub2RlLm1vZHVsZVJlZmVyZW5jZS5leHByZXNzaW9uXG59XG5cbmZ1bmN0aW9uIGNhbkNyb3NzTm9kZVdoaWxlUmVvcmRlcihub2RlKSB7XG4gIHJldHVybiBpc1BsYWluUmVxdWlyZU1vZHVsZShub2RlKSB8fCBpc1BsYWluSW1wb3J0TW9kdWxlKG5vZGUpIHx8IGlzUGxhaW5JbXBvcnRFcXVhbHMobm9kZSlcbn1cblxuZnVuY3Rpb24gY2FuUmVvcmRlckl0ZW1zKGZpcnN0Tm9kZSwgc2Vjb25kTm9kZSkge1xuICBjb25zdCBwYXJlbnQgPSBmaXJzdE5vZGUucGFyZW50XG4gIGNvbnN0IFtmaXJzdEluZGV4LCBzZWNvbmRJbmRleF0gPSBbXG4gICAgcGFyZW50LmJvZHkuaW5kZXhPZihmaXJzdE5vZGUpLFxuICAgIHBhcmVudC5ib2R5LmluZGV4T2Yoc2Vjb25kTm9kZSksXG4gIF0uc29ydCgpXG4gIGNvbnN0IG5vZGVzQmV0d2VlbiA9IHBhcmVudC5ib2R5LnNsaWNlKGZpcnN0SW5kZXgsIHNlY29uZEluZGV4ICsgMSlcbiAgZm9yICh2YXIgbm9kZUJldHdlZW4gb2Ygbm9kZXNCZXR3ZWVuKSB7XG4gICAgaWYgKCFjYW5Dcm9zc05vZGVXaGlsZVJlb3JkZXIobm9kZUJldHdlZW4pKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWVcbn1cblxuZnVuY3Rpb24gZml4T3V0T2ZPcmRlcihjb250ZXh0LCBmaXJzdE5vZGUsIHNlY29uZE5vZGUsIG9yZGVyKSB7XG4gIGNvbnN0IHNvdXJjZUNvZGUgPSBjb250ZXh0LmdldFNvdXJjZUNvZGUoKVxuXG4gIGNvbnN0IGZpcnN0Um9vdCA9IGZpbmRSb290Tm9kZShmaXJzdE5vZGUubm9kZSlcbiAgY29uc3QgZmlyc3RSb290U3RhcnQgPSBmaW5kU3RhcnRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgZmlyc3RSb290KVxuICBjb25zdCBmaXJzdFJvb3RFbmQgPSBmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIGZpcnN0Um9vdClcblxuICBjb25zdCBzZWNvbmRSb290ID0gZmluZFJvb3ROb2RlKHNlY29uZE5vZGUubm9kZSlcbiAgY29uc3Qgc2Vjb25kUm9vdFN0YXJ0ID0gZmluZFN0YXJ0T2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIHNlY29uZFJvb3QpXG4gIGNvbnN0IHNlY29uZFJvb3RFbmQgPSBmaW5kRW5kT2ZMaW5lV2l0aENvbW1lbnRzKHNvdXJjZUNvZGUsIHNlY29uZFJvb3QpXG4gIGNvbnN0IGNhbkZpeCA9IGNhblJlb3JkZXJJdGVtcyhmaXJzdFJvb3QsIHNlY29uZFJvb3QpXG5cbiAgbGV0IG5ld0NvZGUgPSBzb3VyY2VDb2RlLnRleHQuc3Vic3RyaW5nKHNlY29uZFJvb3RTdGFydCwgc2Vjb25kUm9vdEVuZClcbiAgaWYgKG5ld0NvZGVbbmV3Q29kZS5sZW5ndGggLSAxXSAhPT0gJ1xcbicpIHtcbiAgICBuZXdDb2RlID0gbmV3Q29kZSArICdcXG4nXG4gIH1cblxuICBjb25zdCBtZXNzYWdlID0gJ2AnICsgc2Vjb25kTm9kZS5uYW1lICsgJ2AgaW1wb3J0IHNob3VsZCBvY2N1ciAnICsgb3JkZXIgK1xuICAgICAgJyBpbXBvcnQgb2YgYCcgKyBmaXJzdE5vZGUubmFtZSArICdgJ1xuXG4gIGlmIChvcmRlciA9PT0gJ2JlZm9yZScpIHtcbiAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICBub2RlOiBzZWNvbmROb2RlLm5vZGUsXG4gICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgZml4OiBjYW5GaXggJiYgKGZpeGVyID0+XG4gICAgICAgIGZpeGVyLnJlcGxhY2VUZXh0UmFuZ2UoXG4gICAgICAgICAgW2ZpcnN0Um9vdFN0YXJ0LCBzZWNvbmRSb290RW5kXSxcbiAgICAgICAgICBuZXdDb2RlICsgc291cmNlQ29kZS50ZXh0LnN1YnN0cmluZyhmaXJzdFJvb3RTdGFydCwgc2Vjb25kUm9vdFN0YXJ0KVxuICAgICAgICApKSxcbiAgICB9KVxuICB9IGVsc2UgaWYgKG9yZGVyID09PSAnYWZ0ZXInKSB7XG4gICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgbm9kZTogc2Vjb25kTm9kZS5ub2RlLFxuICAgICAgbWVzc2FnZTogbWVzc2FnZSxcbiAgICAgIGZpeDogY2FuRml4ICYmIChmaXhlciA9PlxuICAgICAgICBmaXhlci5yZXBsYWNlVGV4dFJhbmdlKFxuICAgICAgICAgIFtzZWNvbmRSb290U3RhcnQsIGZpcnN0Um9vdEVuZF0sXG4gICAgICAgICAgc291cmNlQ29kZS50ZXh0LnN1YnN0cmluZyhzZWNvbmRSb290RW5kLCBmaXJzdFJvb3RFbmQpICsgbmV3Q29kZVxuICAgICAgICApKSxcbiAgICB9KVxuICB9XG59XG5cbmZ1bmN0aW9uIHJlcG9ydE91dE9mT3JkZXIoY29udGV4dCwgaW1wb3J0ZWQsIG91dE9mT3JkZXIsIG9yZGVyKSB7XG4gIG91dE9mT3JkZXIuZm9yRWFjaChmdW5jdGlvbiAoaW1wKSB7XG4gICAgY29uc3QgZm91bmQgPSBpbXBvcnRlZC5maW5kKGZ1bmN0aW9uIGhhc0hpZ2hlclJhbmsoaW1wb3J0ZWRJdGVtKSB7XG4gICAgICByZXR1cm4gaW1wb3J0ZWRJdGVtLnJhbmsgPiBpbXAucmFua1xuICAgIH0pXG4gICAgZml4T3V0T2ZPcmRlcihjb250ZXh0LCBmb3VuZCwgaW1wLCBvcmRlcilcbiAgfSlcbn1cblxuZnVuY3Rpb24gbWFrZU91dE9mT3JkZXJSZXBvcnQoY29udGV4dCwgaW1wb3J0ZWQpIHtcbiAgY29uc3Qgb3V0T2ZPcmRlciA9IGZpbmRPdXRPZk9yZGVyKGltcG9ydGVkKVxuICBpZiAoIW91dE9mT3JkZXIubGVuZ3RoKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgLy8gVGhlcmUgYXJlIHRoaW5ncyB0byByZXBvcnQuIFRyeSB0byBtaW5pbWl6ZSB0aGUgbnVtYmVyIG9mIHJlcG9ydGVkIGVycm9ycy5cbiAgY29uc3QgcmV2ZXJzZWRJbXBvcnRlZCA9IHJldmVyc2UoaW1wb3J0ZWQpXG4gIGNvbnN0IHJldmVyc2VkT3JkZXIgPSBmaW5kT3V0T2ZPcmRlcihyZXZlcnNlZEltcG9ydGVkKVxuICBpZiAocmV2ZXJzZWRPcmRlci5sZW5ndGggPCBvdXRPZk9yZGVyLmxlbmd0aCkge1xuICAgIHJlcG9ydE91dE9mT3JkZXIoY29udGV4dCwgcmV2ZXJzZWRJbXBvcnRlZCwgcmV2ZXJzZWRPcmRlciwgJ2FmdGVyJylcbiAgICByZXR1cm5cbiAgfVxuICByZXBvcnRPdXRPZk9yZGVyKGNvbnRleHQsIGltcG9ydGVkLCBvdXRPZk9yZGVyLCAnYmVmb3JlJylcbn1cblxuZnVuY3Rpb24gZ2V0U29ydGVyKGFzY2VuZGluZykge1xuICBsZXQgbXVsdGlwbGllciA9IChhc2NlbmRpbmcgPyAxIDogLTEpXG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGltcG9ydHNTb3J0ZXIoaW1wb3J0QSwgaW1wb3J0Qikge1xuICAgIGxldCByZXN1bHRcblxuICAgIGlmICgoaW1wb3J0QSA8IGltcG9ydEIpIHx8IGltcG9ydEIgPT09IG51bGwpIHtcbiAgICAgIHJlc3VsdCA9IC0xXG4gICAgfSBlbHNlIGlmICgoaW1wb3J0QSA+IGltcG9ydEIpIHx8IGltcG9ydEEgPT09IG51bGwpIHtcbiAgICAgIHJlc3VsdCA9IDFcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gMFxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQgKiBtdWx0aXBsaWVyXG4gIH1cbn1cblxuZnVuY3Rpb24gbXV0YXRlUmFua3NUb0FscGhhYmV0aXplKGltcG9ydGVkLCBhbHBoYWJldGl6ZU9wdGlvbnMpIHtcbiAgY29uc3QgZ3JvdXBlZEJ5UmFua3MgPSBpbXBvcnRlZC5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBpbXBvcnRlZEl0ZW0pIHtcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYWNjW2ltcG9ydGVkSXRlbS5yYW5rXSkpIHtcbiAgICAgIGFjY1tpbXBvcnRlZEl0ZW0ucmFua10gPSBbXVxuICAgIH1cbiAgICBhY2NbaW1wb3J0ZWRJdGVtLnJhbmtdLnB1c2goaW1wb3J0ZWRJdGVtLm5hbWUpXG4gICAgcmV0dXJuIGFjY1xuICB9LCB7fSlcblxuICBjb25zdCBncm91cFJhbmtzID0gT2JqZWN0LmtleXMoZ3JvdXBlZEJ5UmFua3MpXG5cbiAgY29uc3Qgc29ydGVyRm4gPSBnZXRTb3J0ZXIoYWxwaGFiZXRpemVPcHRpb25zLm9yZGVyID09PSAnYXNjJylcbiAgY29uc3QgY29tcGFyYXRvciA9IGFscGhhYmV0aXplT3B0aW9ucy5jYXNlSW5zZW5zaXRpdmUgPyAoYSwgYikgPT4gc29ydGVyRm4oU3RyaW5nKGEpLnRvTG93ZXJDYXNlKCksIFN0cmluZyhiKS50b0xvd2VyQ2FzZSgpKSA6IChhLCBiKSA9PiBzb3J0ZXJGbihhLCBiKVxuICAvLyBzb3J0IGltcG9ydHMgbG9jYWxseSB3aXRoaW4gdGhlaXIgZ3JvdXBcbiAgZ3JvdXBSYW5rcy5mb3JFYWNoKGZ1bmN0aW9uKGdyb3VwUmFuaykge1xuICAgIGdyb3VwZWRCeVJhbmtzW2dyb3VwUmFua10uc29ydChjb21wYXJhdG9yKVxuICB9KVxuXG4gIC8vIGFzc2lnbiBnbG9iYWxseSB1bmlxdWUgcmFuayB0byBlYWNoIGltcG9ydFxuICBsZXQgbmV3UmFuayA9IDBcbiAgY29uc3QgYWxwaGFiZXRpemVkUmFua3MgPSBncm91cFJhbmtzLnNvcnQoKS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBncm91cFJhbmspIHtcbiAgICBncm91cGVkQnlSYW5rc1tncm91cFJhbmtdLmZvckVhY2goZnVuY3Rpb24oaW1wb3J0ZWRJdGVtTmFtZSkge1xuICAgICAgYWNjW2ltcG9ydGVkSXRlbU5hbWVdID0gcGFyc2VJbnQoZ3JvdXBSYW5rLCAxMCkgKyBuZXdSYW5rXG4gICAgICBuZXdSYW5rICs9IDFcbiAgICB9KVxuICAgIHJldHVybiBhY2NcbiAgfSwge30pXG5cbiAgLy8gbXV0YXRlIHRoZSBvcmlnaW5hbCBncm91cC1yYW5rIHdpdGggYWxwaGFiZXRpemVkLXJhbmtcbiAgaW1wb3J0ZWQuZm9yRWFjaChmdW5jdGlvbihpbXBvcnRlZEl0ZW0pIHtcbiAgICBpbXBvcnRlZEl0ZW0ucmFuayA9IGFscGhhYmV0aXplZFJhbmtzW2ltcG9ydGVkSXRlbS5uYW1lXVxuICB9KVxufVxuXG4vLyBERVRFQ1RJTkdcblxuZnVuY3Rpb24gY29tcHV0ZVBhdGhSYW5rKHJhbmtzLCBwYXRoR3JvdXBzLCBwYXRoLCBtYXhQb3NpdGlvbikge1xuICBmb3IgKGxldCBpID0gMCwgbCA9IHBhdGhHcm91cHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgY29uc3QgeyBwYXR0ZXJuLCBwYXR0ZXJuT3B0aW9ucywgZ3JvdXAsIHBvc2l0aW9uID0gMSB9ID0gcGF0aEdyb3Vwc1tpXVxuICAgIGlmIChtaW5pbWF0Y2gocGF0aCwgcGF0dGVybiwgcGF0dGVybk9wdGlvbnMgfHwgeyBub2NvbW1lbnQ6IHRydWUgfSkpIHtcbiAgICAgIHJldHVybiByYW5rc1tncm91cF0gKyAocG9zaXRpb24gLyBtYXhQb3NpdGlvbilcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY29tcHV0ZVJhbmsoY29udGV4dCwgcmFua3MsIG5hbWUsIHR5cGUsIGV4Y2x1ZGVkSW1wb3J0VHlwZXMpIHtcbiAgY29uc3QgaW1wVHlwZSA9IGltcG9ydFR5cGUobmFtZSwgY29udGV4dClcbiAgbGV0IHJhbmtcbiAgaWYgKCFleGNsdWRlZEltcG9ydFR5cGVzLmhhcyhpbXBUeXBlKSkge1xuICAgIHJhbmsgPSBjb21wdXRlUGF0aFJhbmsocmFua3MuZ3JvdXBzLCByYW5rcy5wYXRoR3JvdXBzLCBuYW1lLCByYW5rcy5tYXhQb3NpdGlvbilcbiAgfVxuICBpZiAodHlwZW9mIHJhbmsgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmFuayA9IHJhbmtzLmdyb3Vwc1tpbXBUeXBlXVxuICB9XG4gIGlmICh0eXBlICE9PSAnaW1wb3J0Jykge1xuICAgIHJhbmsgKz0gMTAwXG4gIH1cblxuICByZXR1cm4gcmFua1xufVxuXG5mdW5jdGlvbiByZWdpc3Rlck5vZGUoY29udGV4dCwgbm9kZSwgbmFtZSwgdHlwZSwgcmFua3MsIGltcG9ydGVkLCBleGNsdWRlZEltcG9ydFR5cGVzKSB7XG4gIGNvbnN0IHJhbmsgPSBjb21wdXRlUmFuayhjb250ZXh0LCByYW5rcywgbmFtZSwgdHlwZSwgZXhjbHVkZWRJbXBvcnRUeXBlcylcbiAgaWYgKHJhbmsgIT09IC0xKSB7XG4gICAgaW1wb3J0ZWQucHVzaCh7bmFtZSwgcmFuaywgbm9kZX0pXG4gIH1cbn1cblxuZnVuY3Rpb24gaXNJblZhcmlhYmxlRGVjbGFyYXRvcihub2RlKSB7XG4gIHJldHVybiBub2RlICYmXG4gICAgKG5vZGUudHlwZSA9PT0gJ1ZhcmlhYmxlRGVjbGFyYXRvcicgfHwgaXNJblZhcmlhYmxlRGVjbGFyYXRvcihub2RlLnBhcmVudCkpXG59XG5cbmNvbnN0IHR5cGVzID0gWydidWlsdGluJywgJ2V4dGVybmFsJywgJ2ludGVybmFsJywgJ3Vua25vd24nLCAncGFyZW50JywgJ3NpYmxpbmcnLCAnaW5kZXgnXVxuXG4vLyBDcmVhdGVzIGFuIG9iamVjdCB3aXRoIHR5cGUtcmFuayBwYWlycy5cbi8vIEV4YW1wbGU6IHsgaW5kZXg6IDAsIHNpYmxpbmc6IDEsIHBhcmVudDogMSwgZXh0ZXJuYWw6IDEsIGJ1aWx0aW46IDIsIGludGVybmFsOiAyIH1cbi8vIFdpbGwgdGhyb3cgYW4gZXJyb3IgaWYgaXQgY29udGFpbnMgYSB0eXBlIHRoYXQgZG9lcyBub3QgZXhpc3QsIG9yIGhhcyBhIGR1cGxpY2F0ZVxuZnVuY3Rpb24gY29udmVydEdyb3Vwc1RvUmFua3MoZ3JvdXBzKSB7XG4gIGNvbnN0IHJhbmtPYmplY3QgPSBncm91cHMucmVkdWNlKGZ1bmN0aW9uKHJlcywgZ3JvdXAsIGluZGV4KSB7XG4gICAgaWYgKHR5cGVvZiBncm91cCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGdyb3VwID0gW2dyb3VwXVxuICAgIH1cbiAgICBncm91cC5mb3JFYWNoKGZ1bmN0aW9uKGdyb3VwSXRlbSkge1xuICAgICAgaWYgKHR5cGVzLmluZGV4T2YoZ3JvdXBJdGVtKSA9PT0gLTEpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbmNvcnJlY3QgY29uZmlndXJhdGlvbiBvZiB0aGUgcnVsZTogVW5rbm93biB0eXBlIGAnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShncm91cEl0ZW0pICsgJ2AnKVxuICAgICAgfVxuICAgICAgaWYgKHJlc1tncm91cEl0ZW1dICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbmNvcnJlY3QgY29uZmlndXJhdGlvbiBvZiB0aGUgcnVsZTogYCcgKyBncm91cEl0ZW0gKyAnYCBpcyBkdXBsaWNhdGVkJylcbiAgICAgIH1cbiAgICAgIHJlc1tncm91cEl0ZW1dID0gaW5kZXhcbiAgICB9KVxuICAgIHJldHVybiByZXNcbiAgfSwge30pXG5cbiAgY29uc3Qgb21pdHRlZFR5cGVzID0gdHlwZXMuZmlsdGVyKGZ1bmN0aW9uKHR5cGUpIHtcbiAgICByZXR1cm4gcmFua09iamVjdFt0eXBlXSA9PT0gdW5kZWZpbmVkXG4gIH0pXG5cbiAgcmV0dXJuIG9taXR0ZWRUeXBlcy5yZWR1Y2UoZnVuY3Rpb24ocmVzLCB0eXBlKSB7XG4gICAgcmVzW3R5cGVdID0gZ3JvdXBzLmxlbmd0aFxuICAgIHJldHVybiByZXNcbiAgfSwgcmFua09iamVjdClcbn1cblxuZnVuY3Rpb24gY29udmVydFBhdGhHcm91cHNGb3JSYW5rcyhwYXRoR3JvdXBzKSB7XG4gIGNvbnN0IGFmdGVyID0ge31cbiAgY29uc3QgYmVmb3JlID0ge31cblxuICBjb25zdCB0cmFuc2Zvcm1lZCA9IHBhdGhHcm91cHMubWFwKChwYXRoR3JvdXAsIGluZGV4KSA9PiB7XG4gICAgY29uc3QgeyBncm91cCwgcG9zaXRpb246IHBvc2l0aW9uU3RyaW5nIH0gPSBwYXRoR3JvdXBcbiAgICBsZXQgcG9zaXRpb24gPSAwXG4gICAgaWYgKHBvc2l0aW9uU3RyaW5nID09PSAnYWZ0ZXInKSB7XG4gICAgICBpZiAoIWFmdGVyW2dyb3VwXSkge1xuICAgICAgICBhZnRlcltncm91cF0gPSAxXG4gICAgICB9XG4gICAgICBwb3NpdGlvbiA9IGFmdGVyW2dyb3VwXSsrXG4gICAgfSBlbHNlIGlmIChwb3NpdGlvblN0cmluZyA9PT0gJ2JlZm9yZScpIHtcbiAgICAgIGlmICghYmVmb3JlW2dyb3VwXSkge1xuICAgICAgICBiZWZvcmVbZ3JvdXBdID0gW11cbiAgICAgIH1cbiAgICAgIGJlZm9yZVtncm91cF0ucHVzaChpbmRleClcbiAgICB9XG5cbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwgcGF0aEdyb3VwLCB7IHBvc2l0aW9uIH0pXG4gIH0pXG5cbiAgbGV0IG1heFBvc2l0aW9uID0gMVxuXG4gIE9iamVjdC5rZXlzKGJlZm9yZSkuZm9yRWFjaCgoZ3JvdXApID0+IHtcbiAgICBjb25zdCBncm91cExlbmd0aCA9IGJlZm9yZVtncm91cF0ubGVuZ3RoXG4gICAgYmVmb3JlW2dyb3VwXS5mb3JFYWNoKChncm91cEluZGV4LCBpbmRleCkgPT4ge1xuICAgICAgdHJhbnNmb3JtZWRbZ3JvdXBJbmRleF0ucG9zaXRpb24gPSAtMSAqIChncm91cExlbmd0aCAtIGluZGV4KVxuICAgIH0pXG4gICAgbWF4UG9zaXRpb24gPSBNYXRoLm1heChtYXhQb3NpdGlvbiwgZ3JvdXBMZW5ndGgpXG4gIH0pXG5cbiAgT2JqZWN0LmtleXMoYWZ0ZXIpLmZvckVhY2goKGtleSkgPT4ge1xuICAgIGNvbnN0IGdyb3VwTmV4dFBvc2l0aW9uID0gYWZ0ZXJba2V5XVxuICAgIG1heFBvc2l0aW9uID0gTWF0aC5tYXgobWF4UG9zaXRpb24sIGdyb3VwTmV4dFBvc2l0aW9uIC0gMSlcbiAgfSlcblxuICByZXR1cm4ge1xuICAgIHBhdGhHcm91cHM6IHRyYW5zZm9ybWVkLFxuICAgIG1heFBvc2l0aW9uOiBtYXhQb3NpdGlvbiA+IDEwID8gTWF0aC5wb3coMTAsIE1hdGguY2VpbChNYXRoLmxvZzEwKG1heFBvc2l0aW9uKSkpIDogMTAsXG4gIH1cbn1cblxuZnVuY3Rpb24gZml4TmV3TGluZUFmdGVySW1wb3J0KGNvbnRleHQsIHByZXZpb3VzSW1wb3J0KSB7XG4gIGNvbnN0IHByZXZSb290ID0gZmluZFJvb3ROb2RlKHByZXZpb3VzSW1wb3J0Lm5vZGUpXG4gIGNvbnN0IHRva2Vuc1RvRW5kT2ZMaW5lID0gdGFrZVRva2Vuc0FmdGVyV2hpbGUoXG4gICAgY29udGV4dC5nZXRTb3VyY2VDb2RlKCksIHByZXZSb290LCBjb21tZW50T25TYW1lTGluZUFzKHByZXZSb290KSlcblxuICBsZXQgZW5kT2ZMaW5lID0gcHJldlJvb3QucmFuZ2VbMV1cbiAgaWYgKHRva2Vuc1RvRW5kT2ZMaW5lLmxlbmd0aCA+IDApIHtcbiAgICBlbmRPZkxpbmUgPSB0b2tlbnNUb0VuZE9mTGluZVt0b2tlbnNUb0VuZE9mTGluZS5sZW5ndGggLSAxXS5yYW5nZVsxXVxuICB9XG4gIHJldHVybiAoZml4ZXIpID0+IGZpeGVyLmluc2VydFRleHRBZnRlclJhbmdlKFtwcmV2Um9vdC5yYW5nZVswXSwgZW5kT2ZMaW5lXSwgJ1xcbicpXG59XG5cbmZ1bmN0aW9uIHJlbW92ZU5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCkge1xuICBjb25zdCBzb3VyY2VDb2RlID0gY29udGV4dC5nZXRTb3VyY2VDb2RlKClcbiAgY29uc3QgcHJldlJvb3QgPSBmaW5kUm9vdE5vZGUocHJldmlvdXNJbXBvcnQubm9kZSlcbiAgY29uc3QgY3VyclJvb3QgPSBmaW5kUm9vdE5vZGUoY3VycmVudEltcG9ydC5ub2RlKVxuICBjb25zdCByYW5nZVRvUmVtb3ZlID0gW1xuICAgIGZpbmRFbmRPZkxpbmVXaXRoQ29tbWVudHMoc291cmNlQ29kZSwgcHJldlJvb3QpLFxuICAgIGZpbmRTdGFydE9mTGluZVdpdGhDb21tZW50cyhzb3VyY2VDb2RlLCBjdXJyUm9vdCksXG4gIF1cbiAgaWYgKC9eXFxzKiQvLnRlc3Qoc291cmNlQ29kZS50ZXh0LnN1YnN0cmluZyhyYW5nZVRvUmVtb3ZlWzBdLCByYW5nZVRvUmVtb3ZlWzFdKSkpIHtcbiAgICByZXR1cm4gKGZpeGVyKSA9PiBmaXhlci5yZW1vdmVSYW5nZShyYW5nZVRvUmVtb3ZlKVxuICB9XG4gIHJldHVybiB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gbWFrZU5ld2xpbmVzQmV0d2VlblJlcG9ydCAoY29udGV4dCwgaW1wb3J0ZWQsIG5ld2xpbmVzQmV0d2VlbkltcG9ydHMpIHtcbiAgY29uc3QgZ2V0TnVtYmVyT2ZFbXB0eUxpbmVzQmV0d2VlbiA9IChjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCkgPT4ge1xuICAgIGNvbnN0IGxpbmVzQmV0d2VlbkltcG9ydHMgPSBjb250ZXh0LmdldFNvdXJjZUNvZGUoKS5saW5lcy5zbGljZShcbiAgICAgIHByZXZpb3VzSW1wb3J0Lm5vZGUubG9jLmVuZC5saW5lLFxuICAgICAgY3VycmVudEltcG9ydC5ub2RlLmxvYy5zdGFydC5saW5lIC0gMVxuICAgIClcblxuICAgIHJldHVybiBsaW5lc0JldHdlZW5JbXBvcnRzLmZpbHRlcigobGluZSkgPT4gIWxpbmUudHJpbSgpLmxlbmd0aCkubGVuZ3RoXG4gIH1cbiAgbGV0IHByZXZpb3VzSW1wb3J0ID0gaW1wb3J0ZWRbMF1cblxuICBpbXBvcnRlZC5zbGljZSgxKS5mb3JFYWNoKGZ1bmN0aW9uKGN1cnJlbnRJbXBvcnQpIHtcbiAgICBjb25zdCBlbXB0eUxpbmVzQmV0d2VlbiA9IGdldE51bWJlck9mRW1wdHlMaW5lc0JldHdlZW4oY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpXG5cbiAgICBpZiAobmV3bGluZXNCZXR3ZWVuSW1wb3J0cyA9PT0gJ2Fsd2F5cydcbiAgICAgICAgfHwgbmV3bGluZXNCZXR3ZWVuSW1wb3J0cyA9PT0gJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3VwcycpIHtcbiAgICAgIGlmIChjdXJyZW50SW1wb3J0LnJhbmsgIT09IHByZXZpb3VzSW1wb3J0LnJhbmsgJiYgZW1wdHlMaW5lc0JldHdlZW4gPT09IDApIHtcbiAgICAgICAgY29udGV4dC5yZXBvcnQoe1xuICAgICAgICAgIG5vZGU6IHByZXZpb3VzSW1wb3J0Lm5vZGUsXG4gICAgICAgICAgbWVzc2FnZTogJ1RoZXJlIHNob3VsZCBiZSBhdCBsZWFzdCBvbmUgZW1wdHkgbGluZSBiZXR3ZWVuIGltcG9ydCBncm91cHMnLFxuICAgICAgICAgIGZpeDogZml4TmV3TGluZUFmdGVySW1wb3J0KGNvbnRleHQsIHByZXZpb3VzSW1wb3J0KSxcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSBpZiAoY3VycmVudEltcG9ydC5yYW5rID09PSBwcmV2aW91c0ltcG9ydC5yYW5rXG4gICAgICAgICYmIGVtcHR5TGluZXNCZXR3ZWVuID4gMFxuICAgICAgICAmJiBuZXdsaW5lc0JldHdlZW5JbXBvcnRzICE9PSAnYWx3YXlzLWFuZC1pbnNpZGUtZ3JvdXBzJykge1xuICAgICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgICAgbm9kZTogcHJldmlvdXNJbXBvcnQubm9kZSxcbiAgICAgICAgICBtZXNzYWdlOiAnVGhlcmUgc2hvdWxkIGJlIG5vIGVtcHR5IGxpbmUgd2l0aGluIGltcG9ydCBncm91cCcsXG4gICAgICAgICAgZml4OiByZW1vdmVOZXdMaW5lQWZ0ZXJJbXBvcnQoY29udGV4dCwgY3VycmVudEltcG9ydCwgcHJldmlvdXNJbXBvcnQpLFxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZW1wdHlMaW5lc0JldHdlZW4gPiAwKSB7XG4gICAgICBjb250ZXh0LnJlcG9ydCh7XG4gICAgICAgIG5vZGU6IHByZXZpb3VzSW1wb3J0Lm5vZGUsXG4gICAgICAgIG1lc3NhZ2U6ICdUaGVyZSBzaG91bGQgYmUgbm8gZW1wdHkgbGluZSBiZXR3ZWVuIGltcG9ydCBncm91cHMnLFxuICAgICAgICBmaXg6IHJlbW92ZU5ld0xpbmVBZnRlckltcG9ydChjb250ZXh0LCBjdXJyZW50SW1wb3J0LCBwcmV2aW91c0ltcG9ydCksXG4gICAgICB9KVxuICAgIH1cblxuICAgIHByZXZpb3VzSW1wb3J0ID0gY3VycmVudEltcG9ydFxuICB9KVxufVxuXG5mdW5jdGlvbiBnZXRBbHBoYWJldGl6ZUNvbmZpZyhvcHRpb25zKSB7XG4gIGNvbnN0IGFscGhhYmV0aXplID0gb3B0aW9ucy5hbHBoYWJldGl6ZSB8fCB7fVxuICBjb25zdCBvcmRlciA9IGFscGhhYmV0aXplLm9yZGVyIHx8ICdpZ25vcmUnXG4gIGNvbnN0IGNhc2VJbnNlbnNpdGl2ZSA9IGFscGhhYmV0aXplLmNhc2VJbnNlbnNpdGl2ZSB8fCBmYWxzZVxuXG4gIHJldHVybiB7b3JkZXIsIGNhc2VJbnNlbnNpdGl2ZX1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGE6IHtcbiAgICB0eXBlOiAnc3VnZ2VzdGlvbicsXG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCdvcmRlcicpLFxuICAgIH0sXG5cbiAgICBmaXhhYmxlOiAnY29kZScsXG4gICAgc2NoZW1hOiBbXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgZ3JvdXBzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcGF0aEdyb3Vwc0V4Y2x1ZGVkSW1wb3J0VHlwZXM6IHtcbiAgICAgICAgICAgIHR5cGU6ICdhcnJheScsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwYXRoR3JvdXBzOiB7XG4gICAgICAgICAgICB0eXBlOiAnYXJyYXknLFxuICAgICAgICAgICAgaXRlbXM6IHtcbiAgICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICBwYXR0ZXJuOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIHBhdHRlcm5PcHRpb25zOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGdyb3VwOiB7XG4gICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICAgIGVudW06IHR5cGVzLFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgcG9zaXRpb246IHtcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgICAgZW51bTogWydhZnRlcicsICdiZWZvcmUnXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICByZXF1aXJlZDogWydwYXR0ZXJuJywgJ2dyb3VwJ10sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ25ld2xpbmVzLWJldHdlZW4nOiB7XG4gICAgICAgICAgICBlbnVtOiBbXG4gICAgICAgICAgICAgICdpZ25vcmUnLFxuICAgICAgICAgICAgICAnYWx3YXlzJyxcbiAgICAgICAgICAgICAgJ2Fsd2F5cy1hbmQtaW5zaWRlLWdyb3VwcycsXG4gICAgICAgICAgICAgICduZXZlcicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYWxwaGFiZXRpemU6IHtcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBjYXNlSW5zZW5zaXRpdmU6IHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbGVhbicsXG4gICAgICAgICAgICAgICAgZGVmYXVsdDogZmFsc2UsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIG9yZGVyOiB7XG4gICAgICAgICAgICAgICAgZW51bTogWydpZ25vcmUnLCAnYXNjJywgJ2Rlc2MnXSxcbiAgICAgICAgICAgICAgICBkZWZhdWx0OiAnaWdub3JlJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuXG4gIGNyZWF0ZTogZnVuY3Rpb24gaW1wb3J0T3JkZXJSdWxlIChjb250ZXh0KSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IGNvbnRleHQub3B0aW9uc1swXSB8fCB7fVxuICAgIGNvbnN0IG5ld2xpbmVzQmV0d2VlbkltcG9ydHMgPSBvcHRpb25zWyduZXdsaW5lcy1iZXR3ZWVuJ10gfHwgJ2lnbm9yZSdcbiAgICBjb25zdCBwYXRoR3JvdXBzRXhjbHVkZWRJbXBvcnRUeXBlcyA9IG5ldyBTZXQob3B0aW9uc1sncGF0aEdyb3Vwc0V4Y2x1ZGVkSW1wb3J0VHlwZXMnXSB8fCBbJ2J1aWx0aW4nLCAnZXh0ZXJuYWwnXSlcbiAgICBjb25zdCBhbHBoYWJldGl6ZSA9IGdldEFscGhhYmV0aXplQ29uZmlnKG9wdGlvbnMpXG4gICAgbGV0IHJhbmtzXG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgeyBwYXRoR3JvdXBzLCBtYXhQb3NpdGlvbiB9ID0gY29udmVydFBhdGhHcm91cHNGb3JSYW5rcyhvcHRpb25zLnBhdGhHcm91cHMgfHwgW10pXG4gICAgICByYW5rcyA9IHtcbiAgICAgICAgZ3JvdXBzOiBjb252ZXJ0R3JvdXBzVG9SYW5rcyhvcHRpb25zLmdyb3VwcyB8fCBkZWZhdWx0R3JvdXBzKSxcbiAgICAgICAgcGF0aEdyb3VwcyxcbiAgICAgICAgbWF4UG9zaXRpb24sXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIE1hbGZvcm1lZCBjb25maWd1cmF0aW9uXG4gICAgICByZXR1cm4ge1xuICAgICAgICBQcm9ncmFtOiBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgICAgY29udGV4dC5yZXBvcnQobm9kZSwgZXJyb3IubWVzc2FnZSlcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICB9XG4gICAgbGV0IGltcG9ydGVkID0gW11cbiAgICBsZXQgbGV2ZWwgPSAwXG5cbiAgICBmdW5jdGlvbiBpbmNyZW1lbnRMZXZlbCgpIHtcbiAgICAgIGxldmVsKytcbiAgICB9XG4gICAgZnVuY3Rpb24gZGVjcmVtZW50TGV2ZWwoKSB7XG4gICAgICBsZXZlbC0tXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIEltcG9ydERlY2xhcmF0aW9uOiBmdW5jdGlvbiBoYW5kbGVJbXBvcnRzKG5vZGUpIHtcbiAgICAgICAgaWYgKG5vZGUuc3BlY2lmaWVycy5sZW5ndGgpIHsgLy8gSWdub3JpbmcgdW5hc3NpZ25lZCBpbXBvcnRzXG4gICAgICAgICAgY29uc3QgbmFtZSA9IG5vZGUuc291cmNlLnZhbHVlXG4gICAgICAgICAgcmVnaXN0ZXJOb2RlKFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgJ2ltcG9ydCcsXG4gICAgICAgICAgICByYW5rcyxcbiAgICAgICAgICAgIGltcG9ydGVkLFxuICAgICAgICAgICAgcGF0aEdyb3Vwc0V4Y2x1ZGVkSW1wb3J0VHlwZXNcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBUU0ltcG9ydEVxdWFsc0RlY2xhcmF0aW9uOiBmdW5jdGlvbiBoYW5kbGVJbXBvcnRzKG5vZGUpIHtcbiAgICAgICAgbGV0IG5hbWVcbiAgICAgICAgaWYgKG5vZGUubW9kdWxlUmVmZXJlbmNlLnR5cGUgPT09ICdUU0V4dGVybmFsTW9kdWxlUmVmZXJlbmNlJykge1xuICAgICAgICAgIG5hbWUgPSBub2RlLm1vZHVsZVJlZmVyZW5jZS5leHByZXNzaW9uLnZhbHVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmFtZSA9IG51bGxcbiAgICAgICAgfVxuICAgICAgICByZWdpc3Rlck5vZGUoXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBub2RlLFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgJ2ltcG9ydCcsXG4gICAgICAgICAgcmFua3MsXG4gICAgICAgICAgaW1wb3J0ZWQsXG4gICAgICAgICAgcGF0aEdyb3Vwc0V4Y2x1ZGVkSW1wb3J0VHlwZXNcbiAgICAgICAgKVxuICAgICAgfSxcbiAgICAgIENhbGxFeHByZXNzaW9uOiBmdW5jdGlvbiBoYW5kbGVSZXF1aXJlcyhub2RlKSB7XG4gICAgICAgIGlmIChsZXZlbCAhPT0gMCB8fCAhaXNTdGF0aWNSZXF1aXJlKG5vZGUpIHx8ICFpc0luVmFyaWFibGVEZWNsYXJhdG9yKG5vZGUucGFyZW50KSkge1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG5hbWUgPSBub2RlLmFyZ3VtZW50c1swXS52YWx1ZVxuICAgICAgICByZWdpc3Rlck5vZGUoXG4gICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICBub2RlLFxuICAgICAgICAgIG5hbWUsXG4gICAgICAgICAgJ3JlcXVpcmUnLFxuICAgICAgICAgIHJhbmtzLFxuICAgICAgICAgIGltcG9ydGVkLFxuICAgICAgICAgIHBhdGhHcm91cHNFeGNsdWRlZEltcG9ydFR5cGVzXG4gICAgICAgIClcbiAgICAgIH0sXG4gICAgICAnUHJvZ3JhbTpleGl0JzogZnVuY3Rpb24gcmVwb3J0QW5kUmVzZXQoKSB7XG4gICAgICAgIGlmIChuZXdsaW5lc0JldHdlZW5JbXBvcnRzICE9PSAnaWdub3JlJykge1xuICAgICAgICAgIG1ha2VOZXdsaW5lc0JldHdlZW5SZXBvcnQoY29udGV4dCwgaW1wb3J0ZWQsIG5ld2xpbmVzQmV0d2VlbkltcG9ydHMpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYWxwaGFiZXRpemUub3JkZXIgIT09ICdpZ25vcmUnKSB7XG4gICAgICAgICAgbXV0YXRlUmFua3NUb0FscGhhYmV0aXplKGltcG9ydGVkLCBhbHBoYWJldGl6ZSlcbiAgICAgICAgfVxuXG4gICAgICAgIG1ha2VPdXRPZk9yZGVyUmVwb3J0KGNvbnRleHQsIGltcG9ydGVkKVxuXG4gICAgICAgIGltcG9ydGVkID0gW11cbiAgICAgIH0sXG4gICAgICBGdW5jdGlvbkRlY2xhcmF0aW9uOiBpbmNyZW1lbnRMZXZlbCxcbiAgICAgIEZ1bmN0aW9uRXhwcmVzc2lvbjogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBBcnJvd0Z1bmN0aW9uRXhwcmVzc2lvbjogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBCbG9ja1N0YXRlbWVudDogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBPYmplY3RFeHByZXNzaW9uOiBpbmNyZW1lbnRMZXZlbCxcbiAgICAgICdGdW5jdGlvbkRlY2xhcmF0aW9uOmV4aXQnOiBkZWNyZW1lbnRMZXZlbCxcbiAgICAgICdGdW5jdGlvbkV4cHJlc3Npb246ZXhpdCc6IGRlY3JlbWVudExldmVsLFxuICAgICAgJ0Fycm93RnVuY3Rpb25FeHByZXNzaW9uOmV4aXQnOiBkZWNyZW1lbnRMZXZlbCxcbiAgICAgICdCbG9ja1N0YXRlbWVudDpleGl0JzogZGVjcmVtZW50TGV2ZWwsXG4gICAgICAnT2JqZWN0RXhwcmVzc2lvbjpleGl0JzogZGVjcmVtZW50TGV2ZWwsXG4gICAgfVxuICB9LFxufVxuIl19
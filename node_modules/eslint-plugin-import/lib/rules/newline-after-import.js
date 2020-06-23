'use strict';

var _staticRequire = require('../core/staticRequire');

var _staticRequire2 = _interopRequireDefault(_staticRequire);

var _docsUrl = require('../docsUrl');

var _docsUrl2 = _interopRequireDefault(_docsUrl);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const log = (0, _debug2.default)('eslint-plugin-import:rules:newline-after-import');

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

/**
 * @fileoverview Rule to enforce new line after import not followed by another import.
 * @author Radek Benkel
 */

function containsNodeOrEqual(outerNode, innerNode) {
  return outerNode.range[0] <= innerNode.range[0] && outerNode.range[1] >= innerNode.range[1];
}

function getScopeBody(scope) {
  if (scope.block.type === 'SwitchStatement') {
    log('SwitchStatement scopes not supported');
    return null;
  }

  const body = scope.block.body;

  if (body && body.type === 'BlockStatement') {
    return body.body;
  }

  return body;
}

function findNodeIndexInScopeBody(body, nodeToFind) {
  return body.findIndex(node => containsNodeOrEqual(node, nodeToFind));
}

function getLineDifference(node, nextNode) {
  return nextNode.loc.start.line - node.loc.end.line;
}

function isClassWithDecorator(node) {
  return node.type === 'ClassDeclaration' && node.decorators && node.decorators.length;
}

function isExportDefaultClass(node) {
  return node.type === 'ExportDefaultDeclaration' && node.declaration.type === 'ClassDeclaration';
}

module.exports = {
  meta: {
    type: 'layout',
    docs: {
      url: (0, _docsUrl2.default)('newline-after-import')
    },
    fixable: 'whitespace',
    schema: [{
      'type': 'object',
      'properties': {
        'count': {
          'type': 'integer',
          'minimum': 1
        }
      },
      'additionalProperties': false
    }]
  },
  create: function (context) {
    let level = 0;
    const requireCalls = [];

    function checkForNewLine(node, nextNode, type) {
      if (isExportDefaultClass(nextNode)) {
        let classNode = nextNode.declaration;

        if (isClassWithDecorator(classNode)) {
          nextNode = classNode.decorators[0];
        }
      } else if (isClassWithDecorator(nextNode)) {
        nextNode = nextNode.decorators[0];
      }

      const options = context.options[0] || { count: 1 };
      const lineDifference = getLineDifference(node, nextNode);
      const EXPECTED_LINE_DIFFERENCE = options.count + 1;

      if (lineDifference < EXPECTED_LINE_DIFFERENCE) {
        let column = node.loc.start.column;

        if (node.loc.start.line !== node.loc.end.line) {
          column = 0;
        }

        context.report({
          loc: {
            line: node.loc.end.line,
            column
          },
          message: `Expected ${options.count} empty line${options.count > 1 ? 's' : ''} \
after ${type} statement not followed by another ${type}.`,
          fix: fixer => fixer.insertTextAfter(node, '\n'.repeat(EXPECTED_LINE_DIFFERENCE - lineDifference))
        });
      }
    }

    function incrementLevel() {
      level++;
    }
    function decrementLevel() {
      level--;
    }

    return {
      ImportDeclaration: function (node) {
        const parent = node.parent;

        const nodePosition = parent.body.indexOf(node);
        const nextNode = parent.body[nodePosition + 1];

        if (nextNode && nextNode.type !== 'ImportDeclaration') {
          checkForNewLine(node, nextNode, 'import');
        }
      },
      CallExpression: function (node) {
        if ((0, _staticRequire2.default)(node) && level === 0) {
          requireCalls.push(node);
        }
      },
      'Program:exit': function () {
        log('exit processing for', context.getFilename());
        const scopeBody = getScopeBody(context.getScope());
        log('got scope:', scopeBody);

        requireCalls.forEach(function (node, index) {
          const nodePosition = findNodeIndexInScopeBody(scopeBody, node);
          log('node position in scope:', nodePosition);

          const statementWithRequireCall = scopeBody[nodePosition];
          const nextStatement = scopeBody[nodePosition + 1];
          const nextRequireCall = requireCalls[index + 1];

          if (nextRequireCall && containsNodeOrEqual(statementWithRequireCall, nextRequireCall)) {
            return;
          }

          if (nextStatement && (!nextRequireCall || !containsNodeOrEqual(nextStatement, nextRequireCall))) {

            checkForNewLine(statementWithRequireCall, nextStatement, 'require');
          }
        });
      },
      FunctionDeclaration: incrementLevel,
      FunctionExpression: incrementLevel,
      ArrowFunctionExpression: incrementLevel,
      BlockStatement: incrementLevel,
      ObjectExpression: incrementLevel,
      Decorator: incrementLevel,
      'FunctionDeclaration:exit': decrementLevel,
      'FunctionExpression:exit': decrementLevel,
      'ArrowFunctionExpression:exit': decrementLevel,
      'BlockStatement:exit': decrementLevel,
      'ObjectExpression:exit': decrementLevel,
      'Decorator:exit': decrementLevel
    };
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ydWxlcy9uZXdsaW5lLWFmdGVyLWltcG9ydC5qcyJdLCJuYW1lcyI6WyJsb2ciLCJjb250YWluc05vZGVPckVxdWFsIiwib3V0ZXJOb2RlIiwiaW5uZXJOb2RlIiwicmFuZ2UiLCJnZXRTY29wZUJvZHkiLCJzY29wZSIsImJsb2NrIiwidHlwZSIsImJvZHkiLCJmaW5kTm9kZUluZGV4SW5TY29wZUJvZHkiLCJub2RlVG9GaW5kIiwiZmluZEluZGV4Iiwibm9kZSIsImdldExpbmVEaWZmZXJlbmNlIiwibmV4dE5vZGUiLCJsb2MiLCJzdGFydCIsImxpbmUiLCJlbmQiLCJpc0NsYXNzV2l0aERlY29yYXRvciIsImRlY29yYXRvcnMiLCJsZW5ndGgiLCJpc0V4cG9ydERlZmF1bHRDbGFzcyIsImRlY2xhcmF0aW9uIiwibW9kdWxlIiwiZXhwb3J0cyIsIm1ldGEiLCJkb2NzIiwidXJsIiwiZml4YWJsZSIsInNjaGVtYSIsImNyZWF0ZSIsImNvbnRleHQiLCJsZXZlbCIsInJlcXVpcmVDYWxscyIsImNoZWNrRm9yTmV3TGluZSIsImNsYXNzTm9kZSIsIm9wdGlvbnMiLCJjb3VudCIsImxpbmVEaWZmZXJlbmNlIiwiRVhQRUNURURfTElORV9ESUZGRVJFTkNFIiwiY29sdW1uIiwicmVwb3J0IiwibWVzc2FnZSIsImZpeCIsImZpeGVyIiwiaW5zZXJ0VGV4dEFmdGVyIiwicmVwZWF0IiwiaW5jcmVtZW50TGV2ZWwiLCJkZWNyZW1lbnRMZXZlbCIsIkltcG9ydERlY2xhcmF0aW9uIiwicGFyZW50Iiwibm9kZVBvc2l0aW9uIiwiaW5kZXhPZiIsIkNhbGxFeHByZXNzaW9uIiwicHVzaCIsImdldEZpbGVuYW1lIiwic2NvcGVCb2R5IiwiZ2V0U2NvcGUiLCJmb3JFYWNoIiwiaW5kZXgiLCJzdGF0ZW1lbnRXaXRoUmVxdWlyZUNhbGwiLCJuZXh0U3RhdGVtZW50IiwibmV4dFJlcXVpcmVDYWxsIiwiRnVuY3Rpb25EZWNsYXJhdGlvbiIsIkZ1bmN0aW9uRXhwcmVzc2lvbiIsIkFycm93RnVuY3Rpb25FeHByZXNzaW9uIiwiQmxvY2tTdGF0ZW1lbnQiLCJPYmplY3RFeHByZXNzaW9uIiwiRGVjb3JhdG9yIl0sIm1hcHBpbmdzIjoiOztBQUtBOzs7O0FBQ0E7Ozs7QUFFQTs7Ozs7O0FBQ0EsTUFBTUEsTUFBTSxxQkFBTSxpREFBTixDQUFaOztBQUVBO0FBQ0E7QUFDQTs7QUFiQTs7Ozs7QUFlQSxTQUFTQyxtQkFBVCxDQUE2QkMsU0FBN0IsRUFBd0NDLFNBQXhDLEVBQW1EO0FBQy9DLFNBQU9ELFVBQVVFLEtBQVYsQ0FBZ0IsQ0FBaEIsS0FBc0JELFVBQVVDLEtBQVYsQ0FBZ0IsQ0FBaEIsQ0FBdEIsSUFBNENGLFVBQVVFLEtBQVYsQ0FBZ0IsQ0FBaEIsS0FBc0JELFVBQVVDLEtBQVYsQ0FBZ0IsQ0FBaEIsQ0FBekU7QUFDSDs7QUFFRCxTQUFTQyxZQUFULENBQXNCQyxLQUF0QixFQUE2QjtBQUN6QixNQUFJQSxNQUFNQyxLQUFOLENBQVlDLElBQVosS0FBcUIsaUJBQXpCLEVBQTRDO0FBQzFDUixRQUFJLHNDQUFKO0FBQ0EsV0FBTyxJQUFQO0FBQ0Q7O0FBSndCLFFBTWpCUyxJQU5pQixHQU1SSCxNQUFNQyxLQU5FLENBTWpCRSxJQU5pQjs7QUFPekIsTUFBSUEsUUFBUUEsS0FBS0QsSUFBTCxLQUFjLGdCQUExQixFQUE0QztBQUN4QyxXQUFPQyxLQUFLQSxJQUFaO0FBQ0g7O0FBRUQsU0FBT0EsSUFBUDtBQUNIOztBQUVELFNBQVNDLHdCQUFULENBQWtDRCxJQUFsQyxFQUF3Q0UsVUFBeEMsRUFBb0Q7QUFDaEQsU0FBT0YsS0FBS0csU0FBTCxDQUFnQkMsSUFBRCxJQUFVWixvQkFBb0JZLElBQXBCLEVBQTBCRixVQUExQixDQUF6QixDQUFQO0FBQ0g7O0FBRUQsU0FBU0csaUJBQVQsQ0FBMkJELElBQTNCLEVBQWlDRSxRQUFqQyxFQUEyQztBQUN6QyxTQUFPQSxTQUFTQyxHQUFULENBQWFDLEtBQWIsQ0FBbUJDLElBQW5CLEdBQTBCTCxLQUFLRyxHQUFMLENBQVNHLEdBQVQsQ0FBYUQsSUFBOUM7QUFDRDs7QUFFRCxTQUFTRSxvQkFBVCxDQUE4QlAsSUFBOUIsRUFBb0M7QUFDbEMsU0FBT0EsS0FBS0wsSUFBTCxLQUFjLGtCQUFkLElBQW9DSyxLQUFLUSxVQUF6QyxJQUF1RFIsS0FBS1EsVUFBTCxDQUFnQkMsTUFBOUU7QUFDRDs7QUFFRCxTQUFTQyxvQkFBVCxDQUE4QlYsSUFBOUIsRUFBb0M7QUFDbEMsU0FBT0EsS0FBS0wsSUFBTCxLQUFjLDBCQUFkLElBQTRDSyxLQUFLVyxXQUFMLENBQWlCaEIsSUFBakIsS0FBMEIsa0JBQTdFO0FBQ0Q7O0FBRURpQixPQUFPQyxPQUFQLEdBQWlCO0FBQ2ZDLFFBQU07QUFDSm5CLFVBQU0sUUFERjtBQUVKb0IsVUFBTTtBQUNKQyxXQUFLLHVCQUFRLHNCQUFSO0FBREQsS0FGRjtBQUtKQyxhQUFTLFlBTEw7QUFNSkMsWUFBUSxDQUNOO0FBQ0UsY0FBUSxRQURWO0FBRUUsb0JBQWM7QUFDWixpQkFBUztBQUNQLGtCQUFRLFNBREQ7QUFFUCxxQkFBVztBQUZKO0FBREcsT0FGaEI7QUFRRSw4QkFBd0I7QUFSMUIsS0FETTtBQU5KLEdBRFM7QUFvQmZDLFVBQVEsVUFBVUMsT0FBVixFQUFtQjtBQUN6QixRQUFJQyxRQUFRLENBQVo7QUFDQSxVQUFNQyxlQUFlLEVBQXJCOztBQUVBLGFBQVNDLGVBQVQsQ0FBeUJ2QixJQUF6QixFQUErQkUsUUFBL0IsRUFBeUNQLElBQXpDLEVBQStDO0FBQzdDLFVBQUllLHFCQUFxQlIsUUFBckIsQ0FBSixFQUFvQztBQUNsQyxZQUFJc0IsWUFBWXRCLFNBQVNTLFdBQXpCOztBQUVBLFlBQUlKLHFCQUFxQmlCLFNBQXJCLENBQUosRUFBcUM7QUFDbkN0QixxQkFBV3NCLFVBQVVoQixVQUFWLENBQXFCLENBQXJCLENBQVg7QUFDRDtBQUNGLE9BTkQsTUFNTyxJQUFJRCxxQkFBcUJMLFFBQXJCLENBQUosRUFBb0M7QUFDekNBLG1CQUFXQSxTQUFTTSxVQUFULENBQW9CLENBQXBCLENBQVg7QUFDRDs7QUFFRCxZQUFNaUIsVUFBVUwsUUFBUUssT0FBUixDQUFnQixDQUFoQixLQUFzQixFQUFFQyxPQUFPLENBQVQsRUFBdEM7QUFDQSxZQUFNQyxpQkFBaUIxQixrQkFBa0JELElBQWxCLEVBQXdCRSxRQUF4QixDQUF2QjtBQUNBLFlBQU0wQiwyQkFBMkJILFFBQVFDLEtBQVIsR0FBZ0IsQ0FBakQ7O0FBRUEsVUFBSUMsaUJBQWlCQyx3QkFBckIsRUFBK0M7QUFDN0MsWUFBSUMsU0FBUzdCLEtBQUtHLEdBQUwsQ0FBU0MsS0FBVCxDQUFleUIsTUFBNUI7O0FBRUEsWUFBSTdCLEtBQUtHLEdBQUwsQ0FBU0MsS0FBVCxDQUFlQyxJQUFmLEtBQXdCTCxLQUFLRyxHQUFMLENBQVNHLEdBQVQsQ0FBYUQsSUFBekMsRUFBK0M7QUFDN0N3QixtQkFBUyxDQUFUO0FBQ0Q7O0FBRURULGdCQUFRVSxNQUFSLENBQWU7QUFDYjNCLGVBQUs7QUFDSEUsa0JBQU1MLEtBQUtHLEdBQUwsQ0FBU0csR0FBVCxDQUFhRCxJQURoQjtBQUVId0I7QUFGRyxXQURRO0FBS2JFLG1CQUFVLFlBQVdOLFFBQVFDLEtBQU0sY0FBYUQsUUFBUUMsS0FBUixHQUFnQixDQUFoQixHQUFvQixHQUFwQixHQUEwQixFQUFHO1FBQy9FL0IsSUFBSyxzQ0FBcUNBLElBQUssR0FOaEM7QUFPYnFDLGVBQUtDLFNBQVNBLE1BQU1DLGVBQU4sQ0FDWmxDLElBRFksRUFFWixLQUFLbUMsTUFBTCxDQUFZUCwyQkFBMkJELGNBQXZDLENBRlk7QUFQRCxTQUFmO0FBWUQ7QUFDRjs7QUFFRCxhQUFTUyxjQUFULEdBQTBCO0FBQ3hCZjtBQUNEO0FBQ0QsYUFBU2dCLGNBQVQsR0FBMEI7QUFDeEJoQjtBQUNEOztBQUVELFdBQU87QUFDTGlCLHlCQUFtQixVQUFVdEMsSUFBVixFQUFnQjtBQUFBLGNBQ3pCdUMsTUFEeUIsR0FDZHZDLElBRGMsQ0FDekJ1QyxNQUR5Qjs7QUFFakMsY0FBTUMsZUFBZUQsT0FBTzNDLElBQVAsQ0FBWTZDLE9BQVosQ0FBb0J6QyxJQUFwQixDQUFyQjtBQUNBLGNBQU1FLFdBQVdxQyxPQUFPM0MsSUFBUCxDQUFZNEMsZUFBZSxDQUEzQixDQUFqQjs7QUFFQSxZQUFJdEMsWUFBWUEsU0FBU1AsSUFBVCxLQUFrQixtQkFBbEMsRUFBdUQ7QUFDckQ0QiwwQkFBZ0J2QixJQUFoQixFQUFzQkUsUUFBdEIsRUFBZ0MsUUFBaEM7QUFDRDtBQUNGLE9BVEk7QUFVTHdDLHNCQUFnQixVQUFTMUMsSUFBVCxFQUFlO0FBQzdCLFlBQUksNkJBQWdCQSxJQUFoQixLQUF5QnFCLFVBQVUsQ0FBdkMsRUFBMEM7QUFDeENDLHVCQUFhcUIsSUFBYixDQUFrQjNDLElBQWxCO0FBQ0Q7QUFDRixPQWRJO0FBZUwsc0JBQWdCLFlBQVk7QUFDMUJiLFlBQUkscUJBQUosRUFBMkJpQyxRQUFRd0IsV0FBUixFQUEzQjtBQUNBLGNBQU1DLFlBQVlyRCxhQUFhNEIsUUFBUTBCLFFBQVIsRUFBYixDQUFsQjtBQUNBM0QsWUFBSSxZQUFKLEVBQWtCMEQsU0FBbEI7O0FBRUF2QixxQkFBYXlCLE9BQWIsQ0FBcUIsVUFBVS9DLElBQVYsRUFBZ0JnRCxLQUFoQixFQUF1QjtBQUMxQyxnQkFBTVIsZUFBZTNDLHlCQUF5QmdELFNBQXpCLEVBQW9DN0MsSUFBcEMsQ0FBckI7QUFDQWIsY0FBSSx5QkFBSixFQUErQnFELFlBQS9COztBQUVBLGdCQUFNUywyQkFBMkJKLFVBQVVMLFlBQVYsQ0FBakM7QUFDQSxnQkFBTVUsZ0JBQWdCTCxVQUFVTCxlQUFlLENBQXpCLENBQXRCO0FBQ0EsZ0JBQU1XLGtCQUFrQjdCLGFBQWEwQixRQUFRLENBQXJCLENBQXhCOztBQUVBLGNBQUlHLG1CQUFtQi9ELG9CQUFvQjZELHdCQUFwQixFQUE4Q0UsZUFBOUMsQ0FBdkIsRUFBdUY7QUFDckY7QUFDRDs7QUFFRCxjQUFJRCxrQkFDQSxDQUFDQyxlQUFELElBQW9CLENBQUMvRCxvQkFBb0I4RCxhQUFwQixFQUFtQ0MsZUFBbkMsQ0FEckIsQ0FBSixFQUMrRTs7QUFFN0U1Qiw0QkFBZ0IwQix3QkFBaEIsRUFBMENDLGFBQTFDLEVBQXlELFNBQXpEO0FBQ0Q7QUFDRixTQWpCRDtBQWtCRCxPQXRDSTtBQXVDTEUsMkJBQXFCaEIsY0F2Q2hCO0FBd0NMaUIsMEJBQW9CakIsY0F4Q2Y7QUF5Q0xrQiwrQkFBeUJsQixjQXpDcEI7QUEwQ0xtQixzQkFBZ0JuQixjQTFDWDtBQTJDTG9CLHdCQUFrQnBCLGNBM0NiO0FBNENMcUIsaUJBQVdyQixjQTVDTjtBQTZDTCxrQ0FBNEJDLGNBN0N2QjtBQThDTCxpQ0FBMkJBLGNBOUN0QjtBQStDTCxzQ0FBZ0NBLGNBL0MzQjtBQWdETCw2QkFBdUJBLGNBaERsQjtBQWlETCwrQkFBeUJBLGNBakRwQjtBQWtETCx3QkFBa0JBO0FBbERiLEtBQVA7QUFvREQ7QUF4SGMsQ0FBakIiLCJmaWxlIjoibmV3bGluZS1hZnRlci1pbXBvcnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBmaWxlb3ZlcnZpZXcgUnVsZSB0byBlbmZvcmNlIG5ldyBsaW5lIGFmdGVyIGltcG9ydCBub3QgZm9sbG93ZWQgYnkgYW5vdGhlciBpbXBvcnQuXG4gKiBAYXV0aG9yIFJhZGVrIEJlbmtlbFxuICovXG5cbmltcG9ydCBpc1N0YXRpY1JlcXVpcmUgZnJvbSAnLi4vY29yZS9zdGF0aWNSZXF1aXJlJ1xuaW1wb3J0IGRvY3NVcmwgZnJvbSAnLi4vZG9jc1VybCdcblxuaW1wb3J0IGRlYnVnIGZyb20gJ2RlYnVnJ1xuY29uc3QgbG9nID0gZGVidWcoJ2VzbGludC1wbHVnaW4taW1wb3J0OnJ1bGVzOm5ld2xpbmUtYWZ0ZXItaW1wb3J0JylcblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFJ1bGUgRGVmaW5pdGlvblxuLy8tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gY29udGFpbnNOb2RlT3JFcXVhbChvdXRlck5vZGUsIGlubmVyTm9kZSkge1xuICAgIHJldHVybiBvdXRlck5vZGUucmFuZ2VbMF0gPD0gaW5uZXJOb2RlLnJhbmdlWzBdICYmIG91dGVyTm9kZS5yYW5nZVsxXSA+PSBpbm5lck5vZGUucmFuZ2VbMV1cbn1cblxuZnVuY3Rpb24gZ2V0U2NvcGVCb2R5KHNjb3BlKSB7XG4gICAgaWYgKHNjb3BlLmJsb2NrLnR5cGUgPT09ICdTd2l0Y2hTdGF0ZW1lbnQnKSB7XG4gICAgICBsb2coJ1N3aXRjaFN0YXRlbWVudCBzY29wZXMgbm90IHN1cHBvcnRlZCcpXG4gICAgICByZXR1cm4gbnVsbFxuICAgIH1cblxuICAgIGNvbnN0IHsgYm9keSB9ID0gc2NvcGUuYmxvY2tcbiAgICBpZiAoYm9keSAmJiBib2R5LnR5cGUgPT09ICdCbG9ja1N0YXRlbWVudCcpIHtcbiAgICAgICAgcmV0dXJuIGJvZHkuYm9keVxuICAgIH1cblxuICAgIHJldHVybiBib2R5XG59XG5cbmZ1bmN0aW9uIGZpbmROb2RlSW5kZXhJblNjb3BlQm9keShib2R5LCBub2RlVG9GaW5kKSB7XG4gICAgcmV0dXJuIGJvZHkuZmluZEluZGV4KChub2RlKSA9PiBjb250YWluc05vZGVPckVxdWFsKG5vZGUsIG5vZGVUb0ZpbmQpKVxufVxuXG5mdW5jdGlvbiBnZXRMaW5lRGlmZmVyZW5jZShub2RlLCBuZXh0Tm9kZSkge1xuICByZXR1cm4gbmV4dE5vZGUubG9jLnN0YXJ0LmxpbmUgLSBub2RlLmxvYy5lbmQubGluZVxufVxuXG5mdW5jdGlvbiBpc0NsYXNzV2l0aERlY29yYXRvcihub2RlKSB7XG4gIHJldHVybiBub2RlLnR5cGUgPT09ICdDbGFzc0RlY2xhcmF0aW9uJyAmJiBub2RlLmRlY29yYXRvcnMgJiYgbm9kZS5kZWNvcmF0b3JzLmxlbmd0aFxufVxuXG5mdW5jdGlvbiBpc0V4cG9ydERlZmF1bHRDbGFzcyhub2RlKSB7XG4gIHJldHVybiBub2RlLnR5cGUgPT09ICdFeHBvcnREZWZhdWx0RGVjbGFyYXRpb24nICYmIG5vZGUuZGVjbGFyYXRpb24udHlwZSA9PT0gJ0NsYXNzRGVjbGFyYXRpb24nXG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtZXRhOiB7XG4gICAgdHlwZTogJ2xheW91dCcsXG4gICAgZG9jczoge1xuICAgICAgdXJsOiBkb2NzVXJsKCduZXdsaW5lLWFmdGVyLWltcG9ydCcpLFxuICAgIH0sXG4gICAgZml4YWJsZTogJ3doaXRlc3BhY2UnLFxuICAgIHNjaGVtYTogW1xuICAgICAge1xuICAgICAgICAndHlwZSc6ICdvYmplY3QnLFxuICAgICAgICAncHJvcGVydGllcyc6IHtcbiAgICAgICAgICAnY291bnQnOiB7XG4gICAgICAgICAgICAndHlwZSc6ICdpbnRlZ2VyJyxcbiAgICAgICAgICAgICdtaW5pbXVtJzogMSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAnYWRkaXRpb25hbFByb3BlcnRpZXMnOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgXSxcbiAgfSxcbiAgY3JlYXRlOiBmdW5jdGlvbiAoY29udGV4dCkge1xuICAgIGxldCBsZXZlbCA9IDBcbiAgICBjb25zdCByZXF1aXJlQ2FsbHMgPSBbXVxuXG4gICAgZnVuY3Rpb24gY2hlY2tGb3JOZXdMaW5lKG5vZGUsIG5leHROb2RlLCB0eXBlKSB7XG4gICAgICBpZiAoaXNFeHBvcnREZWZhdWx0Q2xhc3MobmV4dE5vZGUpKSB7XG4gICAgICAgIGxldCBjbGFzc05vZGUgPSBuZXh0Tm9kZS5kZWNsYXJhdGlvblxuXG4gICAgICAgIGlmIChpc0NsYXNzV2l0aERlY29yYXRvcihjbGFzc05vZGUpKSB7XG4gICAgICAgICAgbmV4dE5vZGUgPSBjbGFzc05vZGUuZGVjb3JhdG9yc1swXVxuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGlzQ2xhc3NXaXRoRGVjb3JhdG9yKG5leHROb2RlKSkge1xuICAgICAgICBuZXh0Tm9kZSA9IG5leHROb2RlLmRlY29yYXRvcnNbMF1cbiAgICAgIH1cblxuICAgICAgY29uc3Qgb3B0aW9ucyA9IGNvbnRleHQub3B0aW9uc1swXSB8fCB7IGNvdW50OiAxIH1cbiAgICAgIGNvbnN0IGxpbmVEaWZmZXJlbmNlID0gZ2V0TGluZURpZmZlcmVuY2Uobm9kZSwgbmV4dE5vZGUpXG4gICAgICBjb25zdCBFWFBFQ1RFRF9MSU5FX0RJRkZFUkVOQ0UgPSBvcHRpb25zLmNvdW50ICsgMVxuXG4gICAgICBpZiAobGluZURpZmZlcmVuY2UgPCBFWFBFQ1RFRF9MSU5FX0RJRkZFUkVOQ0UpIHtcbiAgICAgICAgbGV0IGNvbHVtbiA9IG5vZGUubG9jLnN0YXJ0LmNvbHVtblxuXG4gICAgICAgIGlmIChub2RlLmxvYy5zdGFydC5saW5lICE9PSBub2RlLmxvYy5lbmQubGluZSkge1xuICAgICAgICAgIGNvbHVtbiA9IDBcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRleHQucmVwb3J0KHtcbiAgICAgICAgICBsb2M6IHtcbiAgICAgICAgICAgIGxpbmU6IG5vZGUubG9jLmVuZC5saW5lLFxuICAgICAgICAgICAgY29sdW1uLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbWVzc2FnZTogYEV4cGVjdGVkICR7b3B0aW9ucy5jb3VudH0gZW1wdHkgbGluZSR7b3B0aW9ucy5jb3VudCA+IDEgPyAncycgOiAnJ30gXFxcbmFmdGVyICR7dHlwZX0gc3RhdGVtZW50IG5vdCBmb2xsb3dlZCBieSBhbm90aGVyICR7dHlwZX0uYCxcbiAgICAgICAgICBmaXg6IGZpeGVyID0+IGZpeGVyLmluc2VydFRleHRBZnRlcihcbiAgICAgICAgICAgIG5vZGUsXG4gICAgICAgICAgICAnXFxuJy5yZXBlYXQoRVhQRUNURURfTElORV9ESUZGRVJFTkNFIC0gbGluZURpZmZlcmVuY2UpXG4gICAgICAgICAgKSxcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBpbmNyZW1lbnRMZXZlbCgpIHtcbiAgICAgIGxldmVsKytcbiAgICB9XG4gICAgZnVuY3Rpb24gZGVjcmVtZW50TGV2ZWwoKSB7XG4gICAgICBsZXZlbC0tXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIEltcG9ydERlY2xhcmF0aW9uOiBmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICBjb25zdCB7IHBhcmVudCB9ID0gbm9kZVxuICAgICAgICBjb25zdCBub2RlUG9zaXRpb24gPSBwYXJlbnQuYm9keS5pbmRleE9mKG5vZGUpXG4gICAgICAgIGNvbnN0IG5leHROb2RlID0gcGFyZW50LmJvZHlbbm9kZVBvc2l0aW9uICsgMV1cblxuICAgICAgICBpZiAobmV4dE5vZGUgJiYgbmV4dE5vZGUudHlwZSAhPT0gJ0ltcG9ydERlY2xhcmF0aW9uJykge1xuICAgICAgICAgIGNoZWNrRm9yTmV3TGluZShub2RlLCBuZXh0Tm9kZSwgJ2ltcG9ydCcpXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBDYWxsRXhwcmVzc2lvbjogZnVuY3Rpb24obm9kZSkge1xuICAgICAgICBpZiAoaXNTdGF0aWNSZXF1aXJlKG5vZGUpICYmIGxldmVsID09PSAwKSB7XG4gICAgICAgICAgcmVxdWlyZUNhbGxzLnB1c2gobm9kZSlcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgICdQcm9ncmFtOmV4aXQnOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxvZygnZXhpdCBwcm9jZXNzaW5nIGZvcicsIGNvbnRleHQuZ2V0RmlsZW5hbWUoKSlcbiAgICAgICAgY29uc3Qgc2NvcGVCb2R5ID0gZ2V0U2NvcGVCb2R5KGNvbnRleHQuZ2V0U2NvcGUoKSlcbiAgICAgICAgbG9nKCdnb3Qgc2NvcGU6Jywgc2NvcGVCb2R5KVxuXG4gICAgICAgIHJlcXVpcmVDYWxscy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlLCBpbmRleCkge1xuICAgICAgICAgIGNvbnN0IG5vZGVQb3NpdGlvbiA9IGZpbmROb2RlSW5kZXhJblNjb3BlQm9keShzY29wZUJvZHksIG5vZGUpXG4gICAgICAgICAgbG9nKCdub2RlIHBvc2l0aW9uIGluIHNjb3BlOicsIG5vZGVQb3NpdGlvbilcblxuICAgICAgICAgIGNvbnN0IHN0YXRlbWVudFdpdGhSZXF1aXJlQ2FsbCA9IHNjb3BlQm9keVtub2RlUG9zaXRpb25dXG4gICAgICAgICAgY29uc3QgbmV4dFN0YXRlbWVudCA9IHNjb3BlQm9keVtub2RlUG9zaXRpb24gKyAxXVxuICAgICAgICAgIGNvbnN0IG5leHRSZXF1aXJlQ2FsbCA9IHJlcXVpcmVDYWxsc1tpbmRleCArIDFdXG5cbiAgICAgICAgICBpZiAobmV4dFJlcXVpcmVDYWxsICYmIGNvbnRhaW5zTm9kZU9yRXF1YWwoc3RhdGVtZW50V2l0aFJlcXVpcmVDYWxsLCBuZXh0UmVxdWlyZUNhbGwpKSB7XG4gICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobmV4dFN0YXRlbWVudCAmJlxuICAgICAgICAgICAgICghbmV4dFJlcXVpcmVDYWxsIHx8ICFjb250YWluc05vZGVPckVxdWFsKG5leHRTdGF0ZW1lbnQsIG5leHRSZXF1aXJlQ2FsbCkpKSB7XG5cbiAgICAgICAgICAgIGNoZWNrRm9yTmV3TGluZShzdGF0ZW1lbnRXaXRoUmVxdWlyZUNhbGwsIG5leHRTdGF0ZW1lbnQsICdyZXF1aXJlJylcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICB9LFxuICAgICAgRnVuY3Rpb25EZWNsYXJhdGlvbjogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBGdW5jdGlvbkV4cHJlc3Npb246IGluY3JlbWVudExldmVsLFxuICAgICAgQXJyb3dGdW5jdGlvbkV4cHJlc3Npb246IGluY3JlbWVudExldmVsLFxuICAgICAgQmxvY2tTdGF0ZW1lbnQ6IGluY3JlbWVudExldmVsLFxuICAgICAgT2JqZWN0RXhwcmVzc2lvbjogaW5jcmVtZW50TGV2ZWwsXG4gICAgICBEZWNvcmF0b3I6IGluY3JlbWVudExldmVsLFxuICAgICAgJ0Z1bmN0aW9uRGVjbGFyYXRpb246ZXhpdCc6IGRlY3JlbWVudExldmVsLFxuICAgICAgJ0Z1bmN0aW9uRXhwcmVzc2lvbjpleGl0JzogZGVjcmVtZW50TGV2ZWwsXG4gICAgICAnQXJyb3dGdW5jdGlvbkV4cHJlc3Npb246ZXhpdCc6IGRlY3JlbWVudExldmVsLFxuICAgICAgJ0Jsb2NrU3RhdGVtZW50OmV4aXQnOiBkZWNyZW1lbnRMZXZlbCxcbiAgICAgICdPYmplY3RFeHByZXNzaW9uOmV4aXQnOiBkZWNyZW1lbnRMZXZlbCxcbiAgICAgICdEZWNvcmF0b3I6ZXhpdCc6IGRlY3JlbWVudExldmVsLFxuICAgIH1cbiAgfSxcbn1cbiJdfQ==
"use strict";

var _values = require("graphql/execution/values");

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function getBooleanArgumentValue(context, ast) {
  var argument = ast.arguments[0].value;

  switch (argument.kind) {
    case 'BooleanValue':
      return argument.value;

    case 'Variable':
      return context.variableValues[argument.name.value];
  }
}

function isExcludedByDirective(context, ast) {
  var directives = ast.directives;
  var isExcluded = false;
  directives.forEach(function (directive) {
    switch (directive.name.value) {
      case 'include':
        isExcluded = isExcluded || !getBooleanArgumentValue(context, directive);
        break;

      case 'skip':
        isExcluded = isExcluded || getBooleanArgumentValue(context, directive);
        break;
    }
  });
  return isExcluded;
}

function dotConcat(a, b) {
  return a ? "".concat(a, ".").concat(b) : b;
}

function getFieldSet(context) {
  var asts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : context.fieldASTs || context.fieldNodes;
  var prefix = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';

  // for recursion: fragments doesn't have many sets
  if (!Array.isArray(asts)) {
    asts = [asts];
  }

  var selections = asts.reduce(function (selections, source) {
    selections.push.apply(selections, _toConsumableArray(source.selectionSet.selections));
    return selections;
  }, []);
  return selections.reduce(function (set, ast) {
    if (isExcludedByDirective(context, ast)) {
      return set;
    }

    switch (ast.kind) {
      case 'Field':
        var newPrefix = dotConcat(prefix, ast.name.value);

        if (ast.selectionSet) {
          return Object.assign({}, set, getFieldSet(context, ast, newPrefix));
        } else {
          set[newPrefix] = true;
          return set;
        }

      case 'InlineFragment':
        return Object.assign({}, set, getFieldSet(context, ast, prefix));

      case 'FragmentSpread':
        return Object.assign({}, set, getFieldSet(context, context.fragments[ast.name.value], prefix));
    }
  }, {});
}

function findDirective(fieldName, parentType, resolvelInfo) {
  var directives = {};
  parentType.getFields()[fieldName].astNode.directives.forEach(function (directive) {
    var directiveName = directive.name.value;
    var def = resolvelInfo.schema.getDirective(directiveName);

    if (typeof def === 'undefined') {
      throw new Error("Directive @".concat(directiveName, " is undefined. Please define in schema before using"));
    }

    directives[directiveName] = (0, _values.getArgumentValues)(def, directive);
  });
  return directives;
}

function _getField(context, ast, parentType) {
  // Handle InlineFragment - interface
  if (parentType.astNode.kind === 'InterfaceTypeDefinition' && ast.typeCondition) {
    parentType = context.schema.getType(ast.typeCondition.name.value);
  } // Current schema type


  var field = parentType.getFields()[ast.name.value];
  var astType = field.type;
  var targetType = astType.ofType || astType; // We need to find the real type name

  var typeName = targetType.name;
  var kind = astType.toString().startsWith('[') ? 'LIST' : 'ONE'; // FIXME: Small hack for relay connection

  if (astType.toString().endsWith('Connection')) {
    typeName = typeName.replace('Connection', '');
    kind = 'CONNECTION';
  } // User blank type name for interface


  typeName = targetType.astNode && targetType.astNode.kind === 'InterfaceTypeDefinition' ? '' : typeName; // Query params

  var args = (0, _values.getArgumentValues)(field, ast);
  return {
    __name: ast.name.value,
    __alias: ast.alias ? ast.alias.value : undefined,
    __resolve: field.resolve || _values.defaultFieldResolver,
    __type: typeName,
    __kind: kind,
    __args: args,
    __fields: ast.selectionSet ? getFieldSelectionSet(context, ast, targetType) : {},
    __directives: findDirective(ast.name.value, parentType, context) // Find directives

  };
}

function getFieldSelectionSet(context) {
  var asts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : context.fieldASTs || context.fieldNodes;
  var parentType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  // Root node name
  var node = (context.returnType.ofType || context.returnType).toString(); // Get root type of not exist

  parentType = parentType || context.schema.getType(node); // Handle InlineFragment - interface

  if (parentType.astNode.kind === 'InterfaceTypeDefinition' && asts.typeCondition) {
    parentType = context.schema.getType(asts.typeCondition.name.value);
  } // for recursion: fragments doesn't have many sets


  if (!Array.isArray(asts)) {
    asts = [asts];
  }

  var selections = asts.reduce(function (selections, source) {
    selections.push.apply(selections, _toConsumableArray(source.selectionSet.selections));
    return selections;
  }, []);
  return selections.reduce(function (set, ast) {
    if (isExcludedByDirective(context, ast)) {
      return set;
    }

    switch (ast.kind) {
      case 'Field':
        if (!parentType.getFields()[ast.name.value]) {
          return set;
        }

        return _extends({}, set, _defineProperty({}, ast.alias ? ast.alias.value : ast.name.value, _getField(context, ast, parentType)));

      case 'InlineFragment':
        return Object.assign({}, set, getFieldSelectionSet(context, ast, parentType));

      case 'FragmentSpread':
        return Object.assign({}, set, getFieldSelectionSet(context, context.fragments[ast.name.value], parentType));
    }
  }, {});
}

module.exports = {
  getFieldList: function getFieldList(context) {
    return Object.keys(getFieldSet(context));
  },
  getFieldSelection: function getFieldSelection(context) {
    return getFieldSelectionSet(context);
  },
  getField: function getField(context, ast, parentType) {
    return _getField(context, ast, parentType);
  }
};

function getBooleanArgumentValue(context, ast) {
    const argument = ast.arguments[0].value;
    switch (argument.kind) {
        case 'BooleanValue':
            return argument.value;
        case 'Variable':
            return context.variableValues[argument.name.value];
    }
}

function isExcludedByDirective(context, ast) {
    const directives = ast.directives;
    let isExcluded = false;
    directives.forEach((directive) => {
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
    return a ? `${a}.${b}` : b;
}

function getFieldSet(context, asts = context.fieldASTs || context.fieldNodes, prefix = '') {
    // for recursion: fragments doesn't have many sets
    if (!Array.isArray(asts)) {
        asts = [asts];
    }

    const selections = asts.reduce((selections, source) => {
        selections.push(...source.selectionSet.selections);
        return selections;
    }, []);

    return selections.reduce((set, ast) => {
        if (isExcludedByDirective(context, ast)) {
            return set;
        }
        switch (ast.kind) {
            case 'Field':
                const newPrefix = dotConcat(prefix, ast.name.value);
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

function getFieldArguments(args) {
    return args.filter(arg => (arg.value || arg.defaultValue)).reduce((obj, argument) => {
        obj[argument.name] = argument.value || argument.defaultValue;
        return obj;
    }, {});
}

function getArguments(args, variableValues = {}) {
    return args.reduce((obj, argument) => {
        if (argument.value.fields) {
            obj[argument.name.value] = getArguments(argument.value.fields);
        } else {
            obj[argument.name.value] = argument.value && argument.value.value || variableValues[argument.name.value] || argument.defaultValue && argument.defaultValue.value || null;
        }
        return obj;
    }, {});
}

function findDirective(fieldName, parentType) {
    const directives = {};
    parentType.getFields()[fieldName].astNode.directives.forEach((directive) => {
        // Add to directive list
        directives[directive.name.value] = getArguments(directive.arguments);
    });
    return directives;
}

function getField(context, ast, parentType) {
    // Handle InlineFragment - interface
    if (parentType.astNode.kind === 'InterfaceTypeDefinition' && ast.typeCondition) {
        parentType = context.schema.getType(ast.typeCondition.name.value);
    }

    // Current schema type
    const astType = parentType.getFields()[ast.name.value].type;
    const defaultArgs = getFieldArguments(parentType.getFields()[ast.name.value].args);
    const targetType = astType.ofType || astType;

    // We need to find the real type name
    let typeName = targetType.name;
    let kind = astType.toString().startsWith('[') ? 'LIST' : 'ONE';

    // FIXME: Small hack for relay connection
    if (astType.toString().endsWith('Connection')) {
        typeName = typeName.replace('Connection', '');
        kind = 'CONNECTION';
    }

    // User blank type name for interface
    typeName = targetType.astNode && targetType.astNode.kind === 'InterfaceTypeDefinition' ? '' : typeName;

    // Query params
    const args = getArguments(ast.arguments, context.variableValues);

    return {
        __name: ast.name.value,
        __type: typeName,
        __kind: kind,
        __args: { ...defaultArgs, ...args },
        __fields: ast.selectionSet ? getFieldSelectionSet(context, ast, targetType) : {},
        __directives: findDirective(ast.name.value, parentType), // Find directives
    };
}

function getFieldSelectionSet(context, asts = context.fieldASTs || context.fieldNodes, parentType = null) {
    // Root node name
    const node = (context.returnType.ofType || context.returnType).toString();
    // Get root type of not exist
    parentType = parentType || context.schema.getType(node);
    // Handle InlineFragment - interface
    if (parentType.astNode.kind === 'InterfaceTypeDefinition' && asts.typeCondition) {
        parentType = context.schema.getType(asts.typeCondition.name.value);
    }

    // for recursion: fragments doesn't have many sets
    if (!Array.isArray(asts)) {
        asts = [asts];
    }

    const selections = asts.reduce((selections, source) => {
        selections.push(...source.selectionSet.selections);
        return selections;
    }, []);

    return selections.reduce((set, ast) => {
        if (isExcludedByDirective(context, ast)) {
            return set;
        }
        switch (ast.kind) {
            case 'Field':
                if (!parentType.getFields()[ast.name.value]) {
                    return set;
                }
                return {
                    ...set,
                    [ast.name.value]: getField(context, ast, parentType)
                };
            case 'InlineFragment':
                return Object.assign({}, set, getFieldSelectionSet(context, ast, parentType));
            case 'FragmentSpread':
                return Object.assign({}, set, getFieldSelectionSet(context, context.fragments[ast.name.value], parentType));
        }
    }, {});
}

module.exports = {
    getFieldList: (context) => {
        return Object.keys(getFieldSet(context));
    },
    getFieldSelection: (context) => {
        return getFieldSelectionSet(context);
    },
    getField: (context, ast, parentType) => {
        return getField(context, ast, parentType);
    }
};
import { getArgumentValues, defaultFieldResolver } from 'graphql/execution/values';

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

function findDirective(fieldName, parentType, resolvelInfo) {
    const directives = {};
    parentType.getFields()[fieldName].astNode.directives.forEach((directive) => {
        const directiveName = directive.name.value;
        const def = resolvelInfo.schema.getDirective(directiveName);
        if (typeof def === 'undefined') {
            throw new Error(`Directive @${directiveName} is undefined. Please define in schema before using`);
        }
        directives[directiveName] = getArgumentValues(def, directive);
    });
    return directives;
}

function getField(context, ast, parentType) {
    // Handle InlineFragment - interface
    if (parentType.astNode.kind === 'InterfaceTypeDefinition' && ast.typeCondition) {
        parentType = context.schema.getType(ast.typeCondition.name.value);
    }

    // Current schema type
    const field = parentType.getFields()[ast.name.value];
    const astType = field.type;
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
    const args = getArgumentValues(field, ast);

    return {
        __name: ast.name.value,
        __alias: ast.alias ? ast.alias.value : undefined,
        __resolve: field.resolve || defaultFieldResolver,
        __type: typeName,
        __kind: kind,
        __args: args,
        __fields: ast.selectionSet ? getFieldSelectionSet(context, ast, targetType) : {},
        __directives: findDirective(ast.name.value, parentType, context), // Find directives
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
                    [ast.alias ? ast.alias.value : ast.name.value]: getField(context, ast, parentType)
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
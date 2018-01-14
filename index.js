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

function findDirective(ast, schemaType) {
    const directives = {};
    schemaType.getFields()[ast.name.value].astNode.directives.forEach((directive) => {
        // Directive options
        const options = directive.arguments.reduce((obj, argument) => {
            obj[argument.name.value] = argument.value.value;
            return obj;
        }, {});
        // Add to directive list
        directives[directive.name.value] = options;
    });
    return directives;
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

function getFieldSetWithDirective(context, asts = context.fieldASTs || context.fieldNodes, schemaType = null) {
    // Root node name
    const node = (context.returnType.ofType || context.returnType).toString();
    // Get root type of not exist
    schemaType = schemaType || context.schema.getType(node);
    // Get query vairable values
    const variableValues = context.variableValues;
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
                if (ast.selectionSet) {
                    if (!schemaType.getFields()[ast.name.value]) {
                        return set;
                    }

                    // Current schema type
                    const astType = schemaType.getFields()[ast.name.value].type;
                    const targetType = astType.ofType || astType;

                    // We need to find the real type name
                    let typeName = targetType.name;

                    // Small hack for relay connection
                    if (typeName.endsWith('Connection')) {
                        typeName = targetType.getFields()['edges'].type.ofType.getFields().node.type.name;
                    }

                    // Child query params
                    const args = ast.arguments.reduce((obj, argument) => {
                        obj[argument.name.value] = argument.value.value || variableValues[argument.name.value] || null;
                        return obj;
                    }, {});

                    // User blank type name for interface
                    typeName = targetType.astNode.kind === 'InterfaceTypeDefinition' ? '' : typeName;

                    // Basic field value
                    set[ast.name.value] = {
                        __name: ast.name.value,
                        __type: typeName,
                        __kind: astType.toString().startsWith('[') ? 'LIST' : 'ONE',
                        __args: args,
                        __fields: getFieldSetWithDirective(context, ast, targetType),
                        __directives: findDirective(ast, schemaType),
                    };
                    
                    return set;
                } else {
                    set[ast.name.value] = {
                        __name: ast.name.value,
                        __directives: findDirective(ast, schemaType),
                    };
                    return set;
                }
            case 'InlineFragment':
                return Object.assign({}, set, getFieldSetWithDirective(context, ast, schemaType));
            case 'FragmentSpread':
                return Object.assign({}, set, getFieldSetWithDirective(context, context.fragments[ast.name.value], schemaType));
        }
    }, {});
}

module.exports = {
    getFieldList: (context) => {
        return Object.keys(getFieldSet(context));
    },
    getFieldListWithDirective: (context) => {
        return getFieldSetWithDirective(context);
    }
};
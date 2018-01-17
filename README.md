# graphql-list-fields
[![Build Status](https://travis-ci.org/jakepusateri/graphql-list-fields.svg?branch=master)](https://travis-ci.org/jakepusateri/graphql-list-fields)
[![npm version](https://badge.fury.io/js/graphql-list-fields.svg)](https://badge.fury.io/js/graphql-list-fields)
[![Coverage Status](https://coveralls.io/repos/github/jakepusateri/graphql-list-fields/badge.svg?branch=master)](https://coveralls.io/github/jakepusateri/graphql-list-fields?branch=master)

When implementing a GraphQL server, it can be useful to know the list of fields being queried on
a given type. This module takes a GraphQLResolveInfo object and returns a list of fields.

Supported features
- Basic Fields
- Fragments
- Inline Fragments
- `@skip` and `@include` directives
- Nested fields into dot.notation

```
npm install --save graphql-list-fields
```

## Usage
#### Nested fields into dot.notation
```javascript
import { getFieldList } from 'graphql-list-fields';

// in some resolve function
resolve(parent, args, context, info) {
    const fields = getFieldList(info);
    return fetch('/someservice/?fields=' + fields.join(','));
}
```

#### Get all nested into object
```javascript
import { getFieldSelection } from 'graphql-list-fields';

// in some resolve function
resolve(parent, args, context, info) {
    const fields = getFieldSelection(info);
    console.log(fields);
    return 'something';
}
```
#### Example: 
GraphQL:
```
{
    Movie {
        title
        actors {
            id
        }
    }
}
```
Result: 
```javascript
{
    title: {
        __args: {}, 
        __directives: {}, 
        __kind: "ONE", 
        __name: "title", 
        __type: "String",
        __fields: {}
    },
    actors: {
        __args: {}, 
        __directives: {
            relation: {
                direction: "IN", name: "ACTED_IN"
            }
        }, 
        __kind: "LIST", 
        __name: "actors", 
        __type: "Actor",
        __fields: {
            id: {
                __args: {}, 
                __directives: {}, 
                __kind: "ONE", 
                __name: "id", 
                __type: "ID",
                __fields: {}
            },
        }
    }
}
```
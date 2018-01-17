import {
    makeExecutableSchema
} from 'graphql-tools';
import {
    graphql,
    GraphQLSchema,
    GraphQLString,
    GraphQLObjectType,
    GraphQLScalarType,
    buildSchema
} from 'graphql';
import {
    Parser,
    Printer
} from 'graphql/language';
import {
    getFieldSelection,
    getFieldList
} from '../';

function testGetFieldSelection(query, expected, variables) {
    return Promise.resolve().then(() => {
        let actual;

        function resolver(parent, args, context, info) {
            try {
                actual = getFieldSelection(info);
            } catch (error) {
                console.log(error);
            }
            return {
                a: 1,
                b: 2,
                c: 3,
                d: 4,
                e: {
                    a: 5
                }
            };
        }

        const resolverSpy = jest.fn(resolver);

        const resolvers = {
            Query: {
                Movie: resolverSpy,
                allMovie: resolverSpy,
            },
            Cursor: new GraphQLScalarType({
                name: 'Cursor',
                serialize(value) {
                    return value.value;
                }
            }),
        };

        const typeDefs = `
			scalar Cursor

			type Movie {
				movieId: ID!
				title: String
				year: Int
				plot: String
				poster: String
				imdbRating: Float
				similar(first: Int = 3, skip: Int = 0): [Movie] @cypher(statement: "MATCH (this)-[:IN_GENRE]->(:Genre)<-[:IN_GENRE]-(o:Movie) RETURN o")
				degree: Int @cypher(statement: "RETURN SIZE((this)-->())")
				actors(first: Int = 3, skip: Int = 0): [Actor] @relation(name: "ACTED_IN", direction:"IN")
				allActor(first: Int = 3, skip: Int = 0): ActorConnection @relation(name: "ACTED_IN", direction:"IN")
			}
			
			type MovieEdge {
				node: Movie 
				cursor: Cursor
			}

			type MovieConnection {
				count: Int
				edges: [MovieEdge]
			}
			
			type Actor {
				id: ID!
				name: String
				movies: [Movie]
			}

			type ActorEdge {
				node: Actor 
				cursor: Cursor
			}

			type ActorConnection {
				count: Int
				edges: [ActorEdge]
			}

			type Query {
				Movie(id: ID, title: String, year: Int, imdbRating: Float, first: Int, skip: Int): [Movie]
				allMovie(id: ID, title: String, year: Int, imdbRating: Float, first: Int, skip: Int): MovieConnection
			}
		`;

        const schema = makeExecutableSchema({
            typeDefs,
            resolvers,
        });

        const result = graphql(schema, query, {}, {}, variables).then(() => {
            // expect(resolverSpy).toHaveBeenCalled();
            expect(actual).toEqual(expected);
        });
        return result;
    });
}

it('basic query', () => {
    return testGetFieldSelection(`{
		Movie {
			title
			year
			imdbRating
			degree
			similar {
				movieId
			}
			actors {
				id
			}
			allActor {
				count
				edges {
					cursor 
					node {
						id
					}
				}
			}
		}
	}`, {
        "actors": {
            "__args": {},
            "__directives": {
                "relation": {
                    "direction": "IN",
                    "name": "ACTED_IN"
                }
            },
            "__fields": {
                "id": {
                    "__args": {},
                    "__directives": {},
                    "__fields": {},
                    "__kind": "ONE",
                    "__name": "id",
                    "__type": "ID"
                }
            },
            "__kind": "LIST",
            "__name": "actors",
            "__type": "Actor"
        },
        "allActor": {
            "__args": {},
            "__directives": {
                "relation": {
                    "direction": "IN",
                    "name": "ACTED_IN"
                }
            },
            "__fields": {
                "count": {
                    "__args": {},
                    "__directives": {},
                    "__fields": {},
                    "__kind": "ONE",
                    "__name": "count",
                    "__type": "Int"
                },
                "edges": {
                    "__args": {},
                    "__directives": {},
                    "__fields": {
                        "cursor": {
                            "__args": {},
                            "__directives": {},
                            "__fields": {},
                            "__kind": "ONE",
                            "__name": "cursor",
                            "__type": "Cursor"
                        },
                        "node": {
                            "__args": {},
                            "__directives": {},
                            "__fields": {
                                "id": {
                                    "__args": {},
                                    "__directives": {},
                                    "__fields": {},
                                    "__kind": "ONE",
                                    "__name": "id",
                                    "__type": "ID"
                                }
                            },
                            "__kind": "ONE",
                            "__name": "node",
                            "__type": "Actor"
                        }
                    },
                    "__kind": "LIST",
                    "__name": "edges",
                    "__type": "ActorEdge"
                }
            },
            "__kind": "CONNECTION",
            "__name": "allActor",
            "__type": "Actor"
        },
        "degree": {
            "__args": {},
            "__directives": {
                "cypher": {
                    "statement": "RETURN SIZE((this)-->())"
                }
            },
            "__fields": {},
            "__kind": "ONE",
            "__name": "degree",
            "__type": "Int"
        },
        "imdbRating": {
            "__args": {},
            "__directives": {},
            "__fields": {},
            "__kind": "ONE",
            "__name": "imdbRating",
            "__type": "Float"
        },
        "similar": {
            "__args": {},
            "__directives": {
                "cypher": {
                    "statement": "MATCH (this)-[:IN_GENRE]->(:Genre)<-[:IN_GENRE]-(o:Movie) RETURN o"
                }
            },
            "__fields": {
                "movieId": {
                    "__args": {},
                    "__directives": {},
                    "__fields": {},
                    "__kind": "ONE",
                    "__name": "movieId",
                    "__type": "ID"
                }
            },
            "__kind": "LIST",
            "__name": "similar",
            "__type": "Movie"
        },
        "title": {
            "__args": {},
            "__directives": {},
            "__fields": {},
            "__kind": "ONE",
            "__name": "title",
            "__type": "String"
        },
        "year": {
            "__args": {},
            "__directives": {},
            "__fields": {},
            "__kind": "ONE",
            "__name": "year",
            "__type": "Int"
        }
    });
});

it('connection query', () => {
    return testGetFieldSelection(`{
		allMovie {
		  edges {
			  cursor 
			  node {
				title
				year
				imdbRating
			  }
		  }
		}
	}`, {
        "edges": {
            "__args": {},
            "__directives": {},
            "__fields": {
                "cursor": {
                    "__args": {},
                    "__directives": {},
                    "__fields": {},
                    "__kind": "ONE",
                    "__name": "cursor",
                    "__type": "Cursor"
                },
                "node": {
                    "__args": {},
                    "__directives": {},
                    "__fields": {
                        "imdbRating": {
                            "__args": {},
                            "__directives": {},
                            "__fields": {},
                            "__kind": "ONE",
                            "__name": "imdbRating",
                            "__type": "Float"
                        },
                        "title": {
                            "__args": {},
                            "__directives": {},
                            "__fields": {},
                            "__kind": "ONE",
                            "__name": "title",
                            "__type": "String"
                        },
                        "year": {
                            "__args": {},
                            "__directives": {},
                            "__fields": {},
                            "__kind": "ONE",
                            "__name": "year",
                            "__type": "Int"
                        }
                    },
                    "__kind": "ONE",
                    "__name": "node",
                    "__type": "Movie"
                }
            },
            "__kind": "LIST",
            "__name": "edges",
            "__type": "MovieEdge"
        }
    });
});
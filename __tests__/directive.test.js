import { makeExecutableSchema } from 'graphql-tools';
import { graphql, GraphQLSchema, GraphQLString, GraphQLObjectType, buildSchema } from 'graphql';
import { Parser, Printer } from 'graphql/language';
import { getFieldSelection, getFieldList } from '../';

function testGetFieldSelection(query, expected, variables) {
	return Promise.resolve().then(() => {
		let actual;

		function resolver(parent, args, context, info) {
			try {
				actual = getFieldSelection(info);
			} catch (error) {
				console.log(error);
			}
			return { a: 1, b: 2, c: 3, d: 4, e: { a: 5 } };
		}

		const resolverSpy = jest.fn(resolver);

		const resolvers = {
			Query: {
				Movie: resolverSpy,
				allMovie: resolverSpy,
			}
		};

		const typeDefs = `
			type Movie {
				movieId: ID!
				title: String
				year: Int
				plot: String
				poster: String
				imdbRating: Float
				similar(first: Int = 3, offset: Int = 0): [Movie] @cypher(statement: "MATCH (this)-[:IN_GENRE]->(:Genre)<-[:IN_GENRE]-(o:Movie) RETURN o")
				degree: Int @cypher(statement: "RETURN SIZE((this)-->())")
				actors(first: Int = 3, offset: Int = 0): [Actor] @relation(name: "ACTED_IN", direction:"IN")
			}
			
			type Actor {
				id: ID!
				name: String
				movies: [Movie]
			}

			type Cursor {
				value: String
			}

			type MovieEdge {
				node: Movie 
				cursor: Cursor
			}

			type MovieConnection {
				edges: [MovieEdge]
			}

			type Query {
				Movie(id: ID, title: String, year: Int, imdbRating: Float, first: Int, offset: Int): [Movie]
				allMovie(id: ID, title: String, year: Int, imdbRating: Float, first: Int, offset: Int): MovieConnection
			}
		`;

		const schema = makeExecutableSchema({
			typeDefs,
			resolvers,
		});

		const result = graphql(schema, query, undefined, undefined, variables).then(() => {
			expect(resolverSpy).toHaveBeenCalled();
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

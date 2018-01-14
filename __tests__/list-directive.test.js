//@ts-check
import { makeExecutableSchema } from 'graphql-tools';
import { graphql, GraphQLSchema, GraphQLString, GraphQLObjectType, buildSchema } from 'graphql';
import { Parser, Printer } from 'graphql/language';
import { getFieldListWithDirective, getFieldList } from '../';

function testGetFields(query, expected, variables) {
	return Promise.resolve().then(() => {
		let actual;

		function resolver(parent, args, context, info) {
			actual = getFieldListWithDirective(info);
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

		const schema = makeExecutableSchema({ typeDefs, resolvers, });
		
		const result = graphql(schema, query, undefined, undefined, variables).then(() => {
			expect(resolverSpy).toHaveBeenCalled();
			expect(actual).toEqual(expected);
		});
		return result;
	});
}

it('basic query', () => {
	return testGetFields(`{
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
			imdbRating: { __name: "imdbRating", __directives: {}, },
			title: { __name: "title", __directives: {}, },
			year: { __name: "year", __directives: {}, },
			degree: {
				__name: "degree",
				__directives: {
					cypher: { 
						statement: "RETURN SIZE((this)-->())" 
					}
				},
			},
			similar: {
				__name: "similar",
				__args: {},
				__directives: {
					cypher: {
						statement: "MATCH (this)-[:IN_GENRE]->(:Genre)<-[:IN_GENRE]-(o:Movie) RETURN o"
					}
				}, 
				__fields: {
					movieId: {
						__directives: {}, 
						__name: "movieId"
					}
				},
				__kind: "LIST",
				__type: "Movie",
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
						__name: "id", 
						__directives: {},
					},
				}
			}
		});
});

it('connection query', () => {
	return testGetFields(`{
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
			edges: {
				__name: "edges",
				__args: {},
				__directives: {},
				__fields: {
					node: {
						__name: "node",
						__type: "Movie",
						__kind: "ONE",
						__args: {},
						__directives: {},
						__fields: {
							imdbRating: {
								__name: "imdbRating", __directives: {},
							},
							title: {
								__name: "title", __directives: {},
							},
							year: {
								__name: "year", __directives: {},
							}
						},
					}
				},
				__type: "MovieEdge",
				__kind: "LIST",
			}
		});
});
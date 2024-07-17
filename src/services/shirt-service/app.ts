import { createServer } from 'http';
import { GraphQLError } from 'graphql';
import { createSchema, createYoga} from 'graphql-yoga';

const shirts = [
  { id: '1', sleeveLength: 6 },
  { id: '2', sleeveLength: 10 },
];

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Shirt {
      id: ID!
      """
      The length of the sleeve in inches
      """
      sleeveLength: Int!
    }

    type Query {
      shirtById(id: ID!): Shirt
    }
  `,
  resolvers: {
    Query: {
      shirtById: (root, { id }) =>
        shirts.find(p => p.id === id) ||
        new GraphQLError('Record not found', {
          extensions: {
            code: 'NOT_FOUND',
          },
        }),
    },
  },
});
const yoga = createYoga({
  schema,
});

const server = createServer(yoga);

server.listen(4002, () => console.log('shirt-service running at http://localhost:4002/graphql'));
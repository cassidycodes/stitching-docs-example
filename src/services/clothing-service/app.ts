import { createServer } from 'http';
import { GraphQLError } from 'graphql';
import { createSchema, createYoga} from 'graphql-yoga';

const shirts = [
  { id: '1', torsoLength: 15 },
  { id: '2', torsoLength: 3 },
];

export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Shirt {
      id: ID!
      """
      The length of the torso in inches
      """
      torsoLength: Int!
    }

    type Query {
      clothingById(id: ID!): Shirt
    }
  `,
  resolvers: {
    Query: {
      clothingById: (root, { id }) =>
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

server.listen(4001, () => console.log('clothing-service running at http://localhost:4001/graphql'));
import { buildSchema, parse, Kind} from 'graphql';
import { createYoga } from 'graphql-yoga';
import waitOn from 'wait-on';
import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { stitchSchemas } from '@graphql-tools/stitch';
import { Executor } from '@graphql-tools/utils';
import { schemaFromExecutor, TransformObjectFields } from '@graphql-tools/wrap';
import { createServer } from 'http';

async function makeGatewaySchema() {
  await waitOn({ resources: ['tcp:4001', 'tcp:4002'] });
  const clothingExec = buildHTTPExecutor({
    endpoint: 'http://localhost:4001/graphql',
    headers: executorRequest => ({
      Authorization: executorRequest?.context?.authHeader,
    }),
  });
  const shirtExec = buildHTTPExecutor({
    endpoint: 'http://localhost:4002/graphql',
    headers: executorRequest => ({
      Authorization: executorRequest?.context?.authHeader,
    }),
  });

  const adminContext = { authHeader: 'Bearer my-app-to-app-token' };

  interface documentSourceServiceOptions {
    graphQLURL?: string;
    serviceName?: string;
  }

  const documentSourceService = ({
    serviceName = 'unknown',
  }: documentSourceServiceOptions) => {
    return new TransformObjectFields((_typeName, _fieldName, fieldConfig) => {
      let service = serviceName;

      const commentToAdd = `Resolved by ${service}.`;

      if (fieldConfig.astNode) {
        fieldConfig.astNode = {
          ...fieldConfig.astNode,
          description: {
            ...fieldConfig.astNode?.description,
            kind: Kind.STRING,
            value: fieldConfig.astNode?.description
              ? fieldConfig.astNode?.description.value.concat(`\n${commentToAdd}`)
              : commentToAdd,
          },
        };
      }

      fieldConfig.description = fieldConfig.description
        ? fieldConfig.description.concat(`\n${commentToAdd}`)
        : commentToAdd;

      return fieldConfig;
    });
  };

  return stitchSchemas({
    subschemas: [
      {
        schema: await schemaFromExecutor(clothingExec, adminContext),
        executor: clothingExec,
        merge: {
          Shirt: {
            fieldName: 'clothingById',
            args: originalObject => ({ id: originalObject.id })
          },
        },
        transforms: [documentSourceService({ serviceName: 'clothing-service' })],
      },
      {
        schema: await schemaFromExecutor(shirtExec, adminContext),
        merge: {
          Shirt: {
            fieldName: 'shirtById',
            selectionSet: '{ id }',
            args: originalObject => ({ id: originalObject.id })
          },
        },
        executor: shirtExec,
        transforms: [documentSourceService({ serviceName: 'shirt-service' })],
      },
    ],
    mergeTypes: true,
  });
}

export const gatewayApp = createYoga({
  schema: makeGatewaySchema(),
  context: ({ request }) => ({
    authHeader: request.headers.get('authorization'),
  }),
  maskedErrors: false,
});

const server = createServer(gatewayApp);
server.listen(4000, () => console.log('gateway running at http://localhost:4000/graphql'));
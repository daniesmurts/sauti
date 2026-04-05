import {AddressInfo} from 'node:net';
import {createServer, IncomingMessage, ServerResponse} from 'node:http';

import {matrixClient} from '../src/core/matrix/MatrixClient';

describe('Matrix client wrapper', () => {
  it('initializes the client and connects to the homeserver versions endpoint', async () => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/_matrix/client/versions') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({versions: ['v1.11']}));
        return;
      }

      res.writeHead(404, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Not found'}));
    });

    await new Promise<void>(resolve => {
      server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      await matrixClient.connectToHomeserver(baseUrl);

      const client = matrixClient.initialize({
        baseUrl,
        userId: '@alice:localhost',
        accessToken: 'test-token',
      });

      expect(client).toBeDefined();
      expect(matrixClient.getClient()).toBe(client);
    } finally {
      matrixClient.resetForTests();
      await new Promise<void>((resolve, reject) => {
        server.close(error => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});

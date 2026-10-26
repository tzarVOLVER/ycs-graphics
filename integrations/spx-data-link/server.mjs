import http from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLinkedValue } from '../../graphics/ticker/src/data-link.js';

export async function createDataService({ stateFile, origins = ['http://127.0.0.1:5657', 'http://localhost:5657'] }) {
  let state;
  try {
    state = JSON.parse(await readFile(stateFile, 'utf8'));
    readLinkedValue(state);
    if (!Number.isInteger(state.revision) || typeof state.updatedAt !== 'string') throw new Error('Invalid saved source');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = { revision: 1, updatedAt: new Date().toISOString(), values: { 'test.currentRound': 'SWISS ROUND 12 OF 15' } };
    await mkdir(dirname(stateFile), { recursive: true });
    await writeFile(stateFile, JSON.stringify(state, null, 2));
  }
  let writes = Promise.resolve();
  const server = http.createServer(async (request, response) => {
    const send = (code, value) => {
      response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(value));
    };
    // Loopback listener + Host and Origin checks protect this local mutation endpoint.
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(request.headers.host || '')) return send(403, { error: 'Invalid host' });
    const origin = request.headers.origin;
    if (origin && !origins.includes(origin)) return send(403, { error: 'Origin not allowed' });
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-YCS-Link');
      response.writeHead(204);
      return response.end();
    }
    if (request.method === 'GET' && request.url === '/snapshot') return send(200, state);
    if (request.method !== 'POST' || request.url !== '/test-value') return send(404, { error: 'Unknown endpoint' });
    if (request.headers['x-ycs-link'] !== '1' || !/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) {
      return send(415, { error: 'JSON and X-YCS-Link header required' });
    }
    try {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (Buffer.byteLength(body) > 4096) return send(413, { error: 'Request too large' });
      }
      const { value } = JSON.parse(body);
      readLinkedValue({ values: { 'test.currentRound': value } });
      const operation = writes.then(async () => {
        const next = { revision: state.revision + 1, updatedAt: new Date().toISOString(), values: { 'test.currentRound': value } };
        await writeFile(stateFile + '.tmp', JSON.stringify(next, null, 2));
        await rename(stateFile + '.tmp', stateFile);
        state = next;
        return state;
      });
      writes = operation.catch(() => {});
      return send(200, await operation);
    } catch (error) {
      return send(error instanceof SyntaxError || error instanceof TypeError ? 400 : 500, { error: 'Source update failed; last valid data retained' });
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const stateFile = resolve(process.argv[2] || '.local/spx-data-link/source.json');
  const server = await createDataService({ stateFile });
  server.listen(8787, '127.0.0.1', () => console.log('YCS data-link test service: http://127.0.0.1:8787'));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}

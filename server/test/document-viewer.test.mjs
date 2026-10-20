import test from 'node:test';
import assert from 'node:assert/strict';

const port = process.env.TEST_PORT || 8787;

test('serves an original wiki PDF through the safe document endpoint', async () => {
  const response = await fetch(`http://localhost:${port}/api/document?path=awards/Award%20best%20academic%20transcript.pdf`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/pdf/);
});

test('does not allow document paths outside the wiki', async () => {
  const response = await fetch(`http://localhost:${port}/api/document?path=../eunhye-secretary/server/index.mjs`);
  assert.equal(response.status, 404);
});

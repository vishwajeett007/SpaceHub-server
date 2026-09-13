import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import app from "../src/app.js";
import { connectRedis, disconnectRedis, isRedisReady, redis } from "../src/config/redis.js";

test("GET /health returns the service health response", async (t) => {
  if (process.env.REDIS_URL) {
    assert.equal(await connectRedis(), true);
    assert.equal(await redis.ping(), "PONG");
    t.after(disconnectRedis);
  }

  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.message, "SpaceHUB backend is healthy");
  assert.deepEqual(payload.dependencies.redis, {
    configured: Boolean(process.env.REDIS_URL),
    ready: isRedisReady(),
  });
  assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

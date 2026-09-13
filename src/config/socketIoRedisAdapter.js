import { createAdapter } from "@socket.io/redis-adapter";

import { env } from "./env.js";
import { isRedisReady, redis } from "./redis.js";

let pubClient;
let subClient;

const closeClient = async (client) => {
  if (client?.isOpen) await client.close();
};

export const configureSocketIoRedisAdapter = async (io) => {
  if (!isRedisReady()) return false;

  pubClient = redis.duplicate();
  subClient = redis.duplicate();

  for (const [name, client] of [["publisher", pubClient], ["subscriber", subClient]]) {
    client.on("error", (error) => {
      console.error(`Redis Socket.IO ${name} client error:`, error.message);
    });
  }

  try {
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("Socket.IO Redis adapter enabled");
    return true;
  } catch (error) {
    await Promise.allSettled([closeClient(pubClient), closeClient(subClient)]);
    pubClient = undefined;
    subClient = undefined;

    console.error("Failed to enable the Socket.IO Redis adapter:", error.message);
    if (env.REDIS_REQUIRED) throw error;
    return false;
  }
};

export const disconnectSocketIoRedisAdapter = async () => {
  await Promise.all([closeClient(pubClient), closeClient(subClient)]);
  pubClient = undefined;
  subClient = undefined;
};

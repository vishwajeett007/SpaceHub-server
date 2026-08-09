// Voice Room STOMP Protocol Handler for WebRTC signaling and multi-user audio sessions

const subscriptions = new Map(); // socket -> Map(subId -> destination)
const voiceRoomUsers = new Map(); // roomId -> Map(userId -> { socket, subIdAnswer, subIdEvents })

export function parseStompFrame(rawText) {
  const text = rawText.toString().replace(/\0$/, '');
  const lines = text.split('\n');
  const command = lines[0].trim();
  const headers = {};
  let bodyIndex = lines.length;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      bodyIndex = i + 1;
      break;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      headers[key] = val;
    }
  }

  const body = lines.slice(bodyIndex).join('\n');
  return { command, headers, body };
}

export function formatStompFrame(command, headers = {}, body = '') {
  let frame = `${command}\n`;
  for (const [k, v] of Object.entries(headers)) {
    frame += `${k}:${v}\n`;
  }
  frame += `\n${body}\0`;
  return frame;
}

export function handleVoiceStompMessage(ws, rawMessage) {
  try {
    const text = rawMessage.toString();
    if (text === '\n' || text === '\r\n') return; // Stomp heartbeats

    const frame = parseStompFrame(text);

    if (frame.command === 'CONNECT' || frame.command === 'STOMP') {
      const connectedFrame = formatStompFrame('CONNECTED', {
        version: '1.2',
        'heart-beat': '4000,4000',
      });
      ws.send(connectedFrame);
      return true;
    }

    if (frame.command === 'SUBSCRIBE') {
      const id = frame.headers['id'];
      const destination = frame.headers['destination'];
      if (!subscriptions.has(ws)) {
        subscriptions.set(ws, new Map());
      }
      subscriptions.get(ws).set(id, destination);
      ws.send(formatStompFrame('RECEIPT', { 'receipt-id': frame.headers['receipt'] || id }));
      return true;
    }

    if (frame.command === 'UNSUBSCRIBE') {
      const id = frame.headers['id'];
      if (subscriptions.has(ws)) {
        subscriptions.get(ws).delete(id);
      }
      return true;
    }

    if (frame.command === 'SEND') {
      const destination = frame.headers['destination'];
      let payload = {};
      try {
        payload = JSON.parse(frame.body || '{}');
      } catch (e) {
        // Body is not JSON
      }

      if (destination === '/app/register') {
        const { userId, roomId, sessionId, handleId } = payload;
        ws.voiceUser = { userId, roomId, sessionId, handleId };

        if (!voiceRoomUsers.has(roomId)) {
          voiceRoomUsers.set(roomId, new Map());
        }
        const roomMap = voiceRoomUsers.get(roomId);

        // Notify other participants in this voice room that a new user joined
        roomMap.forEach((userSession, existingUserId) => {
          if (userSession.ws !== ws && userSession.ws.readyState === 1) {
            sendStompMessage(userSession.ws, `/topic/room/${roomId}/events`, {
              type: 'joined',
              userId: userId,
            });
          }
        });

        // Add current user to room
        roomMap.set(userId, { ws, userId, roomId });

        // Send joined confirmation for existing participants to the joining user
        roomMap.forEach((userSession, existingUserId) => {
          if (existingUserId !== userId && ws.readyState === 1) {
            sendStompMessage(ws, `/topic/room/${roomId}/events`, {
              type: 'joined',
              userId: existingUserId,
            });
          }
        });

        return true;
      }

      if (destination === '/app/offer') {
        const { userId, roomId, sdp } = payload;
        const roomMap = voiceRoomUsers.get(roomId);

        // Relay WebRTC offer to other participants or return synthesized answer if solo
        let relayed = false;
        if (roomMap) {
          roomMap.forEach((userSession, otherUserId) => {
            if (otherUserId !== userId && userSession.ws.readyState === 1) {
              sendStompMessage(userSession.ws, `/topic/room/${roomId}/answer/${otherUserId}`, {
                jsep: { type: 'offer', sdp },
                senderId: userId,
              });
              relayed = true;
            }
          });
        }

        // Return SDP answer to complete peer connection setup
        const sdpAnswer = (sdp || '')
          .replace(/a=sendrecv/g, 'a=recvonly')
          .replace(/a=setup:actpass/g, 'a=setup:active');

        sendStompMessage(ws, `/topic/room/${roomId}/answer/${userId}`, {
          jsep: {
            type: 'answer',
            sdp: sdpAnswer || 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendonly\r\n',
          },
        });
        return true;
      }

      if (destination === '/app/ice') {
        const { userId, roomId, candidate } = payload;
        const roomMap = voiceRoomUsers.get(roomId);

        if (roomMap) {
          roomMap.forEach((userSession, otherUserId) => {
            if (otherUserId !== userId && userSession.ws.readyState === 1) {
              sendStompMessage(userSession.ws, `/topic/room/${roomId}/answer/${otherUserId}`, {
                candidate,
                senderId: userId,
              });
            }
          });
        }
        return true;
      }
    }

    if (frame.command === 'DISCONNECT') {
      handleVoiceStompDisconnect(ws);
      return true;
    }
  } catch (err) {
    console.error('Error handling STOMP frame:', err);
  }
  return false;
}

export function handleVoiceStompDisconnect(ws) {
  if (ws.voiceUser) {
    const { userId, roomId } = ws.voiceUser;
    if (roomId && voiceRoomUsers.has(roomId)) {
      const roomMap = voiceRoomUsers.get(roomId);
      roomMap.delete(userId);

      // Notify remaining room participants
      roomMap.forEach((userSession) => {
        if (userSession.ws.readyState === 1) {
          sendStompMessage(userSession.ws, `/topic/room/${roomId}/events`, {
            type: 'left',
            userId: userId,
          });
        }
      });

      if (roomMap.size === 0) {
        voiceRoomUsers.delete(roomId);
      }
    }
  }
  subscriptions.delete(ws);
}

function sendStompMessage(ws, destination, bodyObject) {
  if (!ws || ws.readyState !== 1) return;
  const userSubs = subscriptions.get(ws);
  let subId = null;

  if (userSubs) {
    for (const [id, dest] of userSubs.entries()) {
      if (dest === destination) {
        subId = id;
        break;
      }
    }
  }

  const messageFrame = formatStompFrame(
    'MESSAGE',
    {
      destination,
      subscription: subId || 'sub-0',
      'message-id': `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      'content-type': 'application/json',
    },
    JSON.stringify(bodyObject)
  );

  ws.send(messageFrame);
}

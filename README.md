# SpaceHUB Backend

The backend service for SpaceHUB, a community and real-time communication platform. It provides REST APIs for authentication, profiles, communities, friendships, messaging, file uploads, and voice rooms, along with Socket.IO and native WebSocket support for chat, notifications, and WebRTC signaling.

## Tech stack

- Node.js and Express 5
- PostgreSQL with Prisma ORM
- Socket.IO and `ws`
- JSON Web Tokens and HTTP-only cookies
- Zod request validation
- Cloudinary file uploads
- Nodemailer email delivery

## Requirements

- Node.js `^20.19`, `^22.12`, or `>=24`
- npm
- PostgreSQL
- A Gmail account with an app password for registration and password-reset emails
- A Cloudinary account if file and image uploads are required

## Getting started

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```dotenv
   DATABASE_URL="postgresql://postgres:password@localhost:5432/spacehub"
   PORT=5000
   NODE_ENV=development

   JWT_SECRET="replace-with-a-long-random-secret"
   JWT_EXPIRES_IN=7d
   CLIENT_URL="http://localhost:5173"

   EMAIL_USER="your-email@gmail.com"
   EMAIL_APP_PASSWORD="your-google-app-password"

   CLOUDINARY_CLOUD_NAME="your-cloud-name"
   CLOUDINARY_API_KEY="your-api-key"
   CLOUDINARY_API_SECRET="your-api-secret"
   ```

3. Generate the Prisma client and apply the database migrations:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

The API is available at `http://localhost:5000/api/v1`. Check that the service is running with:

```bash
curl http://localhost:5000/health
```

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string used by Prisma and the application. |
| `PORT` | No | `5000` | HTTP and WebSocket server port. |
| `NODE_ENV` | No | `development` | Runtime environment. Use `production` in production. |
| `JWT_SECRET` | In production | Development fallback | Secret used to sign access and temporary tokens. |
| `JWT_EXPIRES_IN` | No | `7d` | Access-token lifetime. |
| `CLIENT_URL` | No | `http://localhost:5173` | Frontend origin used by Socket.IO and generated invite links. |
| `EMAIL_USER` | For email flows | — | Gmail address used by Nodemailer. |
| `EMAIL_APP_PASSWORD` | For email flows | — | Gmail app password. |
| `CLOUDINARY_CLOUD_NAME` | For uploads | — | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | For uploads | — | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | For uploads | — | Cloudinary API secret. |

Never commit `.env` or production credentials. The JWT fallback is intended only for local development.

## npm scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the server with Nodemon and restart when source files change. |
| `npm start` | Run the server with Node.js. |
| `npm run build` | Install dependencies and generate the Prisma client. |

There is currently no automated test suite configured.

## API overview

All REST endpoints use the `/api/v1` prefix unless shown otherwise. Protected endpoints accept a JWT in either an HTTP-only `token` cookie or an `Authorization: Bearer <token>` header. Users must also have a verified email address.

### Health

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service health check; this route is outside `/api/v1`. |

### Authentication

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Start registration and send a verification OTP. |
| `POST` | `/auth/validate-register-otp` | Verify the registration OTP. |
| `POST` | `/auth/resend-otp` | Resend the registration OTP. |
| `POST` | `/auth/login` | Log in with an email or username and password. |
| `GET` | `/auth/me` | Return the authenticated user. |
| `POST` | `/auth/logout` | Clear the authentication cookie. |
| `POST` | `/auth/forgot-password` | Start the password-reset flow. |
| `POST` | `/auth/validate-forgot-otp` | Verify a password-reset OTP. |
| `POST` | `/auth/resend-forgot-otp` | Resend a password-reset OTP. |
| `POST` | `/auth/reset-password` | Set a new password with a reset token. |

### Users and uploads

These endpoints are protected.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/users/profile` | Get the current user's profile. |
| `PATCH` | `/users/profile` | Update the current user's profile. |
| `POST` | `/users/set-username` | Set or change the username. |
| `POST` | `/users/avatar` | Upload an avatar as multipart field `file`. |
| `POST` | `/users/cover` | Upload a cover image as multipart field `file`. |
| `POST` | `/users/upload-and-get-url` | Upload a file and return its URL. |
| `DELETE` | `/users/delete` | Delete the current account. |

Uploads use in-memory buffers and are limited to 10 MB per file. Cloudinary credentials must be configured for persistent uploads.

### Communities

Public discovery endpoints are `GET /communities`, `GET /communities/discover`, and `GET /communities/search`. Community creation, membership, rooms, roles, invitations, and settings require authentication.

Common protected endpoints include:

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/communities` | Create a community. |
| `GET` | `/communities/my-communities` | List communities for the current user. |
| `GET` | `/communities/:slug` | Get a community by slug or identifier. |
| `POST` | `/communities/:id/join` | Join or request access to a community. |
| `POST` | `/communities/leave` | Leave a community. |
| `GET` | `/communities/:communityId/members` | List community members. |
| `POST` | `/communities/changeRole` | Change a member's role. |
| `POST` | `/communities/removeMember` | Remove a member. |
| `POST` | `/communities/:communityId/upload-banner` | Update community details and images. |
| `POST` | `/communities/invites/:communityId/create` | Create an invitation link. |
| `POST` | `/communities/invites/accept` | Accept an invitation. |
| `GET` | `/communities/:communityId/rooms/all` | List rooms within a community. |
| `POST` | `/communities/:communityId/rooms/create` | Create a room. |
| `PUT` | `/communities/:communityId/rooms/:roomId/rename` | Rename a room. |
| `DELETE` | `/communities/:communityId/rooms/:roomId` | Delete a room. |

### Chat and social

These endpoints are protected.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/chat/channel/:channelId` | Get channel messages. |
| `GET` | `/chat/dm/:userId` | Get direct messages with a user. |
| `POST` | `/chat/message` | Save a channel or direct message. |
| `GET` | `/social/search` | Search for users. |
| `POST` | `/social/friends/request` | Send a friend request. |
| `POST` | `/social/friends/respond` | Accept or reject a friend request. |
| `GET` | `/social/friends/list` | List friends. |
| `GET` | `/social/friends/pending` | List pending notifications. |
| `POST` | `/social/friends/remove` | Remove a friend. |
| `POST` | `/social/friends/message/send` | Send a direct message. |
| `GET` | `/social/friends/messages` | Get direct-message history. |

### Voice and WebRTC

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/webrtc/join` | Create or join a voice session. |
| `GET` | `/webrtc/room/:roomId/participants` | List active voice-room participants. |
| `GET` | `/voice-room/list/:roomId` | List voice channels for a room. |
| `POST` | `/voice-room/create` | Create a voice channel. |
| `POST` | `/voice-room/join` | Join a voice channel. |

The router also keeps several legacy aliases for compatibility with the frontend. New integrations should prefer the grouped routes above.

## Real-time connections

Connect Socket.IO clients to the same origin as the REST API. Supported chat events are:

- Client events: `join_room`, `leave_room`, and `send_message`
- Server events: `receive_message` and `error`

WebRTC signaling uses:

- Client events: `webrtc_join_room`, `webrtc_leave_room`, `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`, `webrtc_mute_status`, and `webrtc_video_status`
- Server events: `webrtc_existing_users`, `webrtc_user_joined`, `webrtc_user_left`, `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`, `webrtc_peer_mute_changed`, and `webrtc_peer_video_changed`

Native WebSocket clients can connect to chat paths such as:

```text
ws://localhost:5000/ws?senderEmail=user@example.com&receiverEmail=friend@example.com
ws://localhost:5000/chat?senderEmail=user@example.com&roomCode=ROOM-123
ws://localhost:5000/notification?email=user@example.com
```

Use `wss://` when the API is served over HTTPS.

## Response format

Successful REST responses follow this shape:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "timestamp": "2026-08-15T00:00:00.000Z"
}
```

Errors use the same metadata with `success: false` and may include an `errors` array. Stack traces are returned only in development.

## Project structure

```text
.
├── prisma/
│   ├── migrations/       # PostgreSQL migrations
│   └── schema.prisma     # Database models and enums
├── src/
│   ├── config/           # Environment, Prisma, Cloudinary, and mail setup
│   ├── modules/          # Auth, users, communities, chat, social, and WebRTC
│   ├── shared/           # Middleware, errors, constants, and utilities
│   ├── app.js            # Express application and middleware
│   ├── routes.js         # REST route registration and compatibility aliases
│   └── server.js         # HTTP, Socket.IO, WebSocket, and shutdown lifecycle
├── package.json
└── prisma.config.ts
```

## Production

Apply committed migrations before starting the service:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
NODE_ENV=production npm start
```

Terminate the process with `SIGTERM` or `SIGINT` to allow the HTTP server and database pool to shut down gracefully.

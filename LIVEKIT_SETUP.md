# LiveKit Video Session Setup

## Environment Variables

Add these to your `.env.local` file:

```env
# LiveKit Configuration
LIVEKIT_URL=wss://jak-fcjstami.livekit.cloud
LIVEKIT_API_KEY=APIQqD4ceSaifU7
LIVEKIT_API_SECRET=qennh6mdv1s7oO6fFtMfz6d5UUlKsVxnL9qTn7Y2iaiB

# Public LiveKit URL (for client-side connection)
NEXT_PUBLIC_LIVEKIT_URL=wss://jak-fcjstami.livekit.cloud
```

**Note**: `NEXT_PUBLIC_LIVEKIT_URL` is required for client-side LiveKit connections. The server-side variables (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) are used for server-side operations like creating rooms and generating tokens.

## How It Works

1. **Session Creation**: When a coach creates a new session, a LiveKit room is automatically created with the name `session-{sessionId}`. The room name is stored in DynamoDB as `livekit_room_name`.

2. **Token Generation**: When a user joins a session, the client requests a LiveKit access token from `/api/livekit/token`. The token is generated server-side using the LiveKit API credentials.

3. **Video Session**: The video session page (`/session/[id]`) loads the session data, retrieves the LiveKit room name, and connects to the room using the LiveKit React components.

## Features

- **Automatic Room Creation**: Rooms are created when sessions are scheduled
- **Secure Token Generation**: Tokens are generated server-side with proper permissions
- **Real-time Video/Audio**: Full LiveKit integration with video, audio, and screen sharing
- **Participant Management**: See all participants and add notes
- **Session Duration Timer**: Tracks how long the session has been active
- **Connection Status**: Shows connection status indicator

## DynamoDB Schema Update

The `jak-coach-sessions-schedule` table now includes:
- `livekit_room_name` (String, optional) - The LiveKit room name for the session

## API Routes

- `POST /api/livekit/token` - Generate LiveKit access token for a user
- `POST /api/livekit/create-room` - Create a new LiveKit room (used internally)
- `GET /api/sessions/[id]` - Get session details including LiveKit room name

## Usage

1. Schedule a session through the calendar
2. A LiveKit room is automatically created
3. Click "Join Session" from the session details panel
4. The video session page loads and connects to the LiveKit room
5. Participants can join using the session link


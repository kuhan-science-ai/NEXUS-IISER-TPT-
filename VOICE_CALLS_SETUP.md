# Voice and video calls

## Current integration

The browser uses `livekit-client` to join LiveKit rooms. The Cloudflare Worker checks NEXUS membership, creates short-lived room-scoped participant JWTs, and never returns the LiveKit API secret. One-to-one calls use a distinct room per invitation; each group voice channel reuses its channel-specific room. Voice-channel chat persists in `voice_channel_messages`, separate from normal text-channel history.

The global call surface remains mounted while navigating NEXUS. Minimize only hides that surface; it does not disconnect tracks. Leave disconnects the current participant. “End call for everyone” is exposed only to the caller or group owner and is checked again by the Worker.

## Configure LiveKit Cloud

1. Create a LiveKit Cloud project and copy its WebSocket URL (`wss://…`), API key, and API secret.
2. Set the non-secret URL as the Worker variable `LIVEKIT_URL` in the Cloudflare dashboard (or Wrangler vars).
3. From `nexus-backend/`, add the API credentials as Cloudflare Worker secrets:

   ```powershell
   npx wrangler secret put LIVEKIT_API_KEY
   npx wrangler secret put LIVEKIT_API_SECRET
   ```

   Paste each value only into the Wrangler prompt. Do not add credentials to source control, `.env` files, or frontend variables.
4. Deploy the Worker and apply the database migration:

   ```powershell
   npx wrangler d1 migrations apply nexus-database --remote
   npx wrangler deploy
   ```

The room JWT is scoped to one room, allows publish/subscribe/data, and expires after six hours. A participant already connected stays on the LiveKit session; reconnection behavior should be verified against the selected LiveKit project and its token/session policy.

## Current feature limits

- Microphone, camera, screen sharing, room connection/reconnection state, participant tiles, per-channel persistent chat, one-to-one call invites, accept/reject, minimize/reopen, and owner/caller call termination are wired.
- LiveKit Cloud credentials are not present yet, so end-to-end media and real device permissions have not been verified.
- Moderator-controlled remote mute, persistent/offline call invitations, and voice-chat pagination are not implemented yet. Voice-chat messages support replies and editing/deleting your own messages.
- Group video is enabled by turning on the camera after joining a group voice channel. There is no separate video-channel type.

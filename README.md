# youtubemusic-api-

A modern YouTube Music explorer and player with audio streaming, trending tracks, playlists, synced lyrics, and Vercel serverless deployment support.

## Features
- **Live Home Recommendations**: Themed rooms and playlist sections (Trending, Bollywood Fresh, Punjabi Wave, Lo-Fi, etc.).
- **Search & Discovery**: Search songs, artists, and playlists with instant playback.
- **Synced & Plain Lyrics**: Real-time lyrics lookup via LRCLIB.
- **Embedded Player**: YouTube Iframe player integration with queue management.
- **Vercel Ready**: Full serverless deployment setup with static client and `/api` serverless functions.

## Run Locally
```bash
pnpm install
pnpm dev
```
- App: http://localhost:5173
- API: http://localhost:5000/api

## Deploy on Vercel
Connect this GitHub repository to Vercel. `vercel.json` is preconfigured for automatic builds and serverless routing.

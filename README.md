# ♪ TuneGuess

A Songless/Heardle-inspired music guessing game that runs entirely in your browser with no backend required.

- **6 guesses** — each wrong guess reveals a longer clip: `0.1s → 1s → 2s → 4s → 8s → 15s`
- **Color-coded feedback** — 🟩 correct song, 🟨 right artist wrong song, 🟥 wrong
- **Two modes** — Built-in playlist (no setup) or any Spotify playlist you choose
- **Smart autocomplete** — type to search, pick from the dropdown

---

## Quick Start (Built-in Playlist)

The built-in playlist works with **zero configuration**. You just need Python installed.

```bash
python server.py
# or: python3 server.py
```

Your browser will open automatically at `http://localhost:8080`.

> ⚠️ **Why a server?** The YouTube player won't work when opening `index.html` directly as a `file://` URL. A local HTTP server fixes this — Python's built-in one is all you need.

---

## Custom Playlist Setup

To play with your own Spotify playlist you need two free API keys.

### 1. Spotify API (Client ID + Secret)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Log in and click **Create app**
3. Fill in any name/description; set Redirect URI to `http://localhost:8080` (required by Spotify even though we don't use it)
4. Copy your **Client ID** and **Client Secret**

### 2. YouTube Data API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Navigate to **APIs & Services → Library**
4. Search for **YouTube Data API v3** and enable it
5. Go to **APIs & Services → Credentials → Create Credentials → API Key**
6. Copy the key (optionally restrict it to YouTube Data API v3)

### Entering your keys

1. Launch the game (`python server.py`)
2. Click the **⚙** settings icon in the top-right
3. Paste your Spotify Client ID, Client Secret, and YouTube API Key
4. Click **Save Settings** (stored locally in your browser, never sent anywhere)

### Loading a playlist

1. Switch to the **Custom Playlist** tab
2. Paste any Spotify playlist URL, e.g.:
   ```
   https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF
   ```
3. Click **Load** — the game will start automatically

---

## Customising the Built-in Playlist

Edit `js/songs.js` to add, remove, or change songs.

```js
{ id: 26, title: "My Song", artist: "The Artist", youtubeId: "dQw4w9WgXcQ" },
```

To find a YouTube ID: go to the video on YouTube, the ID is the part after `?v=` in the URL.

---

## Project Structure

```
tuneguess/
├── index.html        Main page
├── style.css         All styles
├── js/
│   ├── songs.js      Built-in playlist data
│   ├── spotify.js    Spotify API helpers
│   ├── youtube.js    YouTube IFrame Player wrapper
│   └── app.js        Game logic & UI
├── server.py         Local HTTP server (Python 3)
└── README.md         This file
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| "Could not load audio" | The YouTube video may be unavailable in your region. Click New Game to try another song. |
| Spotify auth fails | Double-check your Client ID and Secret. Make sure you copied the Secret (not the Client ID twice). |
| Custom playlist is empty | The playlist may be private. Make sure it's set to Public in Spotify. |
| YouTube search returns wrong song | This can happen with less popular tracks. The YouTube API searches for `song title + artist + official audio`. |
| Browser blocks autoplay | Click the play button manually — browsers require a user gesture before audio can play. |

---

## Notes

- API keys are saved in your browser's `localStorage` — they never leave your machine.
- Spotify's Client Credentials flow is used (no user login). Only public playlists are accessible.
- YouTube thumbnails are used as album art for the built-in playlist (no API key needed).
- The YouTube IFrame player is hidden (1×1 px) during gameplay — audio only.

---

## License

MIT — do whatever you like with it.

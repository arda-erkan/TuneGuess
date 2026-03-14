/**
 * spotify.js — Spotify Web API utilities (Client Credentials flow)
 *
 * No user login required. Uses Client ID + Client Secret to fetch
 * a token, then pulls playlist tracks and powers the autocomplete search.
 */

/**
 * Fetches a Spotify access token using Client Credentials.
 * @param {string} clientId
 * @param {string} clientSecret
 * @returns {Promise<string>} access token
 */
async function getSpotifyToken(clientId, clientSecret) {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret),
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error_description || `Spotify auth failed (${response.status})`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Fetches all tracks from a Spotify playlist (handles pagination).
 * @param {string} token
 * @param {string} playlistId
 * @returns {Promise<Array<{id, title, artist, albumArt}>>}
 */
async function fetchPlaylistTracks(token, playlistId) {
  const tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`
    + `?fields=items(track(id,name,artists,album(images))),next&limit=50`;

  while (url) {
    const res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Playlist fetch failed (${res.status})`);
    }

    const data = await res.json();

    for (const item of (data.items || [])) {
      const t = item?.track;
      if (!t || !t.name) continue;
      tracks.push({
        id:       t.id,
        title:    t.name,
        artist:   t.artists?.[0]?.name || 'Unknown',
        albumArt: t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '',
      });
    }

    url = data.next || null;
  }

  return tracks;
}

/**
 * Searches Spotify for tracks matching a query (for autocomplete).
 * @param {string} token
 * @param {string} query
 * @returns {Promise<Array<{id, title, artist, albumArt}>>}
 */
async function searchSpotifyTracks(token, query) {
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`,
    { headers: { 'Authorization': 'Bearer ' + token } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.tracks?.items || []).map(t => ({
    id:       t.id,
    title:    t.name,
    artist:   t.artists?.[0]?.name || 'Unknown',
    albumArt: t.album?.images?.[2]?.url || '',
  }));
}

/**
 * Extracts a Spotify playlist ID from a URL or raw ID string.
 * @param {string} input - e.g. "https://open.spotify.com/playlist/37i9dQZEV..." or just the ID
 * @returns {string|null}
 */
function extractPlaylistId(input) {
  input = input.trim();
  // Full URL: https://open.spotify.com/playlist/ID?...
  const urlMatch = input.match(/playlist\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  // Raw alphanumeric ID
  if (/^[A-Za-z0-9]+$/.test(input)) return input;
  return null;
}

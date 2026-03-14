/**
 * youtube.js — YouTube IFrame Player wrapper
 *
 * Exposes a clean API for loading videos and playing time-limited clips.
 * The global `onYouTubeIframeAPIReady` function is called automatically
 * by the YouTube IFrame API script after it loads.
 */

let _player        = null;
let _ready         = false;
let _readyCbs      = [];

let _clipTimer     = null;
let _progressTimer = null;
let _pendingLoad   = null;   // { resolve, reject } for ytLoadVideo promise
let _clipPending   = false;  // waiting for PLAYING state to start clip timer
let _clipDuration  = 0;
let _clipOnProg    = null;
let _clipOnEnd     = null;

// ── Called automatically by YouTube API ──────────────────────────────────────
function onYouTubeIframeAPIReady() {
  _player = new YT.Player('ytPlayer', {
    height: '1',
    width:  '1',
    videoId: '',
    playerVars: {
      autoplay:        0,
      controls:        0,
      disablekb:       1,
      fs:              0,
      modestbranding:  1,
      rel:             0,
      iv_load_policy:  3,
      enablejsapi:     1,
      origin:          location.origin || location.href.split('/').slice(0,3).join('/'),
    },
    events: {
      onReady:       _onReady,
      onStateChange: _onStateChange,
      onError:       _onError,
    },
  });
}

function _onReady() {
  _ready = true;
  _readyCbs.forEach(cb => cb());
  _readyCbs = [];
}

function _onStateChange(event) {
  // Video cued → resolve loadVideo promise
  if (event.data === YT.PlayerState.CUED && _pendingLoad) {
    const { resolve } = _pendingLoad;
    _pendingLoad = null;
    resolve();
    return;
  }

  // Playback started → begin clip timer (reliable start point)
  if (event.data === YT.PlayerState.PLAYING && _clipPending) {
    _clipPending = false;
    _startClipTimer(_clipDuration, _clipOnProg, _clipOnEnd);
    return;
  }
}

function _onError(event) {
  console.warn('[YT] Player error code:', event.data);
  // Error codes: 2=invalid ID, 5=HTML5 error, 100=not found, 101/150=embed not allowed
  if (_pendingLoad) {
    const { reject } = _pendingLoad;
    _pendingLoad = null;
    reject(new Error(`YouTube player error (code ${event.data})`));
  }
  _clipPending = false;
  if (_clipOnEnd) _clipOnEnd();
}

function _startClipTimer(durationSec, onProgress, onEnd) {
  const startMs   = Date.now();
  const durationMs = durationSec * 1000;

  // Progress polling
  _progressTimer = setInterval(() => {
    const elapsed  = Date.now() - startMs;
    const progress = Math.min(elapsed / durationMs, 1);
    if (onProgress) onProgress(progress);
  }, 50);

  // Hard stop after duration
  _clipTimer = setTimeout(() => {
    _stopTimers();
    if (_player) _player.pauseVideo();
    if (onProgress) onProgress(1);
    if (onEnd) onEnd();
  }, durationMs);
}

function _stopTimers() {
  clearTimeout(_clipTimer);
  clearInterval(_progressTimer);
  _clipTimer = null;
  _progressTimer = null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Register a callback for when the player is ready. */
function ytOnReady(cb) {
  if (_ready) cb();
  else _readyCbs.push(cb);
}

/** Returns true if the player has initialised. */
function ytIsReady() { return _ready; }

/**
 * Load a video by ID (cues it without playing).
 * Resolves when the video is cued and ready to play.
 */
function ytLoadVideo(videoId) {
  return new Promise((resolve, reject) => {
    if (!_ready || !_player) {
      reject(new Error('YouTube player not initialised yet'));
      return;
    }

    _stopTimers();
    _clipPending = false;
    _pendingLoad = { resolve, reject };

    _player.cueVideoById({ videoId, startSeconds: 0 });

    // Fallback: if CUED event never fires, resolve anyway after 4s
    setTimeout(() => {
      if (_pendingLoad) {
        _pendingLoad = null;
        resolve();
      }
    }, 4000);
  });
}

/**
 * Play a time-limited clip starting from the beginning of the video.
 * @param {number}   durationSec  How many seconds to play.
 * @param {Function} onProgress   Called with 0→1 as clip plays.
 * @param {Function} onEnd        Called when clip finishes.
 */
function ytPlayClip(durationSec, onProgress, onEnd) {
  if (!_player) return;

  _stopTimers();
  _clipDuration = durationSec;
  _clipOnProg   = onProgress;
  _clipOnEnd    = onEnd;
  _clipPending  = true;  // timer starts when PLAYING fires

  _player.seekTo(0, true);
  _player.playVideo();
}

/** Stop playback and cancel any running clip. */
function ytStop() {
  _stopTimers();
  _clipPending = false;
  if (_player) _player.pauseVideo();
}

/** Direct access to the player (e.g. to call playVideo() for full playback). */
function ytGetPlayer() { return _player; }

/**
 * Search YouTube Data API v3 for a music video.
 * Returns the videoId of the best result.
 * @param {string} query    e.g. "Shape of You Ed Sheeran official audio"
 * @param {string} apiKey
 * @returns {Promise<string>} videoId
 */
async function ytSearchVideo(query, apiKey) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoCategoryId', '10'); // Music
  url.searchParams.set('maxResults', '3');
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `YouTube search failed (${res.status})`);
  }
  const data = await res.json();
  const items = data.items || [];
  if (items.length === 0) throw new Error(`No YouTube results found for: ${query}`);
  return items[0].id.videoId;
}

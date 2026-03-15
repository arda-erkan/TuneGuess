/**
 * app.js — TuneGuess main game logic
 *
 * Manages game state, UI rendering, autocomplete, guess evaluation,
 * and all user interactions.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const CLIP_DURATIONS = [0.1, 1, 2, 4, 8, 15]; // seconds per guess attempt

// ── Game State ────────────────────────────────────────────────────────────────

const state = {
  mode:               'builtin',   // 'builtin' | 'custom'
  songs:              [],          // current playlist
  currentSong:        null,        // { id, title, artist, youtubeId, albumArt }
  guesses:            [],          // array of guess objects
  guessIndex:         0,           // 0–5
  status:             'idle',      // 'idle' | 'loading' | 'playing' | 'won' | 'lost'
  selectedSong:       null,        // song chosen from autocomplete
  spotifyToken:       null,
  spotifyTokenExpiry: 0,
  videoReady:         false,
  isPlaying:          false,
};

// ── Settings helpers ──────────────────────────────────────────────────────────

function getSettings() {
  return {
    spotifyClientId:     localStorage.getItem('tg_spotifyClientId')     || '',
    spotifyClientSecret: localStorage.getItem('tg_spotifyClientSecret') || '',
    youtubeApiKey:       localStorage.getItem('tg_youtubeApiKey')       || '',
  };
}
function saveSettingsToStorage(s) {
  localStorage.setItem('tg_spotifyClientId',     s.spotifyClientId);
  localStorage.setItem('tg_spotifyClientSecret', s.spotifyClientSecret);
  localStorage.setItem('tg_youtubeApiKey',       s.youtubeApiKey);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  try {
    initEventListeners();
  } catch (e) {
    console.error('[TG] initEventListeners failed:', e);
  }
  populateSettingsModal();
  renderGuessSlots();
  buildProgressSegments();

  // Start the game immediately — don't block on YouTube being ready.
  // The YouTube player is loaded lazily the first time the user clicks Play.
  state.songs = [...BUILTIN_SONGS];
  startNewGame();
});

// ── Event Listeners ───────────────────────────────────────────────────────────

function initEventListeners() {
  // Tabs
  document.querySelectorAll('.tab').forEach(t =>
    t.addEventListener('click', () => switchMode(t.dataset.mode))
  );

  // Play
  document.getElementById('playBtn').addEventListener('click', handlePlay);

  // Skip / Submit
  document.getElementById('skipBtn').addEventListener('click', handleSkip);
  document.getElementById('submitBtn').addEventListener('click', handleSubmit);

  // New game buttons
  document.getElementById('newGameBtn').addEventListener('click', startNewGame);
  document.getElementById('endNewGameBtn').addEventListener('click', () => {
    closeModal('gameEndModal');
    startNewGame();
  });

  // Settings modal
  document.getElementById('settingsBtn').addEventListener('click', () => openModal('settingsModal'));
  document.getElementById('closeSettings').addEventListener('click', () => closeModal('settingsModal'));
  document.getElementById('saveSettings').addEventListener('click', handleSaveSettings);

  // Custom playlist
  document.getElementById('loadPlaylistBtn').addEventListener('click', handleLoadPlaylist);
  document.getElementById('playlistInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLoadPlaylist();
  });

  // Autocomplete input
  const input = document.getElementById('guessInput');
  input.addEventListener('input', handleInputChange);
  input.addEventListener('keydown', handleInputKeydown);

  // Close autocomplete on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.input-wrapper')) closeAutocomplete();
  });

  // Play full from end modal
  document.getElementById('playFullBtn').addEventListener('click', handlePlayFull);
}

// ── Mode Switching ────────────────────────────────────────────────────────────

function switchMode(mode) {
  if (mode === state.mode) return;
  state.mode = mode;

  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode)
  );

  const bar = document.getElementById('customPlaylistBar');
  bar.style.display = mode === 'custom' ? 'flex' : 'none';

  if (mode === 'builtin') {
    state.songs = [...BUILTIN_SONGS];
    startNewGame();
  } else {
    state.songs = [];
    resetToIdle();
    showToast('Paste a Spotify playlist URL and press Load');
  }
}

function resetToIdle() {
  ytStop();
  state.status      = 'idle';
  state.currentSong = null;
  state.guesses     = [];
  state.guessIndex  = 0;
  state.videoReady  = false;
  state.isPlaying   = false;
  renderGuessSlots();
  resetSongCard();
  setPlayBtn(false);
  document.getElementById('playBtn').disabled = true;
  document.getElementById('clipDurationLabel').textContent = '0.1s';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('inputArea').style.display = 'flex';
  document.getElementById('newGameBtn').style.display = 'none';
  document.getElementById('guessInput').value = '';
  document.getElementById('guessInput').disabled = false;
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('skipBtn').disabled = false;
  closeAutocomplete();
}

// ── Game Flow ─────────────────────────────────────────────────────────────────

function startNewGame() {
  if (state.songs.length === 0) {
    showToast('No songs loaded');
    return;
  }
  resetToIdle();

  // Pick a random song and go straight to playing state.
  // The YouTube video is loaded lazily on the first Play press.
  state.currentSong = state.songs[Math.floor(Math.random() * state.songs.length)];
  state.status      = 'playing';

  document.getElementById('playBtn').disabled = false;
  updateClipLabel();
  showToast('▶ Press play to hear a clip!');
}

async function loadSongVideo(song) {
  let videoId = song.youtubeId;

  // Custom playlist songs need YouTube search
  if (!videoId) {
    const { youtubeApiKey } = getSettings();
    if (!youtubeApiKey) throw new Error('YouTube API key not set in Settings');
    videoId = await ytSearchVideo(
      `${song.title} ${song.artist} official audio`,
      youtubeApiKey
    );
    song.youtubeId = videoId; // cache
  }

  return ytLoadVideo(videoId);
}

// ── Play Button ───────────────────────────────────────────────────────────────

async function handlePlay() {
  if (state.isPlaying || state.status !== 'playing') return;

  // Lazy-load: if the video hasn't been loaded yet, do it now on first press.
  if (!state.videoReady) {
    document.getElementById('playBtn').disabled = true;
    showLoading('Loading audio…');
    try {
      // Wait for the YouTube player to be ready first
      await new Promise((resolve) => {
        if (ytIsReady()) { resolve(); return; }
        ytOnReady(resolve);
        // Fallback if YouTube never fires
        setTimeout(resolve, 6000);
      });
      await loadSongVideo(state.currentSong);
      state.videoReady = true;
    } catch (err) {
      hideLoading();
      console.error('[TG] Video load failed:', err);
      showToast('Could not load audio — try a new game');
      document.getElementById('playBtn').disabled = false;
      document.getElementById('newGameBtn').style.display = 'block';
      state.status = 'idle';
      return;
    }
    hideLoading();
    document.getElementById('playBtn').disabled = false;
  }

  state.isPlaying = true;
  setPlayBtn(true);

  const duration = CLIP_DURATIONS[state.guessIndex];
  const maxDur   = CLIP_DURATIONS[CLIP_DURATIONS.length - 1];

  ytPlayClip(
    duration,
    (progress) => {
      const target  = duration / maxDur * 100;
      const current = target * progress;
      const fill    = document.getElementById('progressFill');
      fill.style.transition = 'none';
      fill.style.width      = current + '%';
    },
    () => {
      state.isPlaying = false;
      setPlayBtn(false);
      const fill = document.getElementById('progressFill');
      fill.style.transition = 'width 0.25s ease';
      fill.style.width = (duration / maxDur * 100) + '%';
    }
  );
}

function setPlayBtn(playing) {
  const btn  = document.getElementById('playBtn');
  const icon = document.getElementById('playIcon');
  btn.classList.toggle('is-pause', playing);
  icon.innerHTML = playing
    ? '<rect x="5"  y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/>'
    : '<polygon points="5,3 19,12 5,21"/>';
}

function updateClipLabel() {
  const d = CLIP_DURATIONS[Math.min(state.guessIndex, CLIP_DURATIONS.length - 1)];
  document.getElementById('clipDurationLabel').textContent = d < 1 ? `${d}s` : `${d}s`;
}

// ── Progress Segments ─────────────────────────────────────────────────────────

function buildProgressSegments() {
  const container = document.getElementById('progressSegments');
  const maxDur    = CLIP_DURATIONS[CLIP_DURATIONS.length - 1];
  container.innerHTML = '';
  // Show tick marks at each reveal duration
  CLIP_DURATIONS.slice(1).forEach(d => {
    const seg = document.createElement('div');
    seg.className = 'progress-seg';
    seg.style.position  = 'absolute';
    seg.style.left      = (d / maxDur * 100) + '%';
    seg.style.transform = 'translateX(-50%)';
    container.appendChild(seg);
  });
}

// ── Skip & Submit ─────────────────────────────────────────────────────────────

function handleSkip() {
  if (state.status !== 'playing') return;
  ytStop();
  state.isPlaying = false;
  setPlayBtn(false);
  submitGuess({ type: 'skip', song: null, result: 'skipped' });
}

function handleSubmit() {
  if (state.status !== 'playing' || !state.selectedSong) return;
  ytStop();
  state.isPlaying = false;
  setPlayBtn(false);
  const result = evaluateGuess(state.selectedSong);
  submitGuess({ type: 'guess', song: state.selectedSong, result });
}

function evaluateGuess(guessed) {
  const correct = state.currentSong;

  const norm = s => s.toLowerCase()
    .replace(/\(feat[^)]*\)/gi, '')
    .replace(/\(ft[^)]*\)/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const titleMatch  = norm(guessed.title)  === norm(correct.title);
  const artistMatch = norm(guessed.artist) === norm(correct.artist)
    || norm(correct.artist).includes(norm(guessed.artist))
    || norm(guessed.artist).includes(norm(correct.artist));

  if (titleMatch && artistMatch) return 'correct';
  if (titleMatch)                return 'correct';   // title alone = correct
  if (artistMatch)               return 'artist';
  return 'wrong';
}

function submitGuess(guess) {
  state.guesses.push(guess);
  renderGuessSlot(state.guessIndex, guess);

  if (guess.result === 'correct') {
    state.status = 'won';
    onGameEnd(true);
    return;
  }

  state.guessIndex++;

  if (state.guessIndex >= CLIP_DURATIONS.length) {
    state.status = 'lost';
    onGameEnd(false);
    return;
  }

  // Advance to next guess
  state.selectedSong = null;
  document.getElementById('guessInput').value = '';
  document.getElementById('submitBtn').disabled = true;
  closeAutocomplete();
  updateClipLabel();

  // Bump progress bar to new reveal level
  const newDur = CLIP_DURATIONS[state.guessIndex];
  const maxDur = CLIP_DURATIONS[CLIP_DURATIONS.length - 1];
  const fill   = document.getElementById('progressFill');
  fill.style.transition = 'width 0.5s ease';
  fill.style.width = (newDur / maxDur * 100) + '%';
}

// ── Win / Lose ────────────────────────────────────────────────────────────────

function onGameEnd(won) {
  revealSongCard(won);
  document.getElementById('inputArea').style.display = 'none';
  document.getElementById('newGameBtn').style.display = 'block';

  // Full bar
  const fill = document.getElementById('progressFill');
  fill.style.transition = 'width 0.6s ease';
  fill.style.width = '100%';
  document.getElementById('clipDurationLabel').textContent = '15s';

  setTimeout(() => showGameEndModal(won), 700);
}

function revealSongCard(won) {
  const song = state.currentSong;
  const card = document.getElementById('songCard');
  card.classList.add(won ? 'won' : 'lost');

  const art = getSongArt(song);
  if (art) {
    const artEl = document.getElementById('songArt');
    artEl.innerHTML = `<img src="${esc(art)}" alt="Album art" />`;
    setTimeout(() => artEl.querySelector('img')?.classList.add('unblur'), 60);
  }

  document.getElementById('songTitleHidden').textContent  = song.title;
  document.getElementById('songArtistHidden').textContent = song.artist;
}

function resetSongCard() {
  document.getElementById('songCard').classList.remove('won', 'lost');
  document.getElementById('songArt').innerHTML =
    '<div class="art-placeholder"><span class="art-icon">?</span></div>';
  document.getElementById('songTitleHidden').textContent  = '? ? ? ? ?';
  document.getElementById('songArtistHidden').textContent = '? ? ?';
}

function showGameEndModal(won) {
  const song = state.currentSong;
  document.getElementById('gameEndIcon').textContent   = won ? '🎉' : '😔';
  document.getElementById('gameEndTitle').textContent  = won
    ? `Got it in ${state.guesses.length}${state.guesses.length === 1 ? ' try' : ' tries'}!`
    : 'Better luck next time!';
  document.getElementById('endSongName').textContent   = song.title;
  document.getElementById('endArtistName').textContent = song.artist;

  const art = getSongArt(song);
  const artWrap = document.getElementById('endArtWrap');
  artWrap.innerHTML = art
    ? `<img src="${esc(art)}" alt="Album art" />`
    : '<div class="art-placeholder small"><span class="art-icon">♪</span></div>';

  openModal('gameEndModal');
}

function handlePlayFull() {
  closeModal('gameEndModal');
  const p = ytGetPlayer();
  if (!p) return;
  p.seekTo(0, true);
  p.playVideo();
  setPlayBtn(true);
  document.getElementById('clipDurationLabel').textContent = '▶';
}

// ── Guess Slots ───────────────────────────────────────────────────────────────

function renderGuessSlots() {
  const container = document.getElementById('guessSlots');
  container.innerHTML = '';
  for (let i = 0; i < CLIP_DURATIONS.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'guess-slot';
    slot.id = `slot-${i}`;
    if (i === state.guessIndex && state.status === 'playing') slot.classList.add('active-next');

    slot.innerHTML = `
      <span class="slot-num">${i + 1}</span>
      <span class="slot-label"></span>
    `;
    container.appendChild(slot);
  }
}

function renderGuessSlot(index, guess) {
  const slot  = document.getElementById(`slot-${index}`);
  if (!slot) return;
  slot.classList.remove('active-next');
  slot.classList.add('slot-animate');

  const label = slot.querySelector('.slot-label');

  if (guess.result === 'skipped') {
    slot.classList.add('skipped');
    label.textContent = 'Skipped';
    addSlotIcon(slot, '↷');
  } else if (guess.result === 'correct') {
    slot.classList.add('correct');
    label.textContent = `${guess.song.title} – ${guess.song.artist}`;
    addSlotIcon(slot, '✓');
  } else if (guess.result === 'artist') {
    slot.classList.add('artist');
    label.textContent = `${guess.song.title} – ${guess.song.artist}`;
    addSlotIcon(slot, '~');
  } else {
    slot.classList.add('wrong');
    label.textContent = `${guess.song.title} – ${guess.song.artist}`;
    addSlotIcon(slot, '✗');
  }

  // Mark next slot as active
  const next = document.getElementById(`slot-${index + 1}`);
  if (next && state.status === 'playing') next.classList.add('active-next');
}

function addSlotIcon(slot, icon) {
  const el = document.createElement('span');
  el.className = 'slot-icon';
  el.textContent = icon;
  slot.appendChild(el);
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

let _acItems      = [];
let _acHighlight  = -1;
let _acDebounce   = null;

async function handleInputChange(e) {
  const q = e.target.value.trim();
  state.selectedSong = null;
  document.getElementById('submitBtn').disabled = true;
  _acHighlight = -1;

  if (q.length === 0) { closeAutocomplete(); return; }

  clearTimeout(_acDebounce);
  _acDebounce = setTimeout(async () => {
    let results = [];

    if (state.mode === 'custom' && state.spotifyToken) {
      try {
        results = await searchSpotifyTracks(state.spotifyToken, q);
      } catch {
        results = filterLocalSongs(q);
      }
    } else {
      results = filterLocalSongs(q);
    }

    _acItems = results;
    renderDropdown(results);
  }, 180);
}

function filterLocalSongs(q) {
  q = q.toLowerCase();
  return state.songs.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.artist.toLowerCase().includes(q) ||
    `${s.title} ${s.artist}`.toLowerCase().includes(q)
  ).slice(0, 8);
}

function renderDropdown(items) {
  const dd = document.getElementById('autocompleteDropdown');
  if (items.length === 0) { dd.classList.remove('open'); return; }

  dd.innerHTML = items.map((item, i) => `
    <div class="ac-item" data-i="${i}">
      <div class="ac-title">${esc(item.title)}</div>
      <div class="ac-artist">${esc(item.artist)}</div>
    </div>
  `).join('');

  dd.querySelectorAll('.ac-item').forEach(el =>
    el.addEventListener('click', () => selectItem(+el.dataset.i))
  );
  dd.classList.add('open');
}

function handleInputKeydown(e) {
  const items = document.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _acHighlight = Math.min(_acHighlight + 1, items.length - 1);
    updateHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    _acHighlight = Math.max(_acHighlight - 1, 0);
    updateHighlight(items);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (_acHighlight >= 0) selectItem(_acHighlight);
    else if (state.selectedSong) handleSubmit();
  } else if (e.key === 'Escape') {
    closeAutocomplete();
  }
}

function updateHighlight(items) {
  items.forEach((el, i) => el.classList.toggle('hi', i === _acHighlight));
  if (_acHighlight >= 0 && items[_acHighlight]) {
    items[_acHighlight].scrollIntoView({ block: 'nearest' });
  }
}

function selectItem(index) {
  const song = _acItems[index];
  if (!song) return;
  state.selectedSong = song;
  document.getElementById('guessInput').value  = `${song.title} – ${song.artist}`;
  document.getElementById('submitBtn').disabled = false;
  closeAutocomplete();
}

function closeAutocomplete() {
  document.getElementById('autocompleteDropdown').classList.remove('open');
  _acHighlight = -1;
}

// ── Settings ──────────────────────────────────────────────────────────────────

function populateSettingsModal() {
  const s = getSettings();
  document.getElementById('spotifyClientId').value     = s.spotifyClientId;
  document.getElementById('spotifyClientSecret').value = s.spotifyClientSecret;
  document.getElementById('youtubeApiKey').value       = s.youtubeApiKey;
}

function handleSaveSettings() {
  saveSettingsToStorage({
    spotifyClientId:     document.getElementById('spotifyClientId').value.trim(),
    spotifyClientSecret: document.getElementById('spotifyClientSecret').value.trim(),
    youtubeApiKey:       document.getElementById('youtubeApiKey').value.trim(),
  });
  closeModal('settingsModal');
  showToast('Settings saved ✓');
}

// ── Custom Playlist ───────────────────────────────────────────────────────────

async function handleLoadPlaylist() {
  const input = document.getElementById('playlistInput').value.trim();
  if (!input) return;

  const { spotifyClientId, spotifyClientSecret } = getSettings();
  if (!spotifyClientId || !spotifyClientSecret) {
    showToast('Add Spotify credentials in Settings first');
    openModal('settingsModal');
    return;
  }

  const playlistId = extractPlaylistId(input);
  if (!playlistId) {
    showToast('Invalid Spotify playlist URL');
    return;
  }

  showLoading('Fetching playlist…');
  try {
    // Refresh token if needed
    if (!state.spotifyToken || Date.now() > state.spotifyTokenExpiry) {
      state.spotifyToken       = await getSpotifyToken(spotifyClientId, spotifyClientSecret);
      state.spotifyTokenExpiry = Date.now() + 3500_000;
    }

    const tracks = await fetchPlaylistTracks(state.spotifyToken, playlistId);
    if (tracks.length === 0) { hideLoading(); showToast('No playable tracks found'); return; }

    state.songs = tracks;
    hideLoading();
    showToast(`✓ Loaded ${tracks.length} songs`);
    startNewGame();
  } catch (err) {
    hideLoading();
    showToast(`Error: ${err.message}`);
  }
}

// ── UI Utilities ──────────────────────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

let _loadingEl = null;
function showLoading(msg) {
  if (_loadingEl) _loadingEl.remove();
  _loadingEl = Object.assign(document.createElement('div'), { className: 'loading-overlay' });
  _loadingEl.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">${esc(msg)}</div>
  `;
  document.body.appendChild(_loadingEl);
}
function hideLoading() {
  if (_loadingEl) { _loadingEl.remove(); _loadingEl = null; }
}

let _toastTimer = null;
let _toastEl    = null;
function showToast(msg) {
  if (!_toastEl) {
    _toastEl = document.createElement('div');
    _toastEl.className = 'toast';
    document.body.appendChild(_toastEl);
  }
  _toastEl.textContent = msg;
  _toastEl.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => _toastEl.classList.remove('show'), 2800);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * BUILT-IN PLAYLIST
 *
 * To add or replace songs, edit this array.
 * youtubeId: the video ID from youtube.com/watch?v=VIDEO_ID
 * Get the thumbnail via: https://img.youtube.com/vi/VIDEO_ID/mqdefault.jpg
 */
const BUILTIN_SONGS = [
  { id:  1, title: "Shape of You",           artist: "Ed Sheeran",              youtubeId: "JGwWNGJdvx8" },
  { id:  2, title: "Blinding Lights",         artist: "The Weeknd",              youtubeId: "4NRXx6U8ABQ" },
  { id:  3, title: "Rolling in the Deep",     artist: "Adele",                   youtubeId: "rYEDA3JcQqw" },
  { id:  4, title: "Uptown Funk",             artist: "Mark Ronson",             youtubeId: "OPf0YbXqDm0" },
  { id:  5, title: "Bohemian Rhapsody",       artist: "Queen",                   youtubeId: "fJ9rUzIMcZQ" },
  { id:  6, title: "Smells Like Teen Spirit", artist: "Nirvana",                 youtubeId: "hTWKbfoikeg" },
  { id:  7, title: "Billie Jean",             artist: "Michael Jackson",         youtubeId: "Zi_XLOBDo_Y" },
  { id:  8, title: "Sweet Child O' Mine",     artist: "Guns N' Roses",           youtubeId: "1w7OgIMMRc4" },
  { id:  9, title: "Levitating",              artist: "Dua Lipa",                youtubeId: "TUVcZfQe-Kc" },
  { id: 10, title: "drivers license",         artist: "Olivia Rodrigo",          youtubeId: "ZmDBbnmKpqQ" },
  { id: 11, title: "bad guy",                 artist: "Billie Eilish",           youtubeId: "DyDfgMOUjCI" },
  { id: 12, title: "Watermelon Sugar",        artist: "Harry Styles",            youtubeId: "E07s5ZYygMg" },
  { id: 13, title: "Sunflower",               artist: "Post Malone",             youtubeId: "ApXoWvfEYVU" },
  { id: 14, title: "God's Plan",              artist: "Drake",                   youtubeId: "xpVfcZ0ZcFM" },
  { id: 15, title: "Old Town Road",           artist: "Lil Nas X",               youtubeId: "r7qovpFAGrQ" },
  { id: 16, title: "Rockstar",                artist: "Post Malone",             youtubeId: "UceaB4D0jpo" },
  { id: 17, title: "Stay",                    artist: "The Kid LAROI",           youtubeId: "kTJczUoc26U" },
  { id: 18, title: "Butter",                  artist: "BTS",                     youtubeId: "WMweEpGlu_U" },
  { id: 19, title: "good 4 u",                artist: "Olivia Rodrigo",          youtubeId: "gNi_6U5Pm_o" },
  { id: 20, title: "SICKO MODE",              artist: "Travis Scott",            youtubeId: "6ONRf7h3Mdk" },
  { id: 21, title: "Peaches",                 artist: "Justin Bieber",           youtubeId: "peUa7M0-Wlg" },
  { id: 22, title: "Dynamite",                artist: "BTS",                     youtubeId: "gdZLi9oWNZg" },
  { id: 23, title: "Happier",                 artist: "Marshmello",              youtubeId: "m7Bc3pLyij0" },
  { id: 24, title: "Believer",                artist: "Imagine Dragons",         youtubeId: "7wtfhZwyrcc" },
  { id: 25, title: "Thunder",                 artist: "Imagine Dragons",         youtubeId: "fKopy74weus" },
];

/**
 * Returns the thumbnail URL for a song.
 * Falls back to YouTube thumbnail when no albumArt is set.
 */
function getSongArt(song) {
  if (song.albumArt) return song.albumArt;
  if (song.youtubeId) return `https://img.youtube.com/vi/${song.youtubeId}/mqdefault.jpg`;
  return '';
}

// Helper to extract YouTube video ID from URL
function getYouTubeId(url) {
  const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[1].length === 11) ? match[1] : null;
}

function setYouTubeBackground(videoId) {
  const videoBg = document.getElementById('video-background');
  videoBg.innerHTML = '';
  if (!videoId) return;
  // create a container so we can scale/zoom it slightly
  const inner = document.createElement('div');
  inner.className = 'video-inner';
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&controls=0&showinfo=0&rel=0&loop=1&playlist=${videoId}&modestbranding=1&iv_load_policy=3&playsinline=1`;
  iframe.frameBorder = '0';
  iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
  iframe.allowFullscreen = false;
  iframe.style.pointerEvents = 'none';
  inner.appendChild(iframe);
  videoBg.appendChild(inner);
}

// Put your default YouTube link here (only in this script). Replace with any YouTube URL.
const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/watch?v=p7Cn6AOQKJ4&list=RDp7Cn6AOQKJ4&start_radio=1';
// Playlist (YouTube IDs) and current index for sequential playback
const YT_VIDEO_LIST = [
  '7vBIjCHUWe0', 
// 'wWoQ7PFSYlk',
// 'j15H4PogaTU'
];
let currentVideoIndex = 0;

function getNextIndex() {
  if (!Array.isArray(YT_VIDEO_LIST) || YT_VIDEO_LIST.length === 0) return 0;
  currentVideoIndex = (currentVideoIndex + 1) % YT_VIDEO_LIST.length;
  return currentVideoIndex;
}

function getNextVideoId() { return YT_VIDEO_LIST[getNextIndex()]; }
// Create a custom cursor element and follow the mouse
function initCustomCursor() {
  const cursor = document.createElement('div');
  cursor.className = 'custom-cursor';
  document.body.appendChild(cursor);
  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
  document.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });
  document.addEventListener('mouseenter', () => { cursor.style.opacity = '0.98'; });
  // hover behavior: switch to pointer variant when over clickable elements
  function addPointerListeners(selector) {
    document.querySelectorAll(selector).forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('pointer'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('pointer'));
    });
  }
  // selectors for interactive elements
  ['a', 'button', '.social-icon', '.enter-btn', '.mute-btn'].forEach(s => addPointerListeners(s));
}

// Ensure favicon exists (fallback)
function ensureFavicon() {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.href = 'favicon.svg';
    document.head.appendChild(link);
  }
}

// Try to fetch favicon.svg and insert data URI fallback to improve compatibility
function ensureFaviconDataURI() {
  fetch('favicon.svg').then(r => r.text()).then(svgText => {
    try {
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result;
        // remove existing icon links
        document.querySelectorAll("link[rel~='icon']").forEach(n => n.remove());
        const l = document.createElement('link');
        l.rel = 'icon';
        l.href = data;
        document.head.appendChild(l);
        // also add png fallback by drawing svg to canvas (may fail in some browsers)
        try {
          const img = new Image();
          img.onload = () => {
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const png = c.toDataURL('image/png');
            const lp = document.createElement('link'); lp.rel = 'icon'; lp.href = png; document.head.appendChild(lp);
          };
          img.src = data;
        } catch (e) { /* ignore */ }
      };
      reader.readAsDataURL(blob);
    } catch (e) { /* ignore */ }
  }).catch(() => { /* ignore */ });
}

// Load YouTube IFrame API and initialize a player for higher-quality playback
function loadYouTubeAPI(onLoad) {
  if (window.YT && window.YT.Player) return onLoad();
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  window.onYouTubeIframeAPIReady = onLoad;
}

function createYTBackgroundPlayer(videoId) {
  const container = document.getElementById('video-background');
  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'video-inner';
  wrapper.id = 'yt-bg-wrapper';
  container.appendChild(wrapper);

  // create an element where the API will insert iframe
  const playerEl = document.createElement('div');
  playerEl.id = 'yt-bg-player';
  wrapper.appendChild(playerEl);

  const player = new YT.Player('yt-bg-player', {
    videoId: videoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      loop: 0,
      playlist: videoId,
      modestbranding: 1,
      iv_load_policy: 3,
      rel: 0,
      playsinline: 1,
      mute: 0
    },
    events: {
      onReady: function(event) {
        // attach reference for later control
        const el = document.getElementById('yt-bg-player');
        if (el) el._ytPlayer = event.target;
        try {
          // Request a higher playback quality; not guaranteed but helps
          event.target.setPlaybackQuality('highres');
          // autoplay may be blocked; only play if allowed or if user already visited
          const visited = localStorage.getItem('visited_v1');
          if (visited) event.target.playVideo();
          // apply saved mute preference
          const wasMuted = localStorage.getItem('yt_muted') === '1';
          if (wasMuted) event.target.mute(); else event.target.unMute();
          // update mute button UI if present
          const muteBtn = document.getElementById('mute-btn');
          if (muteBtn) muteBtn.setAttribute('aria-pressed', wasMuted ? 'true' : 'false');
        } catch (e) {
          // ignore
        }
      },
      onStateChange: function(event) {
        // when video ends, advance sequentially or loop if only one video
        if (event.data === YT.PlayerState.ENDED) {
          try {
            const info = event.target.getVideoData();
            const currentId = (info && info.video_id) ? info.video_id : videoId;
            // if playlist has <=1 items, just replay the same video
            if (!Array.isArray(YT_VIDEO_LIST) || YT_VIDEO_LIST.length <= 1) {
              try { event.target.playVideo(); } catch (err) { /* ignore */ }
              return;
            }
            // sync currentVideoIndex to the actual current video if possible
            const idx = YT_VIDEO_LIST.indexOf(currentId);
            if (idx >= 0) currentVideoIndex = idx;
            // get the next video id sequentially
            const nextId = getNextVideoId();
            const wasMuted = localStorage.getItem('yt_muted') === '1';
            if (typeof event.target.loadVideoById === 'function') {
              event.target.loadVideoById({ videoId: nextId, startSeconds: 0 });
              if (wasMuted) event.target.mute(); else event.target.unMute();
            } else {
              switchBackgroundTo(nextId);
            }
          } catch (e) {
            // fallback: try to replay current video
            try { event.target.playVideo(); } catch (err) { /* ignore */ }
          }
        }
      }
    }
  });

  // subtle zoom loop via JS (keeps working even if CSS transition reset)
  let scale = 1.03;
  setInterval(() => {
    scale += 0.00018;
    if (scale > 1.14) scale = 1.03;
    wrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }, 90);
}

function switchBackgroundTo(videoId) {
  // preserve mute preference
  const wasMuted = localStorage.getItem('yt_muted') === '1';
  // if YT player is active, try to load new video via API
  try {
    const p = document.getElementById('yt-bg-player');
    if (p && p._ytPlayer && typeof p._ytPlayer.loadVideoById === 'function') {
      p._ytPlayer.loadVideoById({ videoId: videoId, startSeconds: 0 });
      if (wasMuted) p._ytPlayer.mute(); else p._ytPlayer.unMute();
      return;
    }
  } catch (e) { /* fall back to recreating iframe */ }

  // fallback: recreate the iframe background (works even when API not ready)
  try {
    const container = document.getElementById('video-background');
    container.innerHTML = '';
    const inner = document.createElement('div'); inner.className = 'video-inner';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${wasMuted ? 1 : 0}&controls=0&rel=0&loop=1&playlist=${videoId}&modestbranding=1&iv_load_policy=3&playsinline=1`;
    iframe.frameBorder = '0'; iframe.allow = 'autoplay; encrypted-media; picture-in-picture'; iframe.allowFullscreen = false; iframe.style.pointerEvents = 'none';
    inner.appendChild(iframe); container.appendChild(inner);
  } catch (e) { /* ignore */ }
}

// Wire up shuffle button after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const nextBtn = document.getElementById('next-btn');
  if (!nextBtn) return;
  try { nextBtn.style.cursor = 'none'; } catch (e) {}
  nextBtn.addEventListener('click', () => {
    const nextId = getNextVideoId();
    switchBackgroundTo(nextId);
    // quick forward pop
    nextBtn.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 220 });
  });
  nextBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextBtn.click(); }
  });
});

window.addEventListener('DOMContentLoaded', function() {
  initCustomCursor();
  ensureFavicon();
  ensureFaviconDataURI();
  // prefer the DEFAULT_YOUTUBE_URL if it's part of our playlist, otherwise start at index 0
  const defaultId = getYouTubeId(DEFAULT_YOUTUBE_URL);
  const idx = (defaultId && YT_VIDEO_LIST.indexOf(defaultId) >= 0) ? YT_VIDEO_LIST.indexOf(defaultId) : 0;
  currentVideoIndex = idx;
  const startId = YT_VIDEO_LIST[currentVideoIndex] || defaultId;
  if (!startId) return;
  loadYouTubeAPI(() => createYTBackgroundPlayer(startId));
});

// Rotating H2 / skills text
document.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.querySelector('.title');
  if (!titleEl) return;
  // derive phrases from existing title if it contains separators, otherwise use defaults
  const raw = (titleEl.textContent || '').trim();
  const parts = raw.includes('•') ? raw.split('•').map(s => s.trim()).filter(Boolean) : [];
  const defaults = parts.length > 0 ? parts : [  'Web designer',
  // 🎨 Design & Creativity
  "UI/UX Design Sense",
  "Visual Aesthetic Crafting",
  "Creative Problem Solving",
  "Branding & Identity Design",
  "Digital Illustration",
  "Motion & Micro-Interaction Awareness",

  // 💻 Web Development
  "Responsive Web Design",
  "Modern Front-End Development (React / JavaScript)",
  "Performance Optimization",
  "Clean, Maintainable Code Writing",
  "Debugging & Troubleshooting",
  "User-Focused Interface Building",

  // 🎮 Gaming & Tech
  "Gameplay Strategy & Analysis",
  "Fast Learning of New Game Systems",
  "Hardware Knowledge & Setup Optimization",
  "Streaming & Community Interaction",
  "Active Listening",
  "Adaptability in Social Situations",
  "Creativity Under Pressure",
  "Friendly and Approachable Personality",                                             
  "High Focus and Fast Reflexes"];
  // setup initial span
  const span = document.createElement('span');
  span.className = 'skill-text';
  span.textContent = defaults[0] || '';
  titleEl.textContent = '';
  titleEl.appendChild(span);

  let idx = 0;
  const intervalMs = 3200;
  const transitionMs = 560; // should match CSS transition duration

  setInterval(() => {
    const cur = titleEl.querySelector('.skill-text');
    if (!cur) return;
    cur.classList.remove('fade-in');
    cur.classList.add('fade-out');
    setTimeout(() => {
      idx = (idx + 1) % defaults.length;
      cur.textContent = defaults[idx];
      cur.classList.remove('fade-out');
      cur.classList.add('fade-in');
      // remove fade-in after transition to keep DOM tidy
      setTimeout(() => cur.classList.remove('fade-in'), transitionMs);
    }, transitionMs);
  }, intervalMs);
});

// ensure mute UI is set early
document.addEventListener('DOMContentLoaded', () => {
  applyDesiredMute();
});

/* Entry overlay and counter using CountAPI with local fallback */
const COUNTAPI_NAMESPACE = 'smooth-port-example';
const COUNTAPI_KEY = 'midnight-saloon-entrances';

function fetchCount() {
  // CountAPI: https://countapi.xyz/
  const url = `https://api.countapi.xyz/get/${COUNTAPI_NAMESPACE}/${COUNTAPI_KEY}`;
  return fetch(url).then(r => r.json()).catch(() => null);
}

function incrementCount() {
  const url = `https://api.countapi.xyz/hit/${COUNTAPI_NAMESPACE}/${COUNTAPI_KEY}`;
  return fetch(url).then(r => r.json()).catch(() => null);
}

function showEntryOverlay() {
  const overlay = document.getElementById('entry-overlay');
  overlay.setAttribute('aria-hidden', 'false');
  // update counter value while waiting
  fetchCount().then(data => {
    if (data && typeof data.value !== 'undefined') {
      document.querySelector('#entry-counter .count').textContent = data.value;
    } else {
      // fallback to localStorage
      const local = localStorage.getItem('entry_count') || 0;
      document.querySelector('#entry-counter .count').textContent = local;
    }
  });
  // pause YT player if available
  try {
    const p = document.getElementById('yt-bg-player');
    if (p && p._ytPlayer && typeof p._ytPlayer.pauseVideo === 'function') p._ytPlayer.pauseVideo();
  } catch (e) { /* ignore */ }
}

function hideEntryOverlay() {
  const overlay = document.getElementById('entry-overlay');
  overlay.setAttribute('aria-hidden', 'true');
}

/* Persistent counter display in main UI */
function updatePersistentCounterDisplay() {
  const el = document.getElementById('persistent-count');
  if (!el) return;
  fetchCount().then(data => {
    if (data && typeof data.value !== 'undefined') {
      el.textContent = data.value;
      localStorage.setItem('entry_count', data.value);
    } else {
      el.textContent = localStorage.getItem('entry_count') || '0';
    }
  });
}

/* Mute / Unmute handling */
let desiredMuted = localStorage.getItem('yt_muted') === '1';

function applyDesiredMute() {
  // update UI first
  const btn = document.getElementById('mute-btn');
  if (btn) {
    btn.setAttribute('aria-pressed', desiredMuted ? 'true' : 'false');
    // update icon using currentColor so it inherits from the button color
    // polished icons: filled speaker + arcs for unmuted; speaker with diagonal slash for muted
    btn.innerHTML = desiredMuted
      ? `
        <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g fill="none" fill-rule="evenodd">
            <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/>
            <path d="M16.5 8.5L7.5 17.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 5l-1.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M19 19l-1.5-1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `
      : `
        <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g fill="none" fill-rule="evenodd" stroke="currentColor">
            <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" stroke="none"/>
            <path d="M15.5 8.5c0.9 0.9 1.5 2.1 1.5 3.5 0 1.4-0.6 2.6-1.5 3.5" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 6.5c1.7 1.7 2.5 4 2.5 6.5 0 2.5-0.8 4.8-2.5 6.5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </g>
        </svg>
      `;
  }

  // apply to player when available
  try {
    const p = document.getElementById('yt-bg-player');
    if (p && p._ytPlayer) {
      if (desiredMuted) {
        // call both mute and setVolume as a fallback
        if (typeof p._ytPlayer.mute === 'function') p._ytPlayer.mute();
        if (typeof p._ytPlayer.setVolume === 'function') p._ytPlayer.setVolume(0);
      } else {
        if (typeof p._ytPlayer.unMute === 'function') p._ytPlayer.unMute();
        if (typeof p._ytPlayer.setVolume === 'function') p._ytPlayer.setVolume(100);
      }
    }
  } catch (e) { /* ignore */ }
  // persist choice
  localStorage.setItem('yt_muted', desiredMuted ? '1' : '0');
}

function setMuted(muted) {
  desiredMuted = !!muted;
  applyDesiredMute();
}

function toggleMute() {
  setMuted(!desiredMuted);
}

document.addEventListener('DOMContentLoaded', () => {
  const visited = localStorage.getItem('visited_v1');
  if (!visited) {
    // show the overlay and pause the background until user enters
    showEntryOverlay();
    // pause YT player if it exists
    window._pauseBackground = true;
  }

  const enterBtn = document.getElementById('enter-site-btn');
  if (enterBtn) {
    enterBtn.addEventListener('click', async () => {
      // increment remote counter (try) and local fallback
      const res = await incrementCount();
      if (res && typeof res.value !== 'undefined') {
        document.querySelector('#entry-counter .count').textContent = res.value;
        localStorage.setItem('entry_count', res.value);
      } else {
        // fallback: increment local
        const prev = parseInt(localStorage.getItem('entry_count') || '0', 10);
        const now = prev + 1;
        localStorage.setItem('entry_count', now);
        document.querySelector('#entry-counter .count').textContent = now;
      }

      // mark visited and hide overlay
      localStorage.setItem('visited_v1', '1');
      hideEntryOverlay();

      // resume background video if YT player exists
      if (window.YT && window.YT.get) {
        try { const p = document.getElementById('yt-bg-player'); if (p && p._ytPlayer) p._ytPlayer.playVideo(); } catch (e) { /* ignore */ }
      }
      // clear pause flag
      window._pauseBackground = false;
    });
  }
  // initialize persistent counter display on main UI
  updatePersistentCounterDisplay();

  // mute button wiring
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    const wasMuted = localStorage.getItem('yt_muted') === '1';
    muteBtn.setAttribute('aria-pressed', wasMuted ? 'true' : 'false');
    // ensure native cursor stays hidden here too
    muteBtn.style.cursor = 'none';
    // set initial icon via applyDesiredMute
    applyDesiredMute();
    muteBtn.addEventListener('click', () => {
      toggleMute();
      // animate button for feedback
      muteBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 180 });
      // add animate class for SVG pop
      muteBtn.classList.add('animate');
      setTimeout(() => muteBtn.classList.remove('animate'), 280);
    });
    // keyboard accessibility: Enter and Space toggle
    muteBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleMute();
        muteBtn.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 180 });
      }
    });
  }
});


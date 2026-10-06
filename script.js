/* =========================================================
   ETHICALLY ME — SCRIPT
   1. Mobile menu (hamburger)
   2. Highlight the current section in the navbar
   3. Dark mode toggle
   4. Hover sound effects
   5. Open / close the Moral Moment reflection window

   You normally don't need to edit this file.
   All your writing goes in index.html.
   ========================================================= */


/* Small helpers for saving settings in the browser (safe if storage is blocked) */
function saveSetting(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
function loadSetting(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}


/* ---------- 1. MOBILE MENU ---------- */
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.getElementById('nav-menu');

function setMenuOpen(isOpen) {
  navToggle.setAttribute('aria-expanded', String(isOpen));
  navMenu.classList.toggle('is-open', isOpen);
}

navToggle.addEventListener('click', () => {
  const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
  setMenuOpen(!isOpen);
});

// Close the menu after choosing a link
navMenu.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenuOpen(false);
});

// Close the menu with the Escape key
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && navMenu.classList.contains('is-open')) {
    setMenuOpen(false);
    navToggle.focus();
  }
});


/* ---------- 2. HIGHLIGHT CURRENT SECTION ---------- */
const navLinks = navMenu.querySelectorAll('a');
const sections = document.querySelectorAll('main section[id]');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    navLinks.forEach((link) => {
      if (link.getAttribute('href') === '#' + entry.target.id) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  });
}, {
  // A section counts as "current" when it crosses the middle of the screen
  rootMargin: '-45% 0px -50% 0px'
});

sections.forEach((section) => sectionObserver.observe(section));


/* ---------- 3. DARK MODE ---------- */
// The starting theme is chosen by the small script in the <head> of index.html.
const themeToggle = document.querySelector('.theme-toggle');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
}

applyTheme(document.documentElement.getAttribute('data-theme') || 'light');

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  applyTheme(newTheme);
  saveSetting('ethically-me-theme', newTheme);
});


/* ---------- 4. HOVER SOUND EFFECTS ---------- */
// The sound is a short, soft "tick" made with the Web Audio API,
// so there are no audio files to download.
//
// IMPORTANT: every browser blocks sound until the visitor interacts with the page
// (a click, tap, or key press). Hovering doesn't count. So the sounds switch on
// with the visitor's FIRST click or tap anywhere on the page.
const soundToggle = document.querySelector('.sound-toggle');
let soundOn = loadSetting('ethically-me-sound') !== 'off'; // on by default
let audioCtx = null;
let hasPlayedSound = false; // becomes true once the visitor has heard a sound

function updateSoundButton() {
  soundToggle.setAttribute('aria-pressed', String(soundOn));
}
updateSoundButton();

function audioIsReady() {
  return audioCtx !== null && audioCtx.state === 'running';
}

// Create / wake up the audio engine. Must be called during a click, tap, or key press.
function unlockAudio() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return Promise.resolve();

  if (!audioCtx) {
    audioCtx = new AudioEngine();
    // Playing a silent sound right away helps Safari unlock audio
    const silence = audioCtx.createBufferSource();
    silence.buffer = audioCtx.createBuffer(1, 1, 22050);
    silence.connect(audioCtx.destination);
    silence.start(0);
  }

  if (audioCtx.state === 'suspended') {
    return audioCtx.resume().catch(() => {});
  }
  return Promise.resolve();
}

// Unlock on the first interaction of any kind, then stop listening
const unlockEvents = ['pointerdown', 'touchend', 'click', 'keydown'];

function handleFirstInteraction() {
  unlockAudio().then(() => {
    if (audioIsReady()) {
      unlockEvents.forEach((type) =>
        document.removeEventListener(type, handleFirstInteraction, true));
    }
  });
}

unlockEvents.forEach((type) =>
  document.addEventListener(type, handleFirstInteraction, true));

function playHoverSound() {
  if (!soundOn || !audioIsReady()) return;
  hasPlayedSound = true;

  const now = audioCtx.currentTime;
  const tone = audioCtx.createOscillator();
  const volume = audioCtx.createGain();

  tone.type = 'sine';
  tone.frequency.setValueAtTime(660, now);                     // starting pitch
  tone.frequency.exponentialRampToValueAtTime(990, now + 0.06); // quick rise

  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.exponentialRampToValueAtTime(0.04, now + 0.01);   // very quiet (change 0.04 to adjust)
  volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.09); // fade out

  tone.connect(volume).connect(audioCtx.destination);
  tone.start(now);
  tone.stop(now + 0.1);
}

// Play the sound when the mouse moves onto a link or button
let lastHovered = null;
document.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return; // skip touchscreens
  const clickable = event.target.closest('a, button');
  if (clickable && clickable !== lastHovered) playHoverSound();
  lastHovered = clickable;
});

soundToggle.addEventListener('click', () => {
  // If sound is "on" but the visitor hasn't heard anything yet, this first click
  // just wakes the sound up (with a preview tick) instead of muting it.
  if (soundOn && !hasPlayedSound) {
    unlockAudio().then(playHoverSound);
    return;
  }

  soundOn = !soundOn;
  updateSoundButton();
  saveSetting('ethically-me-sound', soundOn ? 'on' : 'off');
  if (soundOn) unlockAudio().then(playHoverSound); // quick preview so you know it's on
});


/* ---------- 5. REFLECTION WINDOW ---------- */
const dialog = document.getElementById('reflection-dialog');
const dialogNumber = document.getElementById('reflection-number');
const dialogTitle = document.getElementById('reflection-title');
const dialogBody = document.getElementById('reflection-body');
const closeButton = dialog.querySelector('[data-close]');

let lastOpenedFrom = null; // remembers which button opened the window

// The dashed "photo space" box only shows while you edit on your own computer.
// On the live website, a missing photo is simply hidden, so visitors never see it.
const isEditingLocally =
  location.protocol === 'file:' ||
  ['localhost', '127.0.0.1'].includes(location.hostname);

function preparePhotos(content) {
  content.querySelectorAll('.reflection-figure img').forEach((img) => {
    const figure = img.closest('.reflection-figure');
    figure.dataset.placeholder = 'Photo space: save a picture as ' + img.getAttribute('src');
    img.addEventListener('error', () => {
      if (isEditingLocally) {
        figure.classList.add('is-empty');
      } else {
        figure.remove();
      }
    });
  });
}

function openReflection(card, triggerButton) {
  const id = card.dataset.moment;                       // e.g. "01"
  const template = document.getElementById('reflection-' + id);
  if (!template) return;

  // Reuse the number and title written on the card
  dialogNumber.textContent = card.querySelector('.moment-number').textContent;
  dialogTitle.textContent = card.querySelector('.moment-title').textContent;

  // Copy the full reflection from its <template> into the window
  const content = template.content.cloneNode(true);
  preparePhotos(content);
  dialogBody.replaceChildren(content);

  lastOpenedFrom = triggerButton;
  dialog.showModal();
  dialogBody.scrollTop = 0;
}

// Connect each card's button to the window
document.querySelectorAll('.moment-card').forEach((card) => {
  const button = card.querySelector('.moment-button');
  button.addEventListener('click', () => openReflection(card, button));
});

// Close with the X button
closeButton.addEventListener('click', () => dialog.close());

// Close by clicking the dark area outside the window
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

// When closed (X, outside click, or Escape), return focus to the card's button
dialog.addEventListener('close', () => {
  if (lastOpenedFrom) lastOpenedFrom.focus();
});

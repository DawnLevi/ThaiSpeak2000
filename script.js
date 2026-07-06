// ---- Phrase bank (loaded from phrases.json) ----
let PHRASES = [];
let currentPhrase = null;

async function loadPhraseBank() {
  try {
    const res = await fetch('phrases.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    PHRASES = await res.json();
  } catch (err) {
    console.error('Failed to load phrases.json, using fallback phrase.', err);
    PHRASES = [
      { thai: "สวัสดีครับ", roman: "sawatdee khrap", meaning: '"Hello" (male speaker)' }
    ];
  }
  loadPhrase(getPhraseOfTheDay());
}

// Same phrase for everyone on the same calendar day, rotating through the bank
function getPhraseOfTheDay() {
  const now = new Date();
  const dayOfYear = Math.floor(
    (now - new Date(now.getFullYear(), 0, 0)) / 86400000
  );
  const index = dayOfYear % PHRASES.length;
  return PHRASES[index];
}

const thaiTextEl = document.getElementById('thaiText');
const romanTextEl = document.getElementById('romanText');
const meaningTextEl = document.getElementById('meaningText');
const recordBtn = document.getElementById('recordBtn');
const listenBtn = document.getElementById('listenBtn');
const newWordBtn = document.getElementById('newWordBtn');
const statusText = document.getElementById('statusText');
const heardText = document.getElementById('heardText');
const scoreFill = document.getElementById('scoreFill');
const scoreNumber = document.getElementById('scoreNumber');
const personaArea = document.getElementById('personaArea');
const personaGif = document.getElementById('personaGif');
const personaCaption = document.getElementById('personaCaption');
const footerStatus = document.getElementById('footerStatus');

function loadPhrase(phrase) {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  currentPhrase = phrase;
  thaiTextEl.textContent = phrase.thai;
  romanTextEl.textContent = phrase.roman;
  meaningTextEl.textContent = phrase.meaning;
  heardText.textContent = '\u00A0';
  scoreFill.style.width = '0%';
  scoreNumber.textContent = '0%';
  personaArea.classList.remove('visible');
  statusText.textContent = 'Press "Record" and say the phrase above.';
}

newWordBtn.addEventListener('click', () => {
  const next = PHRASES[Math.floor(Math.random() * PHRASES.length)];
  loadPhrase(next);
});

// ---- Levenshtein-based similarity, scored 0-100 ----
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function similarityScore(target, heard) {
  const t = target.replace(/\s/g, '');
  const h = heard.replace(/\s/g, '');
  if (t.length === 0) return 0;
  const dist = levenshtein(t, h);
  const maxLen = Math.max(t.length, h.length);
  const score = Math.round((1 - dist / maxLen) * 100);
  return Math.max(0, Math.min(100, score));
}

function showPersonaFeedback(score) {
  personaArea.classList.add('visible');
  if (score > 80) {
    // Replace this src with your own "Proud Dad" GIF file placed in this folder.
    personaGif.src = 'proud-dad.gif';
    personaGif.alt = 'Proud Dad';
    personaCaption.textContent = "Proud Dad says: \"That's my kid!\" 🎉";
  } else {
    // Replace this src with your own "Angry Lady" GIF file placed in this folder.
    personaGif.src = 'angry-lady.gif';
    personaGif.alt = 'Angry Lady';
    personaCaption.textContent = 'Angry Lady says: "Try again, dear." 😤';
  }
}

// ---- Text-to-Speech: "Listen" button (native pronunciation example) ----
let cachedVoices = [];

function loadVoices() {
  cachedVoices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
}

if (window.speechSynthesis) {
  loadVoices();
  // Voice lists load asynchronously in some browsers
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

function getThaiVoice() {
  return cachedVoices.find(v => v.lang === 'th-TH') ||
         cachedVoices.find(v => v.lang && v.lang.startsWith('th')) ||
         null;
}

function speakCurrentPhrase() {
  if (!window.speechSynthesis) {
    statusText.textContent = 'Text-to-speech is not supported in this browser.';
    return;
  }
  if (!currentPhrase) return;

  window.speechSynthesis.cancel(); // stop anything already playing

  const utterance = new SpeechSynthesisUtterance(currentPhrase.thai);
  utterance.lang = 'th-TH';
  utterance.rate = 0.85; // slightly slower for learners

  const thaiVoice = getThaiVoice();
  if (thaiVoice) {
    utterance.voice = thaiVoice;
  } else {
    statusText.textContent = 'No Thai voice found on this device — playing with default voice.';
  }

  utterance.onstart = () => {
    listenBtn.classList.add('speaking');
    footerStatus.textContent = 'Playing pronunciation...';
  };
  utterance.onend = () => {
    listenBtn.classList.remove('speaking');
    footerStatus.textContent = 'Ready';
  };
  utterance.onerror = () => {
    listenBtn.classList.remove('speaking');
    footerStatus.textContent = 'Ready';
    statusText.textContent = 'Could not play audio. Try again.';
  };

  window.speechSynthesis.speak(utterance);
}

listenBtn.addEventListener('click', speakCurrentPhrase);

// ---- Web Speech API setup ----
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (!SpeechRecognition) {
  statusText.textContent = 'Speech recognition is not supported in this browser. Try Chrome.';
  recordBtn.disabled = true;
} else {
  recognition = new SpeechRecognition();
  recognition.lang = 'th-TH';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    isRecording = true;
    recordBtn.classList.add('recording');
    recordBtn.textContent = '■ Stop';
    statusText.textContent = 'Listening... speak now.';
    footerStatus.textContent = 'Recording...';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    heardText.textContent = transcript;

    const score = similarityScore(currentPhrase.thai, transcript);
    scoreFill.style.width = score + '%';
    scoreNumber.textContent = score + '%';

    statusText.textContent = score > 80
      ? 'Great pronunciation!'
      : 'Keep practicing that phrase.';

    showPersonaFeedback(score);
  };

  recognition.onerror = (event) => {
    statusText.textContent = 'Error: ' + event.error + '. Please try again.';
    footerStatus.textContent = 'Error';
  };

  recognition.onend = () => {
    isRecording = false;
    recordBtn.classList.remove('recording');
    recordBtn.textContent = '● Record';
    footerStatus.textContent = 'Ready';
  };
}

recordBtn.addEventListener('click', () => {
  if (!recognition) return;
  if (isRecording) {
    recognition.stop();
  } else {
    heardText.textContent = '\u00A0';
    personaArea.classList.remove('visible');
    recognition.start();
  }
});

// Initialize by loading the phrase bank, then setting today's phrase
loadPhraseBank();

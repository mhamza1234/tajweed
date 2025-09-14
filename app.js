// --- Config ---
const SURAH_AUDIO = id =>
  `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${id.padStart(3,'0')}.mp3`;
const SURAH_JSON  = id => `data/${id}.json`;
const SURAH_TIMES = id => `data/${id}.words.json`;
const LEGEND_JSON = 'data/legend.json';
const MANIFEST_JSON = 'data/manifest.json';

// --- Elements ---
const fullSurah = document.getElementById('fullSurah');
const fullRate = document.getElementById('fullRate');
const fullLoop = document.getElementById('fullLoop');
const downloadMp3 = document.getElementById('downloadMp3');
const startPracticeBtn = document.getElementById('startPractice');
const heroTitle = document.getElementById('heroTitle');
const heroMeta = document.getElementById('heroMeta');
const fullTime = document.getElementById('fullTime');

const player = document.getElementById('player');
const surahSelect = document.getElementById('surahSelect');
const ayahList = document.getElementById('ayahList');
const trOut = document.getElementById('trOut');
const bnOut = document.getElementById('bnOut');
const surahTitle = document.getElementById('surahTitle');
const legendPane = document.getElementById('legend');
const legendBtn = document.getElementById('legendToggle');
const legendList = document.getElementById('legendList');
const live = document.getElementById('live');

const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');

// --- State ---
let legend = {};
let segments = [];          // [{start,end,ayahIndex,wordIndex}]
let spanRefs = [];          // [[span,...] per ayah]
let activeIdx = { i: -1, j: -1 };

// --- Helpers ---
const mmss = s => {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${String(sec).padStart(2,'0')}`;
};
const hexAlpha = (hex, a) => {
  const c = hex.replace('#','');
  const n = parseInt(c,16);
  const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// --- Init ---
(async function init() {
  // legend
  legend = await (await fetch(LEGEND_JSON)).json();
  renderLegend(legend);

  // manifest → build dropdown
  const manifest = await (await fetch(MANIFEST_JSON)).json();
  surahSelect.innerHTML = '';
  manifest.surahs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.id} — ${s.name_bn}`;
    surahSelect.appendChild(opt);
  });

  bindTransport();
  await loadSurah(surahSelect.value);

  surahSelect.addEventListener('change', e => loadSurah(e.target.value));
  legendBtn.addEventListener('click', () => toggleLegend());
})();

function bindTransport() {
  playBtn.addEventListener('click', () => player.play());
  pauseBtn.addEventListener('click', () => player.pause());
  restartBtn.addEventListener('click', () => { player.currentTime = 0; player.play(); });

  player.addEventListener('timeupdate', () => {
    if (!segments.length) return;
    const t = player.currentTime;
    for (let k = 0; k < segments.length; k++) {
      const s = segments[k];
      if (t >= s.start && t < s.end) { highlight(s.ayahIndex, s.wordIndex); break; }
    }
  });
  player.addEventListener('ended', clearActive);

  // Hero controls
  fullRate.addEventListener('change', e => {
    const r = parseFloat(e.target.value || '1');
    fullSurah.playbackRate = r; player.playbackRate = r;
  });
  fullLoop.addEventListener('change', e => { fullSurah.loop = e.target.checked; });
  fullSurah.addEventListener('timeupdate', () => {
    fullTime.textContent = `${mmss(fullSurah.currentTime)} / ${mmss(fullSurah.duration || 0)}`;
  });
  startPracticeBtn.addEventListener('click', () => {
    fullSurah.pause(); player.currentTime = 0; player.play().catch(()=>{});
    document.querySelector('.panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function loadSurah(id) {
  // reset
  clearActive();
  ayahList.innerHTML = '';
  trOut.textContent = '';
  bnOut.textContent = '';
  spanRefs = [];
  segments = [];

  const audioSrc = SURAH_AUDIO(id);
  player.src = audioSrc; fullSurah.src = audioSrc; downloadMp3.href = audioSrc;

  const data = await (await fetch(SURAH_JSON(id))).json();
  surahTitle.textContent = `${data.name_ar} — ${data.name_bn}`;
  heroTitle.textContent = `${data.name_ar} — ${data.name_bn}`;
  heroMeta.textContent = `Sūrah ${String(data.surah).padStart(3,'0')} • ${data.verses.length} āyāt`;

  // render ayat
  data.verses.forEach((ayah, i) => {
    const li = document.createElement('li');
    li.setAttribute('dir','rtl');
    const container = document.createElement('div');
    container.className = 'ayah';

    const spans = (ayah.words || []).map((w, j) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = w.ar;
      span.setAttribute('lang','ar');
      span.dataset.rules = (w.rules || []).join(',');

      const firstRule = (w.rules || [])[0];
      if (firstRule && legend[firstRule]?.color) {
        span.style.background = hexAlpha(legend[firstRule].color, 0.18);
      }
      span.title = ruleTooltip(w);

      span.addEventListener('click', () => {
        const seg = segments.find(s => s.ayahIndex === i && s.wordIndex === j);
        if (seg) { player.currentTime = Math.max(seg.start + 0.01, 0); player.play().catch(()=>{}); }
        announce(`${w.ar} — ${w.tr || ''}`);
        setExplain(ayah);
      });
      return span;
    });

    spans.forEach((s, idx) => {
      container.appendChild(s);
      if (idx !== spans.length - 1) container.appendChild(document.createTextNode(' '));
    });

    li.appendChild(container);
    ayahList.appendChild(li);
    spanRefs.push(spans);
  });

  if (data.verses[0]) setExplain(data.verses[0]);

  try {
    const times = await (await fetch(SURAH_TIMES(id))).json();
    segments = times.map(t => ({ start: t.start, end: t.end, ayahIndex: t.ayahIndex, wordIndex: t.wordIndex }));
  } catch {
    segments = []; // still usable (click-to-seek only)
  }
}

function setExplain(ayah) {
  trOut.textContent = (ayah.words || []).map(w => w.tr || '').join(' ');
  bnOut.textContent = ayah.bangla || '';
}

function highlight(i, j) {
  if (activeIdx.i === i && activeIdx.j === j) return;
  if (activeIdx.i >= 0 && activeIdx.j >= 0) {
    spanRefs[activeIdx.i]?.[activeIdx.j]?.classList.remove('active');
  }
  const span = spanRefs[i]?.[j];
  if (span) { span.classList.add('active'); activeIdx = { i, j }; }
}

function clearActive() {
  if (activeIdx.i >= 0 && activeIdx.j >= 0) {
    spanRefs[activeIdx.i]?.[activeIdx.j]?.classList.remove('active');
  }
  activeIdx = { i: -1, j: -1 };
}

function renderLegend(obj) {
  legendList.innerHTML = '';
  Object.entries(obj).forEach(([key, val]) => {
    const li = document.createElement('li');
    li.className = 'legend-item';
    const sw = document.createElement('span');
    sw.className = 'legend-swatch';
    sw.style.background = val.color || '#2a3140';
    const text = document.createElement('span');
    text.innerHTML = `<b>${val.label}</b> — ${val.desc}`;
    li.appendChild(sw); li.appendChild(text);
    legendList.appendChild(li);
  });
}

function toggleLegend() {
  const hidden = legendPane.hasAttribute('hidden');
  if (hidden) legendPane.removeAttribute('hidden'); else legendPane.setAttribute('hidden','');
  document.getElementById('legendToggle').setAttribute('aria-expanded', String(hidden));
}

function ruleTooltip(w) {
  const rules = w.rules || [];
  if (!rules.length) return `${w.tr || ''}`;
  const parts = rules.map(r => legend[r]?.label || r);
  return `${w.tr || ''}\nRules: ${parts.join(', ')}`;
}

function announce(msg) { live.textContent = msg; }

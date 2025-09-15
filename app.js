// === Config ===
// Juz 30 short names (for filenames like naba078.json, naas114.json)
const SHORT_NAMES = {
  "078":"naba","079":"naziat","080":"abasa","081":"takwir","082":"infitar","083":"mutaffifin",
  "084":"inshiqaq","085":"buruj","086":"tariq","087":"ala","088":"ghashiyah","089":"fajr",
  "090":"balad","091":"shams","092":"layl","093":"duha","094":"sharh","095":"tin","096":"alaq",
  "097":"qadr","098":"bayyinah","099":"zalzalah","100":"adiyat","101":"qariah","102":"takathur",
  "103":"asr","104":"humazah","105":"fil","106":"quraish","107":"maun","108":"kauthar",
  "109":"kafiroon","110":"nasr","111":"masad","112":"ikhlas","113":"falaq","114":"naas"
};

const SURAH_JSON   = id => `data/${(SHORT_NAMES[id]||`surah${id}`)}${id}.json`;
const SURAH_TIMES  = id => `data/${(SHORT_NAMES[id]||`surah${id}`)}${id}.words.json`;
const LEGEND_JSON  = 'data/legend.json';
const MANIFEST_JSON= 'data/manifest.json';

// Build CDN backups (we will prepend audio_full from JSON)
function buildAudioCandidates(id) {
  const n   = String(parseInt(id,10));   // "78", "114"
  const p3  = id.padStart(3,'0');        // "078", "114"
  return [
    `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${n}.mp3`,
    `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${p3}.mp3`,
    `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${n}.mp3`
  ];
}
function setAudioWithFallback(audioEl, urls, onResolvedUrl) {
  let i = 0;
  const tryNext = () => {
    if (i >= urls.length) return; // stop
    const url = urls[i];
    audioEl.src = url;
    onResolvedUrl?.(url);
    const onError = () => { cleanup(); i++; tryNext(); };
    const onCan = () => cleanup();
    function cleanup() {
      audioEl.removeEventListener('error', onError);
      audioEl.removeEventListener('canplay', onCan);
    }
    audioEl.addEventListener('error', onError, { once: true });
    audioEl.addEventListener('canplay', onCan, { once: true });
  };
  tryNext();
}

// === Elements ===
const fullSurah   = document.getElementById('fullSurah');
const fullRate    = document.getElementById('fullRate');
const fullLoop    = document.getElementById('fullLoop');
const downloadMp3 = document.getElementById('downloadMp3');
const startPracticeBtn = document.getElementById('startPractice');
const heroTitle   = document.getElementById('heroTitle');
const heroMeta    = document.getElementById('heroMeta');
const fullTime    = document.getElementById('fullTime');

const player      = document.getElementById('player');
const surahSelect = document.getElementById('surahSelect');
const ayahList    = document.getElementById('ayahList');
const trOut       = document.getElementById('trOut');
const bnOut       = document.getElementById('bnOut');
const surahTitle  = document.getElementById('surahTitle');
const legendPane  = document.getElementById('legend');
const legendBtn   = document.getElementById('legendToggle');
const legendList  = document.getElementById('legendList');
const live        = document.getElementById('live');

const playBtn     = document.getElementById('playBtn');
const pauseBtn    = document.getElementById('pauseBtn');
const restartBtn  = document.getElementById('restartBtn');

// === State ===
let legend = {};
let segments = [];          // [{start,end,ayahIndex,wordIndex}]
let spanRefs = [];          // [[span,...] per ayah]
let activeIdx = { i: -1, j: -1 };

// === Helpers ===
const mmss = s => (!isFinite(s) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`);
const hexAlpha = (hex,a)=>{const c=hex.replace('#','');const n=parseInt(c,16);const r=(n>>16)&255,g=(n>>8)&255,b=n&255;return `rgba(${r},${g},${b},${a})`;};

// === Init ===
(async function init(){
  // legend
  legend = await (await fetch(LEGEND_JSON)).json();
  renderLegend(legend);

  // manifest → dropdown
  const manifest = await (await fetch(MANIFEST_JSON)).json();
  surahSelect.innerHTML = '';
  manifest.surahs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id; opt.textContent = `${s.id} — ${s.name_bn}`;
    surahSelect.appendChild(opt);
  });

  bindTransport();
  await loadSurah(surahSelect.value);

  surahSelect.addEventListener('change', e => loadSurah(e.target.value));
  legendBtn.addEventListener('click', () => toggleLegend());
})();

function bindTransport(){
  playBtn.addEventListener('click', () => player.play());
  pauseBtn.addEventListener('click', () => player.pause());
  restartBtn.addEventListener('click', () => { player.currentTime = 0; player.play(); });

  player.addEventListener('timeupdate', () => {
    if (!segments.length) return;
    const t = player.currentTime;
    // naive linear scan is fine for short surahs
    for (let k=0;k<segments.length;k++){
      const s = segments[k];
      if (t>=s.start && t<s.end){ highlight(s.ayahIndex, s.wordIndex); break; }
    }
  });
  player.addEventListener('ended', clearActive);

  // HERO controls
  fullRate.addEventListener('change', e => {
    const r = parseFloat(e.target.value||'1'); fullSurah.playbackRate = r; player.playbackRate = r;
  });
  fullLoop.addEventListener('change', e => { fullSurah.loop = e.target.checked; });
  fullSurah.addEventListener('timeupdate', () => {
    fullTime.textContent = `${mmss(fullSurah.currentTime)} / ${mmss(fullSurah.duration||0)}`;
  });
  startPracticeBtn?.addEventListener('click', () => {
    fullSurah.pause(); player.currentTime = 0; player.play().catch(()=>{});
    document.querySelector('.panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
  });
}

async function loadSurah(id){
  // reset
  clearActive(); ayahList.innerHTML=''; trOut.textContent=''; bnOut.textContent=''; spanRefs=[]; segments=[];

  // load data first (to get audio_full)
  const data = await (await fetch(SURAH_JSON(id))).json();

  // titles & meta
  surahTitle.textContent = `${data.name_ar} — ${data.name_bn}`;
  heroTitle.textContent  = `${data.name_ar} — ${data.name_bn}`;
  heroMeta.textContent   = `Sūrah ${String(data.surah).toString().padStart(3,'0')} • ${data.verses.length} āyāt`;

  // audio: prefer audio_full from JSON, then CDN backups
  const cdnBackups = buildAudioCandidates(id);
  const candidates = [ data.audio_full, ...cdnBackups ].filter(Boolean);
  setAudioWithFallback(player, candidates, url => { downloadMp3.href = url; });
  setAudioWithFallback(fullSurah, candidates);

  // render Arabic words with basic rule coloring
  data.verses.forEach((ayah,i)=>{
    const li=document.createElement('li'); li.setAttribute('dir','rtl');
    const container=document.createElement('div'); container.className='ayah';
    const spans=(ayah.words||[]).map((w,j)=>{
      const span=document.createElement('span'); span.className='word'; span.textContent=w.ar; span.setAttribute('lang','ar');
      span.dataset.rules=(w.rules||[]).join(',');
      const first=(w.rules||[])[0]; if(first && legend[first]?.color){ span.style.background = hexAlpha(legend[first].color, .18); }
      span.title = ruleTooltip(w);
      span.addEventListener('click', ()=>{
        const seg=segments.find(s=>s.ayahIndex===i && s.wordIndex===j);
        if(seg){ player.currentTime=Math.max(seg.start+.01,0); player.play().catch(()=>{}); }
        announce(`${w.ar} — ${w.tr||''}`); setExplain(ayah);
      });
      return span;
    });
    spans.forEach((s,idx)=>{ container.appendChild(s); if(idx!==spans.length-1) container.appendChild(document.createTextNode(' ')); });
    li.appendChild(container); ayahList.appendChild(li); spanRefs.push(spans);
  });

  if (data.verses[0]) setExplain(data.verses[0]);

  // timings
  try{
    const times = await (await fetch(SURAH_TIMES(id))).json();
    segments = times.map(t=>({start:t.start,end:t.end,ayahIndex:t.ayahIndex,wordIndex:t.wordIndex}));
  } catch { segments = []; }
}

function setExplain(ayah){
  trOut.textContent = (ayah.words||[]).map(w=>w.tr||'').join(' ');
  bnOut.textContent = ayah.bangla || '';
}

function highlight(i,j){
  if(activeIdx.i===i && activeIdx.j===j) return;
  if(activeIdx.i>=0 && activeIdx.j>=0){ spanRefs[activeIdx.i]?.[activeIdx.j]?.classList.remove('active'); }
  const span=spanRefs[i]?.[j]; if(span){ span.classList.add('active'); activeIdx={i,j}; }
}
function clearActive(){ if(activeIdx.i>=0&&activeIdx.j>=0){ spanRefs[activeIdx.i]?.[activeIdx.j]?.classList.remove('active'); } activeIdx={i:-1,j:-1}; }

function renderLegend(obj){
  legendList.innerHTML=''; Object.entries(obj).forEach(([key,val])=>{
    const li=document.createElement('li'); li.className='legend-item';
    const sw=document.createElement('span'); sw.className='legend-swatch'; sw.style.background=val.color||'#2a3140';
    const text=document.createElement('span'); text.innerHTML=`<b>${val.label}</b> — ${val.desc}`;
    li.appendChild(sw); li.appendChild(text); legendList.appendChild(li);
  });
}
function toggleLegend(){ const hidden=legendPane.hasAttribute('hidden'); if(hidden) legendPane.removeAttribute('hidden'); else legendPane.setAttribute('hidden',''); document.getElementById('legendToggle').setAttribute('aria-expanded', String(hidden)); }
function ruleTooltip(w){ const rules=w.rules||[]; if(!rules.length) return `${w.tr||''}`; const parts=rules.map(r=>legend[r]?.label||r); return `${w.tr||''}\nRules: ${parts.join(', ')}`; }
function announce(msg){ live.textContent = msg; }

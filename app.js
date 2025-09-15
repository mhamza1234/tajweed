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

// Build fallback audio candidates (we always try JSON.audio_full first)
function buildAudioCandidates(id) {
  const n = String(parseInt(id,10)), p3 = id.padStart(3,'0');
  return [
    `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${n}.mp3`,
    `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${p3}.mp3`,
    `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${n}.mp3`
  ];
}
function setAudioWithFallback(audioEl, urls, onResolvedUrl) {
  let i = 0;
  const tryNext = () => {
    if (i >= urls.length) return;
    const url = urls[i];
    audioEl.src = url;
    onResolvedUrl?.(url);
    const onError = () => { cleanup(); i++; tryNext(); };
    const onCan = () => cleanup();
    function cleanup(){ audioEl.removeEventListener('error', onError); audioEl.removeEventListener('canplay', onCan); }
    audioEl.addEventListener('error', onError, { once:true });
    audioEl.addEventListener('canplay', onCan, { once:true });
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
const srcHint     = document.getElementById('srcHint');
const alignMinus  = document.getElementById('alignMinus');
const alignPlus   = document.getElementById('alignPlus');

const player      = document.getElementById('player');
const surahSelect = document.getElementById('surahSelect');
const ayahList    = document.getElementById('ayahList');
const trOut       = document.getElementById('trOut');
const bnOut       = document.getElementById('bnOut');
const surahTitle  = document.getElementById('surahTitle');
const legendPane  = document.getElementById('legend');
const legendBtn   = document.getElementById('legendToggle');
const legendList  = document.getElementById('legendList');
const viewToggle  = document.getElementById('viewToggle');
const live        = document.getElementById('live');

const playBtn     = document.getElementById('playBtn');
const pauseBtn    = document.getElementById('pauseBtn');
const restartBtn  = document.getElementById('restartBtn');

const modeWordBtn = document.getElementById('modeWord');
const modeAyahBtn = document.getElementById('modeAyah');
const modeContBtn = document.getElementById('modeCont');
const loopPracticeCb = document.getElementById('loopPractice');

// === State ===
let legend = {};
let segments = [];               // [{start,end,ayahIndex,wordIndex}]
let spanRefs = [];               // [[span,...] per ayah]
let activeIdx = { i:-1, j:-1 };
let currentAyahIndex = 0;
let stackedView = false;
let currentData = null;

// practice modes
let practiceMode = 'word';
let loopPractice = false;

// audio intro offset
let baseOffset = 0;
let resolvedSrc = "";

// === Helpers ===
const mmss = s => (!isFinite(s) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`);
const hexAlpha = (hex,a)=>{const c=hex.replace('#','');const n=parseInt(c,16);const r=(n>>16)&255,g=(n>>8)&255,b=n&255;return `rgba(${r},${g},${b},${a})`;};
function guessIntroOffset(url) {
  try {
    const h = new URL(url).hostname;
    if (h.includes("quranicaudio.com")) return 5.3; // ta'awwudh + basmalah
    if (h.includes("islamic.network")||h.includes("qurancdn.com")||h.includes("quran.com")) return 1.8;
  } catch {}
  return 1.8;
}
function setMode(m){
  practiceMode = m;
  modeWordBtn?.classList.toggle('active', m==='word');
  modeAyahBtn?.classList.toggle('active', m==='ayah');
  modeContBtn?.classList.toggle('active', m==='cont');
}

// inline popup
let openPop;
function showWordPopup(anchorEl, tr, bn){
  if (openPop && openPop.parentNode) openPop.parentNode.removeChild(openPop);
  const pop = document.createElement('div');
  pop.className = 'word-pop';
  pop.innerHTML = `<div class="tr">${tr||''}</div><div class="bn">${bn||''}</div>`;
  document.body.appendChild(pop);
  const r = anchorEl.getBoundingClientRect();
  const y = window.scrollY + r.top - pop.offsetHeight - 8;
  const x = window.scrollX + r.left + (r.width/2) - (pop.offsetWidth/2);
  pop.style.top = `${Math.max(8,y)}px`; pop.style.left = `${Math.max(8,x)}px`;
  openPop = pop;
  const closer = (e)=>{ if(!pop.contains(e.target)){ pop.remove(); document.removeEventListener('click', closer, true);} };
  setTimeout(()=>document.addEventListener('click', closer, true),0);
}

// === Init ===
(async function init(){
  legend = await (await fetch(LEGEND_JSON)).json();
  renderLegend(legend);

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
  viewToggle.addEventListener('click', ()=>{
    stackedView = !stackedView;
    viewToggle.textContent = stackedView ? 'View: Stacked (AR+TR)' : 'View: Arabic only';
    reRenderAyat();
  });
})();

function bindTransport(){
  playBtn.addEventListener('click', () => player.play());
  pauseBtn.addEventListener('click', () => player.pause());
  restartBtn.addEventListener('click', () => { player.currentTime = 0; player.play(); });

  // practice mode buttons
  modeWordBtn?.addEventListener('click', ()=> setMode('word'));
  modeAyahBtn?.addEventListener('click', ()=> setMode('ayah'));
  modeContBtn?.addEventListener('click', ()=> setMode('cont'));
  loopPracticeCb?.addEventListener('change', e => { loopPractice = e.target.checked; });

  // only one player active at a time
  player.addEventListener('play', ()=> fullSurah.pause());
  fullSurah.addEventListener('play', ()=> player.pause());

  // sync highlighting with offset & modes
  player.addEventListener('timeupdate', () => {
    if (!segments.length) return;
    const tEff = Math.max(0, player.currentTime - baseOffset);
    for (let k=0;k<segments.length;k++){
      const s = segments[k];
      if (tEff>=s.start && tEff<s.end){ highlight(s.ayahIndex, s.wordIndex); currentAyahIndex=s.ayahIndex; break; }
    }
    if (practiceMode === 'word' && activeIdx.i>=0 && activeIdx.j>=0){
      const seg = segments.find(x => x.ayahIndex===activeIdx.i && x.wordIndex===activeIdx.j);
      if (seg && tEff >= seg.end - 0.01){
        if (loopPractice) player.currentTime = baseOffset + seg.start + 0.01; else player.pause();
      }
    }
    if (practiceMode === 'ayah' && activeIdx.i>=0){
      const first = segments.find(x => x.ayahIndex===activeIdx.i);
      const last  = [...segments].reverse().find(x => x.ayahIndex===activeIdx.i);
      if (first && last && tEff >= last.end - 0.01){
        if (loopPractice) player.currentTime = baseOffset + first.start + 0.01; else player.pause();
      }
    }
  });
  player.addEventListener('ended', clearActive);

  // hero controls
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

  // manual offset tweak
  alignMinus?.addEventListener('click', ()=>{ baseOffset=Math.max(0,baseOffset-0.5); if(srcHint) srcHint.textContent = `${new URL(resolvedSrc).hostname} • offset: ${baseOffset.toFixed(1)}s`; });
  alignPlus ?.addEventListener('click', ()=>{ baseOffset+=0.5;               if(srcHint) srcHint.textContent = `${new URL(resolvedSrc).hostname} • offset: ${baseOffset.toFixed(1)}s`; });
}

async function loadSurah(id){
  // reset UI state
  clearActive(); ayahList.innerHTML=''; trOut.textContent=''; bnOut.textContent='';
  spanRefs=[]; segments=[]; currentAyahIndex = 0; setMode('word');
  fullSurah.pause(); player.pause();

  // data first
  const data = await (await fetch(SURAH_JSON(id))).json();
  currentData = data;

  surahTitle.textContent = `${data.name_ar} — ${data.name_bn}`;
  heroTitle.textContent  = `${data.name_ar} — ${data.name_bn}`;
  heroMeta.textContent   = `Sūrah ${String(data.surah).toString().padStart(3,'0')} • ${data.verses.length} āyāt`;

  // audio candidates
  const cdnBackups = buildAudioCandidates(id);
  const candidates = [ data.audio_full, ...cdnBackups ].filter(Boolean);

  setAudioWithFallback(player, candidates, url => {
    resolvedSrc = url; baseOffset = guessIntroOffset(url); downloadMp3.href = url;
    if (srcHint) srcHint.textContent = `${new URL(url).hostname} • offset: ${baseOffset.toFixed(1)}s`;
  });
  setAudioWithFallback(fullSurah, candidates, url => {
    if (!resolvedSrc){ resolvedSrc = url; baseOffset = guessIntroOffset(url);
      if (srcHint) srcHint.textContent = `${new URL(url).hostname} • offset: ${baseOffset.toFixed(1)}s`;
    }
  });

  reRenderAyat();
  if (data.verses[0]) { currentAyahIndex = 0; setExplain(data.verses[0]); }

  // timings
  try{
    const times = await (await fetch(SURAH_TIMES(id))).json();
    segments = times.map(t=>({start:t.start,end:t.end,ayahIndex:t.ayahIndex,wordIndex:t.wordIndex}));
  } catch { segments = []; }
}

function reRenderAyat(){
  ayahList.innerHTML=''; spanRefs=[]; clearActive();
  const data = currentData; if (!data) return;

  data.verses.forEach((ayah,i)=>{
    const li=document.createElement('li'); li.setAttribute('dir','rtl');
    const container=document.createElement('div'); container.className='ayah';

    const safeWords = (ayah.words||[]).filter(w => w && (w.ar||'').trim().length);
    if (!safeWords.length){
      if (ayah.arabic_tajweed_html) container.innerHTML = ayah.arabic_tajweed_html;
      else if (ayah.arabic) container.textContent = ayah.arabic;
      else container.textContent = '—';
      li.appendChild(container); ayahList.appendChild(li); spanRefs.push([]); return;
    }

    const spans = safeWords.map((w,j)=>{
      if (!stackedView){
        const span=document.createElement('span'); span.className='word'; span.textContent=w.ar; span.setAttribute('lang','ar');
        const first=(w.rules||[])[0]; if(first && legend[first]?.color){ span.style.background = hexAlpha(legend[first].color, .18); }
        span.addEventListener('click', ()=>{
          const seg=segments.find(s=>s.ayahIndex===i && s.wordIndex===j);
          if(seg){ player.currentTime = Math.max(baseOffset + seg.start + 0.01, 0); player.play().catch(()=>{}); }
          currentAyahIndex = i; setExplain(ayah); showWordPopup(span, w.tr||'', ayah.bangla||'');
        });
        return span;
      } else {
        const wrap=document.createElement('span'); wrap.className='wstack'; wrap.setAttribute('lang','ar');
        const ar=document.createElement('span'); ar.className='ar word'; ar.textContent=w.ar;
        const tr=document.createElement('span'); tr.className='tr'; tr.textContent=w.tr||'';
        const first=(w.rules||[])[0]; if(first && legend[first]?.color){ ar.style.background = hexAlpha(legend[first].color, .18); }
        wrap.appendChild(ar); wrap.appendChild(tr);
        wrap.addEventListener('click', ()=>{
          const seg=segments.find(s=>s.ayahIndex===i && s.wordIndex===j);
          if(seg){ player.currentTime = Math.max(baseOffset + seg.start + 0.01, 0); player.play().catch(()=>{}); }
          currentAyahIndex = i; setExplain(ayah); showWordPopup(wrap, w.tr||'', ayah.bangla||'');
        });
        return wrap;
      }
    });

    spans.forEach((s,idx)=>{ container.appendChild(s); if(!stackedView && idx!==spans.length-1) container.appendChild(document.createTextNode(' ')); });
    li.appendChild(container); ayahList.appendChild(li);
    spanRefs.push(spans.map(el => stackedView ? (el.querySelector('.ar')||el) : el));
  });
}

function setExplain(ayah){
  trOut.textContent = (ayah.words||[]).map(w=>w.tr||'').join(' ');
  bnOut.textContent = ayah.bangla || '';
  const playAyah = ()=>{
    const first = segments.find(x => x.ayahIndex===currentAyahIndex);
    if (!first) return;
    player.currentTime = baseOffset + first.start + 0.01;
    player.play().catch(()=>{});
    setMode('ayah');
  };
  trOut.onclick = playAyah; bnOut.onclick = playAyah;
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

// ======= maps & paths =======
const SHORT_NAMES = {
  "067":"mulk","068":"qalam","069":"haqqah","070":"maarij","071":"nuh",
  "072":"jinn","073":"muzzammil","074":"muddathir","075":"qiyamah","076":"insan","077":"mursalat",
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
const TAFSIR_JSON  = id => `data/tafsir/${id}.json`;
const MAQAM_JSON   = id => `data/maqam/${id}.json`;

// ======= audio fallbacks =======
function buildAudioCandidates(id) {
  const n = String(parseInt(id,10)), p3 = id.padStart(3,'0');
  return [
    `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${n}.mp3`,
    `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${p3}.mp3`,
    `https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/${p3}.mp3`
  ];
}
function setAudioWithFallback(audioEl, urls, onResolvedUrl) {
  let i = 0;
  const tryNext = () => {
    if (i >= urls.length) return;
    const url = urls[i++];
    audioEl.src = url;
    onResolvedUrl?.(url);
    const onError = () => { cleanup(); tryNext(); };
    const onCan = () => cleanup();
    function cleanup(){ audioEl.removeEventListener('error', onError); audioEl.removeEventListener('canplay', onCan); }
    audioEl.addEventListener('error', onError, { once:true });
    audioEl.addEventListener('canplay', onCan, { once:true });
  };
  tryNext();
}

// ======= elements =======
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
const surahTitle  = document.getElementById('surahTitle');
const legendPane  = document.getElementById('legend');
const legendBtn   = document.getElementById('legendToggle');
const legendList  = document.getElementById('legendList');
const viewToggle  = document.getElementById('viewToggle');

const wordPop     = document.getElementById('wordPop');

const playBtn     = document.getElementById('playBtn');
const pauseBtn    = document.getElementById('pauseBtn');
const restartBtn  = document.getElementById('restartBtn');

const modeWordBtn = document.getElementById('modeWord');
const modeAyahBtn = document.getElementById('modeAyah');
const modeContBtn = document.getElementById('modeCont');
const loopPracticeCb = document.getElementById('loopPractice');

const dock        = document.getElementById('dock');
const dockPreview = document.getElementById('dockPreview');
const tabTR       = document.getElementById('tabTR');
const tabBN       = document.getElementById('tabBN');
const dockExpand  = document.getElementById('dockExpand');

const sheet           = document.getElementById('sheet');
const sheetBackdrop   = document.getElementById('sheetBackdrop');
const sheetTitle      = document.getElementById('sheetTitle');
const sheetBody       = document.getElementById('sheetBody');
const sheetClose      = document.getElementById('sheetClose');
const sheetTR         = document.getElementById('sheetTR');
const sheetBN         = document.getElementById('sheetBN');
const sheetTAF        = document.getElementById('sheetTAF');
const surahOverview   = document.getElementById('surahOverview');
const overviewBody    = document.getElementById('overviewBody');
const maqamBox        = document.getElementById('maqamBox');

// ======= state =======
let legend = {};
let segments = [];          // timing segments for words
let spanRefs = [];          // [[span,...] per ayah] for karaoke mode
let activeIdx = { i:-1, j:-1 };
let currentAyahIndex = 0;
let stackedView = false;
let currentData = null;

let practiceMode = 'word';
let loopPractice = false;

let baseOffset = 0;         // intro offset (ta'awwudh + basmalah)
let resolvedSrc = "";
let dockMode = 'TR';

// ======= helpers =======
const mmss = s => (!isFinite(s) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`);
const hexAlpha = (hex,a)=>{const c=hex.replace('#','');const n=parseInt(c,16);const r=(n>>16)&255,g=(n>>8)&255,b=n&255;return `rgba(${r},${g},${b},${a})`;};

// more accurate per-source intro guess (Afasy)
function reciterIntroOffset(url, surahId){
  let host = '';
  try { host = new URL(url).hostname; } catch {}
  const isTawbah = (surahId === '009' || surahId === 9);
  // conservative defaults for Afasy
  if (host.includes('quranicaudio.com')) return isTawbah ? 2.6 : 5.3;
  if (host.includes('islamic.network') || host.includes('qurancdn.com') || host.includes('quran.com')) return isTawbah ? 0.9 : 1.8;
  return isTawbah ? 1.0 : 2.0;
}

function setMode(m){
  practiceMode = m;
  modeWordBtn.classList.toggle('active', m==='word');
  modeAyahBtn.classList.toggle('active', m==='ayah');
  modeContBtn.classList.toggle('active', m==='cont');
}

// ======= init =======
(async function init(){
  legend = await (await fetch(LEGEND_JSON)).json();
  renderLegend(legend);

  const manifest = await (await fetch(MANIFEST_JSON)).json();
  surahSelect.innerHTML = '';
  (manifest.surahs||[]).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = `${s.id} — ${s.name_en} (${s.name_bn})`;
    surahSelect.appendChild(opt);
  });

  bindTransport();
  await loadSurah(surahSelect.value || (manifest.surahs?.[0]?.id ?? '096'));

  surahSelect.addEventListener('change', e => loadSurah(e.target.value));
  legendBtn.addEventListener('click', () => toggleLegend());
  viewToggle.addEventListener('click', ()=>{
    stackedView = !stackedView;
    viewToggle.textContent = stackedView ? 'View: Stacked (AR+TR)' : 'View: Arabic only';
    reRenderAyat();
  });
})();

// ======= transport & interactions =======
function bindTransport(){
  playBtn.addEventListener('click', () => {
    // If user presses Play while at 0, skip intro automatically
    if (Math.abs(player.currentTime) < 0.25) player.currentTime = baseOffset + 0.01;
    player.play();
  });
  pauseBtn.addEventListener('click', () => player.pause());
  restartBtn.addEventListener('click', () => { player.currentTime = baseOffset + 0.01; player.play(); });

  modeWordBtn.addEventListener('click', ()=> setMode('word'));
  modeAyahBtn.addEventListener('click', ()=> setMode('ayah'));
  modeContBtn.addEventListener('click', ()=> setMode('cont'));
  loopPracticeCb.addEventListener('change', e => { loopPractice = e.target.checked; });

  player.addEventListener('play', ()=> fullSurah.pause());
  fullSurah.addEventListener('play', ()=> player.pause());

  player.addEventListener('timeupdate', handlePracticeTick);
  player.addEventListener('ended', clearActive);

  fullRate.addEventListener('change', e => {
    const r = parseFloat(e.target.value||'1'); fullSurah.playbackRate = r; player.playbackRate = r;
  });
  fullLoop.addEventListener('change', e => { fullSurah.loop = e.target.checked; });
  fullSurah.addEventListener('timeupdate', () => {
    fullTime.textContent = `${mmss(fullSurah.currentTime)} / ${mmss(fullSurah.duration||0)}`;
  });
  startPracticeBtn.addEventListener('click', () => {
    fullSurah.pause();
    player.currentTime = baseOffset + 0.01; // drop intro before starting practice
    player.play().catch(()=>{});
    document.querySelector('.panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  // Manual nudge for intro offset (applies immediately)
  alignMinus.addEventListener('click', ()=>{ baseOffset=Math.max(0,baseOffset-0.5); updateSrcHint(); });
  alignPlus .addEventListener('click', ()=>{ baseOffset+=0.5;               updateSrcHint(); });

  // dock / sheet
  tabTR.addEventListener('click', ()=>{ dockMode='TR'; tabTR.classList.add('active'); tabBN.classList.remove('active'); refreshDockPreview(); });
  tabBN.addEventListener('click', ()=>{ dockMode='BN'; tabBN.classList.add('active'); tabTR.classList.remove('active'); refreshDockPreview(); });
  dockExpand.addEventListener('click', ()=> openSheet(dockMode));
  sheetClose.addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  sheetTR.addEventListener('click', ()=> setSheetTab('TR'));
  sheetBN.addEventListener('click', ()=> setSheetTab('BN'));
  sheetTAF.addEventListener('click', ()=> setSheetTab('TAF'));
  dockPreview.addEventListener('click', playCurrentAyah);

  // small: hide popup on scroll
  document.addEventListener('scroll', ()=> hideWordPop(), { passive:true });
}

function handlePracticeTick(){
  if (!segments.length) return;

  // effective time after skipping the intro
  const tEff = Math.max(0, player.currentTime - baseOffset);

  // highlight current word
  for (let k=0;k<segments.length;k++){
    const s = segments[k];
    if (tEff>=s.start && tEff<s.end){ highlight(s.ayahIndex, s.wordIndex); currentAyahIndex=s.ayahIndex; break; }
  }

  // loop logic
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
}

function updateSrcHint(){
  if (!resolvedSrc) return;
  try{ srcHint.textContent = `${new URL(resolvedSrc).hostname} • intro offset: ${baseOffset.toFixed(1)}s`; }catch{}
}
function playCurrentAyah(){
  const first = segments.find(x => x.ayahIndex===currentAyahIndex);
  if (!first) return;
  player.currentTime = baseOffset + first.start + 0.01;
  setMode('ayah'); player.play().catch(()=>{});
}

// ======= load/render =======
async function loadSurah(id){
  clearActive(); ayahList.innerHTML=''; spanRefs=[]; segments=[]; currentAyahIndex=0; setMode('word');
  fullSurah.pause(); player.pause();

  const data = await (await fetch(SURAH_JSON(id))).json();
  currentData = data;

  // titles
  surahTitle.textContent = `${data.name_ar} — ${data.name_en} (${data.name_bn})`;
  heroTitle.textContent  = `${data.name_ar} — ${data.name_en} (${data.name_bn})`;
  heroMeta.textContent   = `Sūrah ${String(data.surah).padStart(3,'0')} • ${data.verses.length} āyāt`;

  // audio (practice + full)
  const candidates = [ data.audio_full, ...buildAudioCandidates(id) ].filter(Boolean);

  setAudioWithFallback(player, candidates, url => {
    resolvedSrc = url;
    baseOffset = reciterIntroOffset(url, data.surah);
    updateSrcHint();
    downloadMp3.href = url;
  });
  setAudioWithFallback(fullSurah, candidates, url => {
    if (!resolvedSrc){
      resolvedSrc = url;
      baseOffset   = reciterIntroOffset(url, data.surah);
      updateSrcHint();
    }
  });

  // overview / maqām (optional)
  renderOverview(String(data.surah).padStart(3,'0'));
  renderMaqam(String(data.surah).padStart(3,'0'));

  reRenderAyat();
  if (data.verses[0]) { currentAyahIndex = 0; setExplain(data.verses[0]); }

  // timings (for karaoke/highlight)
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

    // ==== IMPORTANT: avoid duplicates ====
    // If pre-colored tajwīd HTML exists, use ONLY that.
    if (ayah.arabic_tajweed_html) {
      container.innerHTML = ayah.arabic_tajweed_html;
      li.appendChild(container); ayahList.appendChild(li); spanRefs.push([]);
      return;
    }

    // Otherwise, fall back to words with rule coloring (so karaoke still works)
    const safeWords = (ayah.words||[]).filter(w => w && (w.ar||'').trim().length);
    if (!safeWords.length){
      if (ayah.arabic) container.textContent = ayah.arabic; else container.textContent = '—';
      li.appendChild(container); ayahList.appendChild(li); spanRefs.push([]); return;
    }

    const spans = safeWords.map((w,j)=>{
      if (!stackedView){
        const span=document.createElement('span'); span.className='word'; span.textContent=w.ar; span.setAttribute('lang','ar');
        const first=(w.rules||[])[0]; if(first && legend[first]?.color){ span.style.background = hexAlpha(legend[first].color, .18); }
        span.addEventListener('click', (ev)=>{
          const seg=segments.find(s=>s.ayahIndex===i && s.wordIndex===j);
          if(seg){ player.currentTime = Math.max(baseOffset + seg.start + 0.01, 0); player.play().catch(()=>{}); }
          currentAyahIndex = i; setExplain(ayah); showWordPop(ev.currentTarget, w.tr||'', ayah.bangla||'');
        });
        return span;
      } else {
        const wrap=document.createElement('span'); wrap.className='wstack'; wrap.setAttribute('lang','ar');
        const ar=document.createElement('span'); ar.className='ar word'; ar.textContent=w.ar;
        const tr=document.createElement('span'); tr.className='tr'; tr.textContent=w.tr||'';
        const first=(w.rules||[])[0]; if(first && legend[first]?.color){ ar.style.background = hexAlpha(legend[first].color, .18); }
        wrap.appendChild(ar); wrap.appendChild(tr);
        wrap.addEventListener('click', (ev)=>{
          const seg=segments.find(s=>s.ayahIndex===i && s.wordIndex===j);
          if(seg){ player.currentTime = Math.max(baseOffset + seg.start + 0.01, 0); player.play().catch(()=>{}); }
          currentAyahIndex = i; setExplain(ayah); showWordPop(ev.currentTarget, w.tr||'', ayah.bangla||'');
        });
        return wrap;
      }
    });

    spans.forEach((s,idx)=>{ container.appendChild(s); if(!stackedView && idx!==spans.length-1) container.appendChild(document.createTextNode(' ')); });
    li.appendChild(container); ayahList.appendChild(li);
    spanRefs.push(spans.map(el => stackedView ? (el.querySelector('.ar')||el) : el));
  });
}

function highlight(i,j){
  if(activeIdx.i===i && activeIdx.j===j) return;
  if(activeIdx.i>=0 && activeIdx.j>=0){ spanRefs[activeIdx.i]?.[activeIdx.j]?.classList.remove('active'); }
  const span=spanRefs[i]?.[j]; if(span){ span.classList.add('active'); activeIdx={i,j}; }
}
function clearActive(){
  if(activeIdx.i>=0&&activeIdx.j>=0){ spanRefs[activeIdx.i]?.[activeIdx.j]?.classList.remove('active'); }
  activeIdx={i:-1,j:-1};
}

// ======= legend / overview / maqam =======
function renderLegend(obj){
  legendList.innerHTML=''; Object.entries(obj).forEach(([key,val])=>{
    const li=document.createElement('li'); li.className='legend-item';
    const sw=document.createElement('span'); sw.className='legend-swatch'; sw.style.background=val.color||'#2a3140';
    const text=document.createElement('span'); text.innerHTML=`<b>${val.label}</b> — ${val.desc}`;
    li.appendChild(sw); li.appendChild(text); legendList.appendChild(li);
  });
}
function toggleLegend(){
  const hidden=legendPane.hasAttribute('hidden');
  if(hidden) legendPane.removeAttribute('hidden'); else legendPane.setAttribute('hidden','');
  document.getElementById('legendToggle').setAttribute('aria-expanded', String(hidden));
}
async function renderOverview(id){
  try{
    const res = await fetch(TAFSIR_JSON(id));
    if (!res.ok) { overviewBody.textContent = '—'; return; }
    const t = await res.json();
    const head = `<div class="mono" style="opacity:.75">${t.source?.name||''} • ${t.source?.lang||''}</div>`;
    const sum = (t.summary||'').split(/\n+/).map(p=>`<p>${p}</p>`).join('');
    const secs = (t.sections||[]).map(s=>`<h4>${s.title}</h4><p>${s.body}</p>`).join('');
    overviewBody.innerHTML = head + sum + secs;
    if (window.innerWidth >= 1024) surahOverview.open = true; else surahOverview.open = false;
  }catch{ overviewBody.textContent = '—'; }
}
async function renderMaqam(id){
  try{
    const r = await fetch(MAQAM_JSON(id));
    if (!r.ok){ maqamBox.textContent='—'; return; }
    const m = await r.json();
    maqamBox.innerHTML = `<b>${m.melody||'—'}</b> — ${m.desc||''}`;
  }catch{ maqamBox.textContent='—'; }
}

// ======= dock & sheet =======
function setExplain(ayah){
  const tr = (ayah.words||[]).map(w=>w.tr||'').join(' ');
  const bn = ayah.bangla || '';

  dock.hidden = false;
  dockPreview.textContent = (dockMode==='TR' ? tr : bn) || '—';

  dockExpand.onclick = ()=> openSheet(dockMode);
  sheetTitle.textContent = `Āyah ${ayah.ayah_id}`;
  sheetTR.dataset.text = tr;
  sheetBN.dataset.text = bn;
}
function refreshDockPreview(){
  const ayah = currentData?.verses?.[currentAyahIndex];
  if (!ayah) return;
  dockPreview.textContent = (dockMode==='TR' ? (sheetTR.dataset.text||'') : (sheetBN.dataset.text||'')) || '—';
}
function openSheet(which='TR'){
  sheet.hidden = false; sheetBackdrop.hidden = false;
  sheet.setAttribute('data-open','true');
  setSheetTab(which);
}
function closeSheet(){
  sheet.removeAttribute('data-open'); sheet.hidden = true; sheetBackdrop.hidden = true;
}
function setSheetTab(which){
  [sheetTR, sheetBN, sheetTAF].forEach(b=>b.classList.remove('active'));
  if (which==='TR'){ sheetTR.classList.add('active'); sheetBody.textContent = sheetTR.dataset.text || '—'; }
  else if (which==='BN'){ sheetBN.classList.add('active'); sheetBody.textContent = sheetBN.dataset.text || '—'; }
  else {
    sheetTAF.classList.add('active');
    const id = String(currentData?.surah||'').padStart(3,'0');
    renderTafsirForSurah(id).then(html => { sheetBody.innerHTML = html || '<em>No tafsīr available.</em>'; });
  }
}
async function renderTafsirForSurah(id){
  try{
    const r = await fetch(TAFSIR_JSON(id));
    if(!r.ok) return '';
    const t = await r.json();
    const head = `<div class="mono" style="opacity:.75">${t.source?.name||''} • ${t.source?.lang||''}</div>`;
    const sum  = (t.summary||'').split(/\n+/).map(p=>`<p>${p}</p>`).join('');
    const secs = (t.sections||[]).map(s=>`<h4>${s.title}</h4><p>${s.body}</p>`).join('');
    return head + sum + secs;
  }catch{return '';}
}

// ======= inline word popup =======
function showWordPop(anchorEl, tr, bn){
  const pop = wordPop;
  pop.querySelector('.tr').textContent = tr||'';
  pop.querySelector('.bn').textContent = bn||'';
  pop.hidden = false;
  const r = anchorEl.getBoundingClientRect();
  const y = window.scrollY + r.top - pop.offsetHeight - 8;
  const x = window.scrollX + r.left + (r.width/2) - (pop.offsetWidth/2);
  pop.style.top = `${Math.max(8,y)}px`; pop.style.left = `${Math.max(8,x)}px`;
  const closer = (e)=>{ if(!pop.contains(e.target)){ hideWordPop(); document.removeEventListener('click', closer, true);} };
  setTimeout(()=>document.addEventListener('click', closer, true),0);
}
function hideWordPop(){ wordPop.hidden = true; }

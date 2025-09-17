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
const inlineLegendHolder = document.getElementById('inlineLegendHolder');
const surahTitle  = document.getElementById('surahTitle');
const legendPane  = document.getElementById('legend');
const legendBtn   = document.getElementById('legendToggle');
const legendList  = document.getElementById('legendList');
const viewToggle  = document.getElementById('viewToggle');

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

// Flashcards
const openFlashBtn = document.getElementById('openFlash');
const closeFlashBtn= document.getElementById('closeFlash');
const flashPanel   = document.getElementById('flash');
const flashBack    = document.getElementById('flashBack');
const flashTitle   = document.getElementById('flashTitle');
const onlyAyahCb   = document.getElementById('onlyAyah');
const nextFlashBtn = document.getElementById('nextFlash');
const prevFlashBtn = document.getElementById('prevFlash');
const shuffleFlashBtn = document.getElementById('shuffleFlash');
const flashAr = document.getElementById('flashAr');
const flashTR = document.getElementById('flashTR');
const flashBN = document.getElementById('flashBN');
const flashChips = document.getElementById('flashChips');
const flashLegend = document.getElementById('flashLegend');
const flashAudio  = document.getElementById('flashAudio');

// ======= state =======
let legend = {};
let segments = [];              // timing segments (word level)
let wordRefs = [];              // [ [wordSpan, ...] per āyah ]
let ayahEls = [];               // visible tajwīd line per āyah
let activeIdx = { i:-1, j:-1 }; // current i/j
let lastAyahIndex = -1;
let currentAyahIndex = 0;
let stackedView = false;
let currentData = null;

let practiceMode = 'word';
let loopPractice = false;

let baseOffset = 0;
let resolvedSrc = "";
let dockMode = 'TR';

// Flashcards state
let deck = []; // [{i,j,html,tr,bn,audio,tags}]
let deckPos = 0;

// ======= helpers =======
const mmss = s => (!isFinite(s) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`);

function reciterIntroOffset(url, surahId){
  let host = '';
  try { host = new URL(url).hostname; } catch {}
  const isTawbah = (String(surahId).padStart(3,'0') === '009');
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

// Wrap visible tajwīd HTML into word spans so we can click/highlight
function wrapTajweedIntoWords(container, ayahIndex){
  const endNumber = container.querySelector('span.end');
  if (endNumber) endNumber.remove();

  const nodes = Array.from(container.childNodes);
  container.textContent = '';

  const makeWord = () => {
    const w = document.createElement('span');
    w.className = 'word';
    w.setAttribute('lang','ar');
    return w;
  };

  const spans = [];
  let current = makeWord();
  container.appendChild(current);
  spans.push(current);

  const pushSpace = () => { container.appendChild(document.createTextNode(' ')); };
  const newWord = () => { current = makeWord(); pushSpace(); container.appendChild(current); spans.push(current); };

  const appendNode = (n) => {
    current.appendChild(n.nodeType === Node.TEXT_NODE ? document.createTextNode(n.textContent) : n);
  };

  nodes.forEach(node=>{
    if (node.nodeType === Node.TEXT_NODE){
      const parts = node.textContent.split(/(\s+)/);
      parts.forEach(part=>{
        if (/\s+/.test(part)) newWord();
        else if (part.length) appendNode({nodeType:Node.TEXT_NODE, textContent:part});
      });
    } else {
      if (!(node.nodeType === Node.ELEMENT_NODE && node.classList.contains('end'))) appendNode(node);
    }
  });

  // merge sajdah sign "۩"
  for (let i=1;i<spans.length;i++){
    const t = spans[i].textContent.trim();
    if (t==='۩'){
      container.insertBefore(document.createTextNode(' '), spans[i]);
      while(spans[i].firstChild){ spans[i-1].appendChild(spans[i].firstChild); }
      container.removeChild(spans[i]);
      spans.splice(i,1); i--;
    }
  }
  while (spans.length && spans[spans.length-1].textContent.trim()===''){
    const s = spans.pop(); container.removeChild(s);
  }

  spans.forEach((el, j)=>{
    el.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const seg = segments.find(s => s.ayahIndex===ayahIndex && s.wordIndex===j);
      if (seg){
        player.currentTime = baseOffset + seg.start + 0.01;
        player.play().catch(()=>{});
        highlightWord(ayahIndex, j);
      }
    });
  });

  return spans;
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
  bindFlashcards();

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
    if (player.currentTime < baseOffset) player.currentTime = baseOffset + 0.01;
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
    player.currentTime = baseOffset + 0.01;
    player.play().catch(()=>{});
    document.querySelector('.panel')?.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  alignMinus.addEventListener('click', ()=>{ baseOffset=Math.max(0,baseOffset-0.5); updateSrcHint(); });
  alignPlus .addEventListener('click', ()=>{ baseOffset+=0.5;               updateSrcHint(); });

  tabTR.addEventListener('click', ()=>{ dockMode='TR'; tabTR.classList.add('active'); tabBN.classList.remove('active'); refreshDockPreview(); });
  tabBN.addEventListener('click', ()=>{ dockMode='BN'; tabBN.classList.add('active'); tabTR.classList.remove('active'); refreshDockPreview(); });
  dockExpand.addEventListener('click', ()=> openSheet(dockMode));
  sheetClose.addEventListener('click', closeSheet);
  sheetBackdrop.addEventListener('click', closeSheet);
  sheetTR.addEventListener('click', ()=> setSheetTab('TR'));
  sheetBN.addEventListener('click', ()=> setSheetTab('BN'));
  sheetTAF.addEventListener('click', ()=> setSheetTab('TAF'));
  document.addEventListener('scroll', ()=> {/* no-op popup now */}, { passive:true });
}

function handlePracticeTick(){
  if (!segments.length) return;
  const tEff = Math.max(0, player.currentTime - baseOffset);

  for (let k=0;k<segments.length;k++){
    const s = segments[k];
    if (tEff>=s.start && tEff<s.end){
      if (practiceMode === 'word') highlightWord(s.ayahIndex, s.wordIndex);
      if (lastAyahIndex !== s.ayahIndex){
        lastAyahIndex = s.ayahIndex;
        currentAyahIndex = s.ayahIndex;
        setExplain(currentData.verses[s.ayahIndex]);
        setActiveAyah(s.ayahIndex);
      }
      break;
    }
  }

  if (practiceMode === 'word' && activeIdx.i>=0 && activeIdx.j>=0){
    const seg = segments.find(x => x.ayahIndex===activeIdx.i && x.wordIndex===activeIdx.j);
    if (seg && tEff >= seg.end - 0.01){
      if (loopPractice) player.currentTime = baseOffset + seg.start + 0.01; else player.pause();
    }
  }
  if (practiceMode === 'ayah' && lastAyahIndex>=0){
    const first = segments.find(x => x.ayahIndex===lastAyahIndex);
    const last  = [...segments].reverse().find(x => x.ayahIndex===lastAyahIndex);
    if (first && last && tEff >= last.end - 0.01){
      if (loopPractice) player.currentTime = baseOffset + first.start + 0.01; else player.pause();
    }
  }
}

function highlightWord(i,j){
  if (activeIdx.i===i && activeIdx.j===j) return;
  if (activeIdx.i>=0 && activeIdx.j>=0){
    wordRefs[activeIdx.i]?.[activeIdx.j]?.classList.remove('word-active');
  }
  const el = wordRefs[i]?.[j];
  if (el){ el.classList.add('word-active'); activeIdx = {i,j}; }
  setActiveAyah(i);
}

function updateSrcHint(){
  if (!resolvedSrc) return;
  try{ srcHint.textContent = `${new URL(resolvedSrc).hostname} • intro offset: ${baseOffset.toFixed(1)}s`; }catch{}
}

// ======= load/render =======
async function loadSurah(id){
  clearActive();
  ayahList.innerHTML=''; ayahEls=[]; wordRefs=[]; segments=[]; currentAyahIndex=0; lastAyahIndex=-1;
  inlineLegendHolder.innerHTML = '';
  fullSurah.pause(); player.pause();

  const data = await (await fetch(SURAH_JSON(id))).json();
  currentData = data;

  surahTitle.textContent = `${data.name_ar} — ${data.name_en} (${data.name_bn})`;
  heroTitle.textContent  = `${data.name_ar} — ${data.name_en} (${data.name_bn})`;
  heroMeta.textContent   = `Sūrah ${String(data.surah).padStart(3,'0')} • ${data.verses.length} āyāt`;

  const candidates = [ data.audio_full, ...buildAudioCandidates(id) ].filter(Boolean);
  setAudioWithFallback(player, candidates, url => { resolvedSrc = url; baseOffset = reciterIntroOffset(url, data.surah); updateSrcHint(); downloadMp3.href = url; });
  setAudioWithFallback(fullSurah, candidates, url => { if (!resolvedSrc){ resolvedSrc=url; baseOffset=reciterIntroOffset(url, data.surah); updateSrcHint(); } });

  renderOverview(String(data.surah).padStart(3,'0'));
  renderMaqam(String(data.surah).padStart(3,'0'));

  reRenderAyat();
  if (data.verses[0]) { currentAyahIndex = 0; setExplain(data.verses[0]); }

  try{
    const times = await (await fetch(SURAH_TIMES(id))).json();
    segments = times.map(t=>({start:t.start,end:t.end,ayahIndex:t.ayahIndex,wordIndex:t.wordIndex}));
  } catch { segments = []; }

  // Build flashcard legend list UI
  renderFlashLegend();
  // Rebuild deck (whole sūrah by default)
  buildDeck();
}

function reRenderAyat(){
  ayahList.innerHTML=''; ayahEls=[]; wordRefs=[]; clearActive();
  const data = currentData; if (!data) return;

  data.verses.forEach((ayah,i)=>{
    const li=document.createElement('li'); li.setAttribute('dir','rtl');
    const line=document.createElement('div'); line.className='ayah'; line.dataset.ayahIndex = i;

    if (ayah.arabic_tajweed_html) line.innerHTML = ayah.arabic_tajweed_html;
    else if (ayah.arabic) line.textContent = ayah.arabic;
    else line.textContent = '—';

    line.addEventListener('click', ()=>{
      const first = segments.find(x => x.ayahIndex===i);
      if (first){ player.currentTime = baseOffset + first.start + 0.01; player.play().catch(()=>{}); }
      currentAyahIndex = i;
      setExplain(ayah);
      setActiveAyah(i);
    });

    li.appendChild(line);
    ayahList.appendChild(li);
    ayahEls.push(line);

    const spans = wrapTajweedIntoWords(line, i);
    wordRefs.push(spans);
  });

  renderInlineLegend();
}

function setActiveAyah(i){
  ayahEls.forEach(el => el.classList.remove('ayah-active'));
  const el = ayahEls[i];
  if (el) el.classList.add('ayah-active');
}

function clearActive(){
  ayahEls.forEach(el => el.classList.remove('ayah-active'));
  wordRefs.forEach(arr => arr?.forEach(w => w.classList.remove('word-active')));
  activeIdx={i:-1,j:-1}; lastAyahIndex=-1;
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
function renderInlineLegend(){
  const box = document.createElement('div');
  box.className = 'inline-legend';
  box.innerHTML = `<h4 dir="ltr">Tajwīd legend</h4>`;
  const ul = document.createElement('ul');
  Object.entries(legend).forEach(([k,v])=>{
    const li = document.createElement('li');
    const sw = document.createElement('span'); sw.className='legend-swatch';
    sw.style.background = v.color||'#2a3140';
    const txt = document.createElement('span'); txt.innerHTML = `<b>${v.label}</b> — ${v.desc}`;
    li.appendChild(sw); li.appendChild(txt); ul.appendChild(li);
  });
  box.appendChild(ul);
  inlineLegendHolder.innerHTML = '';
  inlineLegendHolder.appendChild(box);
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

// ======= FLASHCARDS =======
function bindFlashcards(){
  openFlashBtn.addEventListener('click', ()=>{ flashPanel.hidden=false; flashBack.hidden=false; deckPos=0; showCard(); });
  closeFlashBtn.addEventListener('click', closeFlash);
  flashBack.addEventListener('click', closeFlash);
  onlyAyahCb.addEventListener('change', ()=>{ buildDeck(); deckPos=0; showCard(); });
  nextFlashBtn.addEventListener('click', ()=>{ if(!deck.length) return; deckPos=(deckPos+1)%deck.length; showCard(); });
  prevFlashBtn.addEventListener('click', ()=>{ if(!deck.length) return; deckPos=(deckPos-1+deck.length)%deck.length; showCard(); });
  shuffleFlashBtn.addEventListener('click', ()=>{ shuffle(deck); deckPos=0; showCard(); });
}
function closeFlash(){ flashPanel.hidden=true; flashBack.hidden=true; flashAudio.pause(); }

function buildDeck(){
  deck = [];
  if (!currentData || !wordRefs.length) return;
  const onlyAyah = onlyAyahCb?.checked;
  const fromAyah = onlyAyah ? currentAyahIndex : 0;
  const toAyah   = onlyAyah ? currentAyahIndex : (currentData.verses.length-1);

  for (let i=fromAyah;i<=toAyah;i++){
    const ayah = currentData.verses[i];
    const bn   = ayah.bangla || '';
    const words = ayah.words || [];
    const refs  = wordRefs[i] || [];
    for (let j=0;j<refs.length;j++){
      const ref = refs[j];
      const wordObj = words[j] || {};
      // take the exact tajwīd-colored HTML from the rendered word
      const html = ref.innerHTML || ref.textContent || '';
      // collect tajwīd classes used inside this word
      const tagSet = new Set();
      ref.querySelectorAll('tajweed').forEach(t => {
        for (const cl of t.classList) tagSet.add(cl);
      });
      const audio = wordObj.wbw_audio || '';
      deck.push({
        i, j, html,
        tr: wordObj.tr || '',
        bn,
        audio,
        tags: [...tagSet]
      });
    }
  }
  flashTitle.textContent = `${currentData.name_en} (${currentData.name_bn}) • ${deck.length} words`;
}

function showCard(){
  if (!deck.length){
    flashAr.innerHTML = '—';
    flashTR.textContent = '—';
    flashBN.textContent = '—';
    flashChips.innerHTML = '';
    flashAudio.src = '';
    return;
  }
  const c = deck[deckPos];
  flashAr.innerHTML = c.html;  // tajwīd-colored word
  flashTR.textContent = c.tr || '—';
  flashBN.textContent = c.bn || '—';

  // chips
  flashChips.innerHTML = '';
  c.tags.forEach(k=>{
    const meta = legend[k];
    const chip = document.createElement('span'); chip.className='chip';
    const sw = document.createElement('span'); sw.className='sw'; sw.style.background = meta?.color || '#2a3140';
    const lbl = document.createElement('span'); lbl.innerHTML = meta ? `<b>${meta.label}</b>` : k;
    chip.appendChild(sw); chip.appendChild(lbl);
    flashChips.appendChild(chip);
  });
  // audio
  if (c.audio){
    flashAudio.src = c.audio;
    // try to play (ignore promise rejection if blocked)
    flashAudio.play().catch(()=>{});
  } else {
    flashAudio.removeAttribute('src'); flashAudio.load();
  }
}

function renderFlashLegend(){
  flashLegend.innerHTML = '';
  Object.entries(legend).forEach(([k,v])=>{
    const li = document.createElement('li');
    const sw = document.createElement('span'); sw.className='legend-swatch'; sw.style.background=v.color||'#2a3140';
    const txt = document.createElement('span'); txt.innerHTML = `<b>${v.label}</b> — ${v.desc}`;
    li.appendChild(sw); li.appendChild(txt);
    flashLegend.appendChild(li);
  });
}
function shuffle(a){
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
}

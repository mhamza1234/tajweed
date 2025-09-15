// === Config ===
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
const

const $ = (s) => document.querySelector(s);
const app = $('#app');
const copy = {
 ko: {
  private:'개인 연습용 프로토타입', heroKicker:'YOUR CLASS, YOUR LISTENING LAB', heroTitle:'내 수업을 다시 듣고,\n영어를 더 선명하게.', heroBody:'수업 녹음과 AI 자막을 불러오면 선생님의 말을 한 줄씩 듣고 직접 받아쓸 수 있어요. 필요한 만큼 반복하고, 막히는 단어에는 작은 힌트를 받아보세요.', step1:'01 파일 불러오기',step2:'02 듣고 받아쓰기',step3:'03 결과 살펴보기',loadTitle:'수업 파일 불러오기',loadBody:'수업 음원 파일과 자막 파일을 하나씩 준비해 주세요.',dropTitle:'파일 두 개를 여기로 끌어오세요',dropBody:'m4a 또는 mp3 음원 + vtt 또는 txt 대본',audioFile:'오디오 선택',transcriptFile:'자막 선택',or:'또는',urlTitle:'온라인 파일 URL로 불러오기',audioUrl:'오디오 URL (m4a / mp3)',textUrl:'자막 URL (vtt / txt)',loadUrls:'URL에서 불러오기',sample:'샘플 화면 체험하기 →',selectBoth:'오디오와 자막 파일을 모두 선택해 주세요.',cors:'온라인 파일은 해당 서버에서 브라우저 접근(CORS)을 허용해야 합니다.',ready:'준비 완료',choosePractice:'연습 범위',all:'전체 구간',long5:'구간 5개',long10:'구간 10개',long15:'구간 15개',start:'연습 시작',feature1:'한 줄씩 집중',feature1b:'선생님의 자막을 하나씩 연습해요.',feature2:'필요할 때 힌트',feature2b:'글자 수, 첫 글자, 단어 순서로 확인해요.',feature3:'부담 없는 확인',feature3b:'AI 자막과 얼마나 비슷한지 살펴봐요.',back:'파일 변경',summary:'요약 보기',session:'듣기 연습',teacherLine:'선생님 자막',sampleNoAudio:'샘플 화면에는 오디오가 없습니다. 실제 파일을 불러오면 재생할 수 있어요.',caption:'자막',progress:'진행',score:'평균 일치도',pass:'통과',play:'재생',pause:'일시정지',loop:'반복',slow:'속도',write:'들은 내용을 적어 보세요',writeSub:'문장부호와 대소문자는 점수에 영향을 주지 않아요.',writePlaceholder:'선생님이 말한 내용을 여기에 입력하세요…',hint:'힌트 보기',hideHint:'힌트 닫기',check:'확인하기',next:'다음 자막',finish:'연습 마치기',hintTitle:'단어 힌트',hintLeft:'남은 힌트',hintHelp:'궁금한 위치를 누르세요. 글자 수 → 첫 글자 → AI가 인식한 단어 순서로 보입니다. 누를 때마다 힌트 1개를 사용해요.',aiNotice:'이 단어는 AI 자동 자막을 기준으로 한 힌트이며 실제 음성과 다를 수 있어요.',similarity:'AI 자막과의 일치도',passed:'통과했어요',tryAgain:'다시 들어보세요',reference:'AI 자막',reviewCaveat:'AI 자막에 오류가 있을 수 있어요. 이 점수는 참고용입니다.',items:'연습 자막',itemsBody:'원하는 자막으로 바로 이동할 수 있어요.',sampleTag:'샘플',done:'완료',summaryTitle:'오늘의 연습을 마쳤어요',summaryBody:'수고했어요. 일치도는 AI 자막을 기준으로 계산했으므로, 실제로 들린 말과 다르면 자막 오류일 수도 있어요.',completed:'완료한 자막',avg:'평균 일치도',restart:'다시 연습하기',newFiles:'다른 파일 불러오기',none:'아직 확인하지 않음',offline:'연습 기록은 이 브라우저에 저장됩니다. 선택한 파일은 서버에 업로드하지 않습니다.', noTeacher:'선생님 자막을 찾지 못했습니다. 파일 형식과 화자 표기를 확인해 주세요.', urlFail:'URL 파일을 불러오지 못했습니다. 주소와 CORS 설정을 확인해 주세요.', fileFail:'자막을 읽지 못했습니다.',words:'단어',seconds:'초',sampleAudio:'오디오 없음', unknown:'선생님', threshold:'80% 이상 통과', incomplete:'입력한 내용을 먼저 확인해 보세요.'
 }
};
const state = {view:'home',audioFile:null,textFile:null,audioUrl:null,textName:'',format:'',cues:[],selected:[],index:0,answers:{},results:{},hints:{},hintOpen:false,loop:false,playing:false,error:'',sample:false};
const t = (k) => copy.ko[k] || k;
const esc = (x) => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mmss = (x) => {x=Math.max(0,Math.floor(x||0));return `${String(Math.floor(x/60)).padStart(2,'0')}:${String(x%60).padStart(2,'0')}`};
const duration = (x) => `${Math.max(1,Math.round(x.end-x.start))} ${t('seconds')}`;
const wordTokens = (x) => (x.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)||[]);
function parseTime(x){let p=x.replace(',','.').split(':').map(Number);return p.reduce((n,v)=>n*60+v,0)}
function parseTranscript(text, format){
 const blocks=text.replace(/^\uFEFF/,'').replace(/\r/g,'').split(/\n\s*\n/), cues=[];
 for(const block of blocks){const lines=block.trim().split('\n');const ti=lines.findIndex(x=>/-->/.test(x));if(ti<0)continue;
  const m=lines[ti].match(/(\d{1,2}:\d{2}(?::\d{2})?[.,]\d+)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d+)/);if(!m)continue;
  const raw=lines.slice(ti+1).join(' ').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();const sm=raw.match(/^([^:]{1,80}):\s*(.*)$/);if(!sm)continue;
  const speaker=sm[1].trim(),content=sm[2].trim();if(!content)continue;
  const student=format==='txt'?/^\d+$/.test(speaker):/\sST$/i.test(speaker);
  cues.push({id:cues.length+1,start:parseTime(m[1]),end:parseTime(m[2]),speaker,text:content,student});
 }
 return cues.filter(c=>!c.student&&c.end>c.start);
}
const sampleText=`WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.500\nTeacher: How was your weekend? Did you go anywhere interesting?\n\n2\n00:00:06.000 --> 00:00:09.000\nStudent ST: I stayed at home.\n\n3\n00:00:09.200 --> 00:00:15.800\nTeacher: Sometimes a quiet weekend is exactly what we need before a busy week.\n\n4\n00:00:16.000 --> 00:00:22.800\nTeacher: Let us look at three expressions you can use when you make a phone call.\n\n5\n00:00:23.000 --> 00:00:27.900\nStudent ST: Okay, I am ready.\n\n6\n00:00:28.000 --> 00:00:33.900\nTeacher: The first expression is, may I speak to the person in charge?\n\n7\n00:00:34.200 --> 00:00:43.000\nTeacher: If someone is not available, you can ask when a convenient time to call back would be.\n\n8\n00:00:43.200 --> 00:00:48.900\nTeacher: Please make your own sentence using the expression we just practiced.`;
function shell(content){
 const dark=document.documentElement.dataset.theme==='dark';
 const themeName=(dark?'다크':'라이트');
 const themeAction=(dark?'라이트 모드로 전환':'다크 모드로 전환');
 app.innerHTML=`<div class="app-shell"><header class="topbar"><button class="brand" type="button" data-action="home" aria-label="${('MintScribe 메인으로 이동')}"><span class="brand-mark">↝</span> MintScribe 2.0</button><div class="top-actions"><span class="tag">${t('private')}</span><a class="site-return" href="https://story.mint05.com" aria-label="${('민트 홈페이지로 이동')}" title="${('민트 홈페이지로 이동')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg><span>${('민트 홈')}</span></a><button class="theme-toggle" type="button" data-action="theme" aria-label="${themeAction}" title="${themeAction}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6m-5 3h4m-5.2-6.5A7 7 0 1 1 15.2 14.5c-.8.7-1.2 1.5-1.2 2.5h-4c0-1-.4-1.8-1.2-2.5Z"/></svg><span>${themeName}</span></button></div></header>${content}</div>`;
}
function renderHome(){state.view='home';shell(`<main class="page"><div class="hero"><section class="hero-copy"><div><span class="eyebrow">${t('heroKicker')}</span><h1>${t('heroTitle').replace('\n','<br>')}</h1><p>${t('heroBody')}</p></div><div class="hero-steps"><span>${t('step1')}</span><span>${t('step2')}</span><span>${t('step3')}</span></div></section><section class="load-panel"><div class="section-heading"><div><div class="eyebrow">GET STARTED</div><h2>${t('loadTitle')}</h2><p>${t('loadBody')}</p></div><span class="step-num">01</span></div><div id="drop" class="drop-zone"><div class="upload-icon">⇧</div><strong>${t('dropTitle')}</strong><p>${t('dropBody')}</p><div class="file-buttons"><button class="secondary-btn" data-action="audioPick">♪ ${t('audioFile')}</button><button class="secondary-btn" data-action="textPick">≡ ${t('transcriptFile')}</button></div></div><input id="audioInput" class="hidden" type="file" accept=".m4a,.mp3,audio/*"><input id="textInput" class="hidden" type="file" accept=".vtt,.txt,text/plain,text/vtt"><div class="file-status"><div class="file-line"><b>♪ ${esc(state.audioFile?.name||'—')}</b><span>m4a / mp3</span></div><div class="file-line"><b>≡ ${esc(state.textFile?.name||'—')}</b><span>vtt / txt</span></div></div><div class="divider">${t('or')}</div><div class="url-title">⌁ ${t('urlTitle')}</div><div class="url-fields"><input class="text-input" id="audioUrl" type="url" placeholder="${t('audioUrl')}" value="${esc(state.audioUrlInput||'')}"><input class="text-input" id="textUrl" type="url" placeholder="${t('textUrl')}" value="${esc(state.textUrlInput||'')}"></div><button class="secondary-btn wide" data-action="urlLoad">${t('loadUrls')}</button><p class="helper" style="margin-top:9px">${t('cors')}</p><div style="margin-top:17px"><div class="url-title">${t('choosePractice')}</div>${scopeSelect()}</div>${state.audioFile&&state.textFile?`<div style="margin-top:17px"><button class="primary-btn wide" data-action="start">${t('start')} →</button></div>`:''}${state.error?`<div class="notice error" role="alert">${esc(state.error)}</div>`:''}<button class="sample-link" data-action="sample">${t('sample')}</button><p class="helper">${t('offline')}</p></section></div><div class="features"><div class="feature"><span class="feature-icon">◎</span><b>${t('feature1')}</b><p>${t('feature1b')}</p></div><div class="feature"><span class="feature-icon">✧</span><b>${t('feature2')}</b><p>${t('feature2b')}</p></div><div class="feature"><span class="feature-icon">↗</span><b>${t('feature3')}</b><p>${t('feature3b')}</p></div></div></main>`);bindHome()}
function scopeSelect(){
 const options=state.urlScope?(state.urlScope==='all'?['all']:['all',state.urlScope]):['all','5','10','15'];
 const selected=options.includes(state.scope)?state.scope:(state.urlScope||'10');
 return `<select id="scope" class="text-input">${options.map(value=>`<option value="${value}" ${selected===value?'selected':''}>${t(value==='all'?'all':`long${value}`)}</option>`).join('')}</select>`;
}
function bindHome(){
 const drop=$('#drop');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');receiveFiles(e.dataTransfer.files)});
 $('#audioInput').addEventListener('change',e=>receiveFiles(e.target.files));$('#textInput').addEventListener('change',e=>receiveFiles(e.target.files));
}
function receiveFiles(files){if(window.MintScribeLaunch.isIntegration){console.warn('[MintScribe][02/load] 연동 수업의 파일 변경을 차단했습니다.');return}for(const f of files){if(/\.(m4a|mp3)$/i.test(f.name))state.audioFile=f;if(/\.(vtt|txt)$/i.test(f.name))state.textFile=f}state.error='';renderHome()}
function resetSession(){state.index=0;state.answers={};state.results={};state.hints={};state.hintOpen=false;state.loop=false;state.playing=false;}
function chooseCues(scope){const all=state.cues;if(scope==='all')return all.filter(c=>wordTokens(c.text).length >= (state.minWords ?? 4));const n=Number(scope);return [...all].sort((a,b)=>wordTokens(b.text).length-wordTokens(a.text).length || (b.end-b.start)-(a.end-a.start)).slice(0,n).sort((a,b)=>a.start-b.start)}
async function startLocal(scope){
 if(window.MintScribeLaunch.isIntegration)return;
 if(!state.audioFile||!state.textFile){state.error=t('selectBoth');renderHome();return}
 try{
  const ext=/\.txt$/i.test(state.textFile.name)?'txt':'vtt';
  const text=await state.textFile.text();
  state.cues=parseTranscript(text,ext);
  if(!state.cues.length)throw new Error(t('noTeacher'));
  if(state.audioUrl?.startsWith('blob:'))URL.revokeObjectURL(state.audioUrl);
  state.audioUrl=URL.createObjectURL(state.audioFile);
  state.textName=state.textFile.name;
  state.sample=false;
  resetSession();
  state.selected=chooseCues(scope);
  if(!state.selected.length)throw new Error(('설정한 최소 단어 수에 맞는 선생님 구간이 없습니다. URL의 min_words 값을 낮춰 주세요.'));
  renderPractice();
 }catch(e){state.error=e.message||t('fileFail');renderHome()}
}
function launchErrorMessage(){
 const launch=window.MintScribeLaunch;
 if(launch.missingRequired.includes('mode')||launch.invalidParameters?.includes('mode'))return ('접속 환경이 지정되지 않았거나 올바르지 않습니다. URL에 mode=dev(개발) 또는 mode=real(운영)이 필요합니다. 민트 홈페이지에서 수업을 다시 열어 주세요.');
 return (`수업 연결 정보가 부족합니다 (${launch.missingRequired.join(', ')}). 민트 홈페이지에서 수업을 다시 열어 주세요.`);
}

function audioLoadErrorMessage(code){

 const descriptions=({1:'음원 불러오기가 중단되었습니다.',2:'음원을 불러오지 못했습니다. 네트워크와 파일 접근 권한을 확인해 주세요.',3:'음원을 해석하지 못했습니다. 파일 형식을 확인해 주세요.',4:'음원 주소가 잘못되었거나 지원하지 않는 파일입니다.'});
 return descriptions[code]||(('음원을 재생하지 못했습니다.'));
}

function validateAudioSource(url){
 return new Promise((resolve,reject)=>{
  // Metadata only: never play audio while the learner is on the landing screen.
  const probe=document.createElement('audio');
  probe.preload='metadata';
  let timer=null,settled=false;
  const finish=(error)=>{
   if(settled)return;
   settled=true;
   const duration=probe.duration;
   clearTimeout(timer);
   probe.removeEventListener('loadedmetadata',onMetadata);
   probe.removeEventListener('error',onError);
   probe.pause();
   probe.removeAttribute('src');
   probe.load();
   if(error)reject(error);else resolve({duration});
  };
  const onMetadata=()=>finish();
  const onError=()=>{
   const error=new Error('Audio metadata validation failed');
   error.mediaCode=probe.error?.code||0;
   error.code=`AUDIO_${error.mediaCode}`;
   finish(error);
  };
  probe.addEventListener('loadedmetadata',onMetadata);
  probe.addEventListener('error',onError);
  timer=setTimeout(()=>{
   const error=new Error('Audio metadata validation timed out');
   error.code='AUDIO_TIMEOUT';
   finish(error);
  },20000);
  try{probe.src=url;probe.load()}catch(error){
   const failure=new Error('Audio metadata validation could not start');
   failure.code='AUDIO_4';failure.mediaCode=4;finish(failure);
  }
 });
}

async function startUrls(){
 const launch=window.MintScribeLaunch;
 if(state.loadingUrls)return;
 const au=(launch.isIntegration?launch.audioUrl:$('#audioUrl')?.value||'').trim();
 const tu=(launch.isIntegration?launch.transcriptUrl:$('#textUrl')?.value||'').trim();
 if((launch.isIntegration&&launch.status!=='ready')||!au||!tu){
  state.error=launch.isIntegration
   ? launchErrorMessage()
   : t('selectBoth');
  console.error('[MintScribe][02/load] 불러오기 차단', {code:'INVALID_LAUNCH',missingRequired:[...launch.missingRequired],invalidParameters:[...(launch.invalidParameters||[])]});
  renderHome();return;
 }
 const scope=$('#scope')?.value||state.scope||'10';
 state.scope=scope;state.audioUrlInput=au;state.textUrlInput=tu;
 state.error='';state.loadingUrls=true;
 console.info('[MintScribe][02/load] 자료 불러오기 시작', {isIntegration:launch.isIntegration,environment:launch.environment,scope});
 renderHome();
 let failureCode='NETWORK_ERROR',httpStatus=null;
 try{
  failureCode='INVALID_FILE_URL';
  const audioAddress=new URL(au,location.href),textAddress=new URL(tu,location.href);
  if(![audioAddress,textAddress].every(url=>['http:','https:'].includes(url.protocol)))throw new Error();
  failureCode='NETWORK_ERROR';
  const response=await fetch(textAddress.href);
  httpStatus=response.status;
  if(!response.ok){failureCode='TRANSCRIPT_HTTP_ERROR';throw new Error()}
  const transcript=await response.text();
  const ext=/\.txt$/i.test(textAddress.pathname)?'txt':'vtt';
  const cues=parseTranscript(transcript,ext);
  if(!cues.length){failureCode='NO_TEACHER_CAPTIONS';throw new Error()}
  console.info('[MintScribe][02/load] 자막 읽기 완료', {format:ext,teacherCaptions:cues.length,httpStatus});
  failureCode='AUDIO_LOAD_ERROR';
  const audioInfo=await validateAudioSource(audioAddress.href);
  console.info('[MintScribe][02/load] 음원 검사 완료', {duration:audioInfo.duration});
  // Select before resetting so a failed load does not discard the active practice.
  const previousCues=state.cues;
  state.cues=cues;
  const selected=chooseCues(scope);
  if(!selected.length){state.cues=previousCues;failureCode='NO_MATCHING_CAPTIONS';throw new Error()}
  if(state.audioUrl?.startsWith('blob:'))URL.revokeObjectURL(state.audioUrl);
  state.audioFile=null;state.textFile=null;state.audioUrl=audioAddress.href;
  const fileName=textAddress.pathname.split('/').pop();
  try{state.textName=decodeURIComponent(fileName)}catch(_){state.textName=fileName}
  state.sample=false;resetSession();state.selected=selected;
  failureCode='PRACTICE_RENDER_ERROR';
  renderPractice();
  console.info('[MintScribe][02/load] 연습 준비 완료', {selectedCaptions:selected.length,scope,isIntegration:launch.isIntegration});
 }catch(error){

  const detail=failureCode==='TRANSCRIPT_HTTP_ERROR'?`HTTP ${httpStatus}`
   :failureCode==='AUDIO_LOAD_ERROR'?(error.code==='AUDIO_TIMEOUT'
    ?(('음원 확인 시간이 초과되었습니다. 연결 상태를 확인하고 다시 시도해 주세요.'))
    :audioLoadErrorMessage(error.mediaCode))
   :failureCode==='NO_TEACHER_CAPTIONS'?t('noTeacher')
   :failureCode==='NO_MATCHING_CAPTIONS'?(('설정한 최소 단어 수에 맞는 선생님 구간이 없습니다.'))
   :failureCode==='INVALID_FILE_URL'?(('음원·자막 주소가 올바르지 않습니다.'))
   :failureCode==='PRACTICE_RENDER_ERROR'?(('연습 화면을 준비하지 못했습니다.'))
   :(('네트워크 연결 또는 파일 접근 권한을 확인해 주세요.'));
  const displayCode=failureCode==='AUDIO_LOAD_ERROR'?error.code||failureCode:failureCode;
  state.error=`${t('urlFail')} ${detail} [${displayCode}]`;
  console.error('[MintScribe][02/load] 자료 불러오기 실패', {code:displayCode,httpStatus:failureCode==='TRANSCRIPT_HTTP_ERROR'?httpStatus:null,errorType:error.name});
  state.view='home';
 }finally{
  state.loadingUrls=false;
  if(state.view==='home')renderHome();
 }
}
function startSample(){if(window.MintScribeLaunch.isIntegration)return;state.cues=parseTranscript(sampleText,'vtt');state.selected=state.cues;state.audioUrl=null;state.textName='sample.vtt';state.sample=true;resetSession();renderPractice()}
function current(){return state.selected[state.index]}
function hintState(c){return state.hints[c.id]||(state.hints[c.id]={uses:0,levels:{}})}
function avgScore(){const vals=Object.values(state.results);return vals.length?Math.round(vals.reduce((a,r)=>a+r.score,0)/vals.length):0}
function progressPercent(){return state.selected.length?Math.round(Object.keys(state.results).length/state.selected.length*100):0}
var renderPractice;
function bindPractice(){const c=current(),audio=$('#sourceAudio');if(audio){audio.playbackRate=state.playbackRate||1;audio.addEventListener('timeupdate',()=>{if(audio.currentTime>=c.end){if(state.loop){audio.currentTime=c.start;audio.play().catch(()=>{})}else{audio.pause();state.playing=false;syncPlayButton()}}const pt=$('#playerTime');if(pt)pt.textContent=`${mmss(audio.currentTime)} / ${mmss(c.end)}`});audio.addEventListener('ended',()=>{state.playing=false;syncPlayButton()})}
 $('#answer').addEventListener('input',e=>{state.answers[c.id]=e.target.value;});$('#speed').value=String(state.playbackRate||1);$('#speed').addEventListener('change',e=>{state.playbackRate=Number(e.target.value);audio.playbackRate=state.playbackRate})}
function syncPlayButton(){const b=$('[data-action="play"]');if(b){b.textContent=state.playing?'Ⅱ':'▶';b.setAttribute('aria-label',state.playing?t('pause'):t('play'))}$('.wave')?.classList.toggle('active',state.playing)}
async function playCue(){if(state.sample)return;const audio=$('#sourceAudio'),c=current();if(state.playing){audio.pause();state.playing=false;syncPlayButton();return}if(audio.currentTime<c.start||audio.currentTime>=c.end)audio.currentTime=c.start;try{await audio.play();state.playing=true;syncPlayButton()}catch(e){alert(e.message)}}
function stopAudio(){const audio=$('#sourceAudio');audio?.pause();state.playing=false}
function tokensNorm(x){return wordTokens(x.toLocaleLowerCase('en')).map(w=>w.replace(/[’']/g,"'"))}
function similarityTokens(x,y){const dp=Array.from({length:y.length+1},(_,i)=>i);for(let i=1;i<=x.length;i++){let prev=dp[0];dp[0]=i;for(let j=1;j<=y.length;j++){const old=dp[j];dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(x[i-1]===y[j-1]?0:1));prev=old}}return Math.round(Math.max(0,1-dp[y.length]/Math.max(x.length,y.length,1))*100)}
function similarity(a,b){return similarityTokens(tokensNorm(a),tokensNorm(b))}
function checkAnswer(){const c=current(),val=$('#answer').value;if(!val.trim()){state.error=t('incomplete');$('#answer').focus();return}state.answers[c.id]=val;state.results[c.id]={score:similarity(c.text,val)};stopAudio();renderPractice()}
function nextCue(){stopAudio();state.hintOpen=false;if(state.index>=state.selected.length-1)renderSummary();else{state.index++;renderPractice()}}


var renderSummary;
app.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;switch(a){case'audioPick':$('#audioInput').click();break;case'textPick':$('#textInput').click();break;case'sample':startSample();break;case'urlLoad':startUrls();break;case'start':startLocal($('#scope').value);break;case'home':stopAudio();renderHome();break;case'summary':renderSummary();break;case'restart':resetSession();renderPractice();break;case'play':playCue();break;case'loop':state.loop=!state.loop;el.classList.toggle('active',state.loop);el.setAttribute('aria-pressed',state.loop);break;case'hint':state.hintOpen=!state.hintOpen;renderPractice();break;case'word':{const h=hintState(current()),i=Number(el.dataset.index);if(h.uses<6&&(h.levels[i]||0)<3){h.levels[i]=(h.levels[i]||0)+1;h.uses++;renderPractice()}break}case'check':checkAnswer();break;case'next':nextCue();break;case'jump':stopAudio();state.index=Number(el.dataset.index);state.hintOpen=false;renderPractice();break;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio()});

const launchConfig=window.MintScribeLaunch;
if(launchConfig.audioUrl||launchConfig.transcriptUrl){state.audioUrlInput=launchConfig.audioUrl;state.textUrlInput=launchConfig.transcriptUrl}
state.urlScope=launchConfig.urlScope;
state.scope=launchConfig.scope;
state.minWords=launchConfig.minWords;
renderHome();

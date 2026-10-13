/* The compact visual layer reuses the parser, playback, scoring and recording logic in app.js. */
state.loadTab = 'url';
state.scope = '10';
state.audioUrlInput ||= 'https://files.mintenglish.site/beta/mintscribe/20261012_1800_Viya.m4a';
state.textUrlInput ||= 'https://files.mintenglish.site/beta/mintscribe/20261012_1800_Viya.vtt';
state.panel = 'hint';
state.hintIndex = 0;
state.compactToolOpen = false;
state.lastRenderedCue = null;
state.lastResultKey = null;
state.wordAnswers = {};
state.hintUsed = 0;
state.practiceScope = state.scope;

const baseResetSession = resetSession;
resetSession = function () {
  baseResetSession();
  state.panel = 'hint';
  state.hintIndex = 0;
  state.compactToolOpen = false;
  state.lastRenderedCue = null;
  state.lastResultKey = null;
  state.wordAnswers = {};
  state.hintUsed = 0;
};

const baseStartLocal = startLocal, baseStartUrls = startUrls;
startLocal = function (scope) {
  state.practiceScope = scope;
  return baseStartLocal(scope);
};
startUrls = function () {
  state.practiceScope = $('#scope')?.value || state.scope || '10';
  return baseStartUrls();
};

function renderHome() {
  state.view = 'home';
  const filesSelected = Boolean(state.audioFile && state.textFile);
  const mode = state.loadTab || 'files';
  shell(`<main class="page home-page">
    <section class="home-story">
      <div class="eyebrow">MINTSCRIBE 2.0 / LISTENING LAB</div>
      <h1>${t('heroTitle').replace('\n', '<br>')}</h1>
      <p>${t('heroBody')}</p>
      <div class="story-steps"><span>01 <b>${state.lang === 'ko' ? '불러오기' : 'Import'}</b></span><span>02 <b>${state.lang === 'ko' ? '듣고 쓰기' : 'Listen & write'}</b></span><span>03 <b>${state.lang === 'ko' ? '확인하기' : 'Review'}</b></span></div>
      <div class="story-orbit orbit-one"></div><div class="story-orbit orbit-two"></div>
    </section>
    <section class="load-panel neon-load">
      <div class="load-head"><div><div class="eyebrow">START HERE</div><h2>${t('loadTitle')}</h2><p>${t('loadBody')}</p></div><span class="load-number">01</span></div>
      <div class="load-switch" role="tablist" aria-label="${t('loadTitle')}"><button data-action="loadTab" data-tab="files" role="tab" aria-selected="${mode === 'files'}" class="${mode === 'files' ? 'active' : ''}">⇧ ${state.lang === 'ko' ? '파일 선택' : 'Local files'}</button><button data-action="loadTab" data-tab="url" role="tab" aria-selected="${mode === 'url'}" class="${mode === 'url' ? 'active' : ''}">⌁ URL</button></div>
      ${mode === 'files' ? `<div class="load-mode"><div id="drop" class="drop-zone"><div class="upload-icon">⇧</div><strong>${t('dropTitle')}</strong><p>${t('dropBody')}</p><div class="file-buttons"><button class="secondary-btn" data-action="audioPick">♪ ${t('audioFile')}</button><button class="secondary-btn" data-action="textPick">≡ ${t('transcriptFile')}</button></div></div><input id="audioInput" class="hidden" type="file" accept=".m4a,.mp3,audio/*"><input id="textInput" class="hidden" type="file" accept=".vtt,.txt,text/plain,text/vtt"><div class="file-status"><div class="file-line"><b>♪ ${esc(state.audioFile?.name || '—')}</b><span>AUDIO</span></div><div class="file-line"><b>≡ ${esc(state.textFile?.name || '—')}</b><span>TEXT</span></div></div></div>` : `<div class="load-mode url-mode"><label>${t('audioUrl')}<input class="text-input" id="audioUrl" type="url" placeholder="https://…/class.m4a" value="${esc(state.audioUrlInput || '')}"></label><label>${t('textUrl')}<input class="text-input" id="textUrl" type="url" placeholder="https://…/class.vtt" value="${esc(state.textUrlInput || '')}"></label><p class="helper">${t('cors')}</p></div>`}
      <div class="load-bottom"><div><label class="scope-label" for="scope">${t('choosePractice')}</label>${scopeSelect()}</div><button class="primary-btn" data-action="${mode === 'files' ? 'start' : 'urlLoad'}" ${mode === 'files' && !filesSelected ? 'disabled' : ''}>${t('start')} <span>↗</span></button></div>
      ${state.error ? `<div class="notice error" role="alert">${esc(state.error)}</div>` : ''}
      <div class="load-footer"><span>${t('offline')}</span></div>
    </section>
  </main>`);
  if (mode === 'files') bindHome();
}

function normalizedWord(value) {
  return (tokensNorm(value)[0] || '').normalize('NFKC');
}

function wordIsCorrect(c, i) {
  const typed = (state.wordAnswers[c.id] || [])[i] || '';
  return Boolean(typed.trim() && normalizedWord(typed) === normalizedWord(wordTokens(c.text)[i] || ''));
}

function hintAllowance() {
  return state.practiceScope === 'all' ? 100 : state.selected.length * 5;
}

function hintMarkup(c) {
  const words = wordTokens(c.text), h = hintState(c);
  state.hintIndex = Math.min(Math.max(0, state.hintIndex || 0), Math.max(0, words.length - 1));
  const i = state.hintIndex, word = words[i] || '', level = h.levels[i] || 0;
  const correct = wordIsCorrect(c, i), remaining = Math.max(0, hintAllowance() - state.hintUsed);
  const visible = correct ? esc((state.wordAnswers[c.id] || [])[i]) : level === 0 ? '＿'.repeat(Math.min(word.length, 14)) : level === 1 ? `<span class="system-letter">${esc(word[0])}</span>${'＿'.repeat(Math.min(word.length - 1, 13))}` : `<span class="system-letter">${esc(word)}</span>`;
  const nextHint = level === 0 ? (state.lang === 'ko' ? '첫 글자 보기' : 'Show first letter') : (state.lang === 'ko' ? 'AI 단어 보기' : 'Show AI word');
  return `<div class="tool-intro"><span class="tool-kicker">${state.lang === 'ko' ? '막힌 단어를 선택하세요' : 'Select a word you need help with'}</span><strong>${state.lang === 'ko' ? '남은 세션 힌트' : 'Session hints left'} <em>${remaining}</em> / ${hintAllowance()}</strong></div>
    <div class="hint-word-list" aria-label="${state.lang === 'ko' ? '단어별 힌트' : 'Word hints'}">${words.map((w, n) => { const done = wordIsCorrect(c, n), reveal = h.levels[n] || 0; const label = done ? `✓ ${esc((state.wordAnswers[c.id] || [])[n])}` : reveal === 2 ? esc(w) : reveal === 1 ? `${esc(w[0])}${'·'.repeat(Math.min(w.length - 1, 10))}` : `${w.length} ${state.lang === 'ko' ? '글자' : 'letters'}`; return `<button data-action="hintSelect" data-index="${n}" class="hint-word ${n === i ? 'current' : ''} ${done ? 'correct' : reveal ? 'system-shown' : ''}" aria-label="${n + 1}: ${w.length} ${state.lang === 'ko' ? '글자' : 'letters'}"><small>${n + 1}</small><b>${label}</b></button>`; }).join('')}</div>
    <div class="hint-focus"><div><small>${state.lang === 'ko' ? `${i + 1}번 단어 · ${word.length}글자` : `Word ${i + 1} · ${word.length} letters`}</small><div class="hint-focus-word ${correct ? 'correct' : ''}">${visible}</div></div><button class="reveal-btn" data-action="reveal" ${correct || level >= 2 || !remaining ? 'disabled' : ''}>✦ ${correct ? (state.lang === 'ko' ? '직접 맞혔어요' : 'You got it') : level >= 2 ? (state.lang === 'ko' ? '단어 확인 완료' : 'Word revealed') : !remaining ? (state.lang === 'ko' ? '힌트를 모두 썼어요' : 'No hints left') : nextHint}</button></div>
    <p class="tool-note">✧ ${state.lang === 'ko' ? '초록색은 직접 맞힌 단어, 파란색은 AI 자막에서 보여 준 글자예요.' : 'Green shows your correct words; blue shows letters revealed from the AI transcript.'} ${t('aiNotice')}</p>`;
}

function reviewMarkup(c, result) {
  if (!result) return `<div class="empty-panel"><span>◎</span><b>${state.lang === 'ko' ? '받아쓰기를 확인하면 결과가 여기에 표시돼요.' : 'Check your transcription to see the result here.'}</b><p>${t('reviewCaveat')}</p></div>`;
  return `<div class="review-head"><div class="review-ring ${result.score >= 80 ? 'passed' : ''}" style="--score:${result.score}%"><strong>${result.score}<small>%</small></strong></div><div><span>${t('similarity')}</span><b>${result.score >= 80 ? t('passed') : t('tryAgain')}</b><small>${t('threshold')}</small></div></div><div class="review-reference"><span>AI TRANSCRIPT</span><p>${esc(c.text)}</p></div><p class="tool-note">✧ ${t('reviewCaveat')}</p>`;
}

function scoreColor(score) {
  return `hsl(${Math.round(score * 2.2)} 92% 66%)`;
}

function shadowMarkup(c) {
  const scores = state.demoScores;
  const average = scores ? (scores.reduce((n, item) => n + item.score, 0) / scores.length).toFixed(1) : null;
  return `<div class="shadow-intro"><div><span class="tool-kicker">${t('shadow')}</span><p>${t('shadowBody')}</p></div><span class="demo-badge">${t('demoLabel')}</span></div>
    <div class="shadow-controls"><button class="record-btn ${state.recording ? 'recording' : ''}" data-action="record"><i></i>${state.recording ? t('stop') : t('record')}</button>${state.recordUrl ? `<audio id="selfAudio" controls src="${state.recordUrl}"></audio><a class="download-btn" download="mintscribe-shadowing.webm" href="${state.recordUrl}" title="${t('download')}">↓</a>` : ''}</div>
    <button class="score-trigger" data-action="demoScore">✦ ${state.recordUrl ? t('demoScore') : (state.lang === 'ko' ? '시연 점수 미리보기' : 'Preview demo scores')} →</button>
    ${scores ? `<div class="score-heading"><span>${state.lang === 'ko' ? '문장 평균 · 시연 점수' : 'Sentence average · demo'}</span><strong>${average}<small> / 100</small></strong></div><div class="score-flow">${scores.map(x => `<span class="score-word" style="--tone:${scoreColor(x.score)}" title="${x.word}: ${x.score.toFixed(1)}"><b>${esc(x.word)}</b><small>${x.score.toFixed(0)}</small></span>`).join('')}</div><div class="score-legend"><div class="legend-gradient"><span class="pass-marker" title="80 ${state.lang === 'ko' ? '통과' : 'pass'}"></span></div><div class="legend-labels"><span>0 · ${state.lang === 'ko' ? '다시 연습' : 'Practice'}</span><span class="pass-label">80+ ${state.lang === 'ko' ? '통과' : 'Pass'}</span><span>100 · ${state.lang === 'ko' ? '매우 좋음' : 'Excellent'}</span></div></div>` : `<div class="shadow-placeholder">♬ <span>${state.lang === 'ko' ? '녹음 후 내 발음을 듣고, 시연 점수를 확인할 수 있어요.' : 'Record, listen back, then explore the demo scores.'}</span></div>`}`;
}

function wordInputsMarkup(c) {
  const words = wordTokens(c.text), typed = state.wordAnswers[c.id] || [];
  const count = words.length;
  return `<div class="word-entry" id="wordEntry" role="group" aria-label="${t('write')}">${Array.from({length: count}, (_, i) => {
    const word = words[i] || '', value = typed[i] || '', correct = word && wordIsCorrect(c, i);
    const length = word.length;
    return `<label class="word-slot ${correct ? 'correct' : ''}" style="--slot-width:${Math.min(Math.max(length, 3), 16)}ch"><span class="slot-number">${i + 1}</span><input class="word-input" data-index="${i}" type="text" value="${esc(value)}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${state.lang === 'ko' ? `${i + 1}번 단어, ${length}글자` : `Word ${i + 1}, ${length} letters`}" placeholder="${'·'.repeat(Math.min(length, 16))}"><span class="slot-length">${length} ${state.lang === 'ko' ? '글자' : 'letters'}</span></label>`;
  }).join('')}</div>`;
}

function renderPractice() {
  state.view = 'practice';
  state.playing = false;
  const c = current();
  if (!c) { renderSummary(); return; }
  if (state.lastRenderedCue !== c.id) { state.panel = 'hint'; state.hintIndex = 0; state.compactToolOpen = false; state.lastRenderedCue = c.id; }
  const result = state.results[c.id];
  const key = result ? `${c.id}:${result.score}` : null;
  if (key && state.lastResultKey !== key) { state.panel = 'review'; state.compactToolOpen = true; state.lastResultKey = key; }
  const pct = progressPercent(), panel = state.panel || 'hint';
  shell(`<main class="page practice-page">
    <div class="practice-head"><div><div class="eyebrow">${t('session')} / ${esc(state.textName)}</div><h1>${t('teacherLine')} <span>${state.index + 1} <i>/ ${state.selected.length}</i></span></h1></div><div class="head-buttons"><button class="ghost-btn" data-action="home">← <span>${t('back')}</span></button><button class="ghost-btn" data-action="summary">${t('summary')} ↗</button></div></div>
    <div class="session-strip"><div class="session-progress"><span>${t('progress')} <b>${pct}%</b></span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div><div class="strip-stat"><small>${t('activeTime')}</small><b id="timeValue">${mmss(state.seconds)}</b></div><div class="strip-stat"><small>${t('score')}</small><b>${Object.keys(state.results).length ? avgScore() + '%' : '—'}</b></div><div class="strip-stat"><small>${t('pass')}</small><b>${Object.values(state.results).filter(x => x.score >= 80).length}/${state.selected.length}</b></div></div>
    <div class="workbench ${state.compactToolOpen ? 'compact-tool-open' : ''}"><section class="listen-surface"><div class="cue-bar"><div><span class="cue-label">CAPTION ${String(state.index + 1).padStart(2, '0')} / ${String(state.selected.length).padStart(2, '0')}</span><h2>${esc(c.speaker)}</h2></div><div class="cue-navigation"><button data-action="prev" aria-label="Previous caption" ${state.index === 0 ? 'disabled' : ''}>←</button><select id="cueJump" aria-label="${t('items')}">${state.selected.map((x, i) => `<option value="${i}" ${i === state.index ? 'selected' : ''}>${String(i + 1).padStart(2, '0')} · ${mmss(x.start)}</option>`).join('')}</select><button data-action="next" aria-label="Next caption">→</button></div></div>
      <div class="cue-time">${mmss(c.start)} — ${mmss(c.end)} <span>·</span> ${duration(c)} <span>·</span> ${wordTokens(c.text).length} ${t('words')}</div>
      <div class="player"><button class="play-button" data-action="play" ${state.sample ? 'disabled' : ''} aria-label="${t('play')}">▶</button><div class="wave" aria-hidden="true">${Array.from({length:39}, (_, i) => `<i style="height:${16 + ((i * 17 + 7) % 28)}px"></i>`).join('')}</div><div class="player-time" id="playerTime">${mmss(c.start)} / ${mmss(c.end)}</div></div>
      <div class="play-options"><button class="pill-btn ${state.loop ? 'active' : ''}" data-action="loop" aria-pressed="${state.loop}">↺ ${t('loop')}</button><select id="speed" class="speed-select" aria-label="${t('slow')}"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select><button class="pill-btn timer-pill ${state.paused ? '' : 'active'}" data-action="timer">${state.paused ? t('timerResume') : t('timerPause')}</button></div>
      ${state.sample ? `<div class="sample-note">${t('sampleNoAudio')}</div>` : ''}
      <div class="write-label"><span>${t('write')}</span><small>${state.lang === 'ko' ? '단어 아래 글자 수를 보고 입력하세요' : 'Use the letter count below each word'}</small></div>${wordInputsMarkup(c)}<textarea id="answer" class="hidden" tabindex="-1" aria-hidden="true">${esc(state.answers[c.id] || '')}</textarea>
      <div class="write-actions"><span class="ai-caution">✦ AI STT ${state.lang === 'ko' ? '기준' : 'reference'}</span><div><button class="secondary-btn" data-action="check">${t('check')}</button><button class="primary-btn" data-action="next">${state.index === state.selected.length - 1 ? t('finish') : t('next')} →</button></div></div>
    </section><section class="insight-surface"><div class="tool-tabs" role="tablist" aria-label="Practice tools"><button class="compact-write-tab" role="tab" data-action="toolClose">✎ ${state.lang === 'ko' ? '받아쓰기' : 'Write'}</button><button role="tab" data-action="panel" data-panel="hint" aria-selected="${panel === 'hint'}" class="${panel === 'hint' ? 'active' : ''}">✧ ${state.lang === 'ko' ? '힌트' : 'Hints'}</button><button role="tab" data-action="panel" data-panel="review" aria-selected="${panel === 'review'}" class="${panel === 'review' ? 'active' : ''}">◎ ${state.lang === 'ko' ? '확인' : 'Review'}${result ? '<i></i>' : ''}</button><button role="tab" data-action="panel" data-panel="shadow" aria-selected="${panel === 'shadow'}" class="${panel === 'shadow' ? 'active' : ''}">◉ ${state.lang === 'ko' ? '따라 말하기' : 'Shadowing'}</button></div><div class="tool-content">${panel === 'hint' ? hintMarkup(c) : panel === 'review' ? reviewMarkup(c, result) : shadowMarkup(c)}</div></section></div>
    <audio id="sourceAudio" src="${esc(state.audioUrl || '')}" preload="metadata"></audio>
  </main>`);
  bindPractice();
  bindWordInputs(c);
  $('#cueJump').addEventListener('change', event => { stopAudio(); state.index = Number(event.target.value); renderPractice(); });
}

function bindWordInputs(c) {
  const entry = $('#wordEntry');
  const inputs = [...entry.querySelectorAll('.word-input')];
  const sync = () => {
    const typed = state.wordAnswers[c.id] || [];
    const answer = typed.join(' ').trim();
    $('#answer').value = answer;
    state.answers[c.id] = answer;
    inputs.forEach((input, i) => input.closest('.word-slot').classList.toggle('correct', wordIsCorrect(c, i)));
    if (state.panel === 'hint') { const content = $('.tool-content'); if (content) content.innerHTML = hintMarkup(c); }
    state.lastActive = Date.now();
  };
  inputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      const typed = state.wordAnswers[c.id] || (state.wordAnswers[c.id] = []);
      const pieces = input.value.trim().split(/\s+/);
      if (pieces.length > 1) {
        pieces.forEach((piece, offset) => { if (i + offset < inputs.length) { typed[i + offset] = piece; inputs[i + offset].value = piece; } });
        inputs[Math.min(i + pieces.length, inputs.length - 1)].focus();
      } else typed[i] = input.value;
      sync();
    });
    input.addEventListener('keydown', event => {
      if (event.key === ' ' && input.value.trim()) { event.preventDefault(); inputs[Math.min(i + 1, inputs.length - 1)].focus(); }
      if (event.key === 'Backspace' && !input.value && i > 0) inputs[i - 1].focus();
      if (event.key === 'ArrowRight' && input.selectionStart === input.value.length && i < inputs.length - 1) inputs[i + 1].focus();
      if (event.key === 'ArrowLeft' && input.selectionStart === 0 && i > 0) inputs[i - 1].focus();
    });
    input.addEventListener('focus', () => { state.hintIndex = Math.min(i, wordTokens(c.text).length - 1); if (state.panel === 'hint') { const content = $('.tool-content'); if (content) content.innerHTML = hintMarkup(c); } });
  });
}

app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'loadTab') { state.loadTab = button.dataset.tab; state.error = ''; renderHome(); }
  if (action === 'panel') { state.panel = button.dataset.panel; state.compactToolOpen = true; renderPractice(); }
  if (action === 'toolClose') { state.compactToolOpen = false; renderPractice(); }
  if (action === 'prev' && state.index > 0) { stopAudio(); state.index--; renderPractice(); }
  if (action === 'hintPrev' && state.hintIndex > 0) { state.hintIndex--; renderPractice(); }
  if (action === 'hintNext' && state.hintIndex < wordTokens(current().text).length - 1) { state.hintIndex++; renderPractice(); }
  if (action === 'hintSelect') { state.hintIndex = Number(button.dataset.index); renderPractice(); }
  if (action === 'reveal') {
    const h = hintState(current()), i = state.hintIndex;
    if (state.hintUsed < hintAllowance() && !wordIsCorrect(current(), i) && (h.levels[i] || 0) < 2) { h.levels[i] = (h.levels[i] || 0) + 1; h.uses++; state.hintUsed++; renderPractice(); }
  }
});

app.addEventListener('change', event => {
  if (event.target.id === 'scope') state.scope = event.target.value;
});

showDemoScores = function () {
  const words = wordTokens(current().text).slice(0, 30);
  const sampleRange = [24, 91, 58, 80, 43, 96, 67, 34, 86, 73, 51, 99];
  state.demoScores = words.map((word, i) => ({word, score: sampleRange[i % sampleRange.length] + ((i * 7) % 9) / 10}));
  renderPractice();
};

renderHome();

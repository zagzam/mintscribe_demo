/* The compact visual layer reuses the parser, playback, scoring and recording logic in app.js. */
state.loadTab = state.audioUrlInput || state.textUrlInput ? 'url' : 'files';
state.scope = '10';
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

function wordIsRevealed(c, i) {
  return (state.hints[c.id]?.levels?.[i] || 0) >= 2;
}

function wordIsCorrect(c, i) {
  if (wordIsRevealed(c, i)) return false;
  const typed = (state.wordAnswers[c.id] || [])[i] || '';
  return Boolean(typed.trim() && normalizedWord(typed) === normalizedWord(wordTokens(c.text)[i] || ''));
}

checkAnswer = function () {
  const c = current(), words = wordTokens(c.text), typed = state.wordAnswers[c.id] || [];
  const answer = words.map((word, i) => wordIsRevealed(c, i) ? word : (typed[i] || '').trim()).join(' ').trim();
  if (!answer) {
    state.error = t('incomplete');
    document.querySelector('.word-input:not(:disabled)')?.focus();
    return;
  }
  state.answers[c.id] = answer;
  const answerTokens = words.flatMap((_, i) => wordIsRevealed(c, i)
    ? [`\u0000revealed-${i}`] : tokensNorm(typed[i] || ''));
  state.results[c.id] = {score: similarityTokens(tokensNorm(c.text), answerTokens)};
  stopAudio();
  renderPractice();
};

function hintAllowance() {
  return state.practiceScope === 'all' ? Infinity : state.selected.length * 5;
}

function hintMarkup(c) {
  const words = wordTokens(c.text), h = hintState(c);
  state.hintIndex = Math.min(Math.max(0, state.hintIndex || 0), Math.max(0, words.length - 1));
  const i = state.hintIndex, word = words[i] || '', level = h.levels[i] || 0;
  const allowance = hintAllowance();
  const correct = wordIsCorrect(c, i), remaining = Math.max(0, allowance - state.hintUsed);
  const remainingLabel = Number.isFinite(allowance) ? remaining : '∞';
  const allowanceLabel = Number.isFinite(allowance) ? allowance : '∞';
  const visible = correct ? esc((state.wordAnswers[c.id] || [])[i]) : level === 0 ? '＿'.repeat(Math.min(word.length, 14)) : level === 1 ? `<span class="system-letter">${esc(word[0])}</span>${'＿'.repeat(Math.min(word.length - 1, 13))}` : `<span class="system-letter">${esc(word)}</span>`;
  const nextHint = level === 0 ? (state.lang === 'ko' ? '첫 글자 보기' : 'Show first letter') : (state.lang === 'ko' ? 'AI 단어 보기' : 'Show AI word');
  return `<div class="tool-intro"><span class="tool-kicker">${state.lang === 'ko' ? '막힌 단어를 선택하세요' : 'Select a word you need help with'}</span><strong>${state.lang === 'ko' ? '남은 세션 힌트' : 'Session hints left'} <em>${remainingLabel}</em> / ${allowanceLabel}</strong></div>
    <div class="hint-word-list" aria-label="${state.lang === 'ko' ? '단어별 힌트' : 'Word hints'}">${words.map((w, n) => { const done = wordIsCorrect(c, n), reveal = h.levels[n] || 0; const label = done ? `✓ ${esc((state.wordAnswers[c.id] || [])[n])}` : reveal === 2 ? esc(w) : reveal === 1 ? `${esc(w[0])}${'·'.repeat(Math.min(w.length - 1, 10))}` : `${w.length} ${state.lang === 'ko' ? '글자' : 'letters'}`; return `<button data-action="hintSelect" data-index="${n}" class="hint-word ${n === i ? 'current' : ''} ${done ? 'correct' : reveal ? 'system-shown' : ''}" aria-label="${n + 1}: ${w.length} ${state.lang === 'ko' ? '글자' : 'letters'}"><small>${n + 1}</small><b>${label}</b></button>`; }).join('')}</div>
    <div class="hint-focus"><div><small>${state.lang === 'ko' ? `${i + 1}번 단어 · ${word.length}글자` : `Word ${i + 1} · ${word.length} letters`}</small><div class="hint-focus-word ${correct ? 'correct' : ''}">${visible}</div></div><button class="reveal-btn" data-action="reveal" ${correct || level >= 2 || !remaining ? 'disabled' : ''}>✦ ${correct ? (state.lang === 'ko' ? '직접 맞혔어요' : 'You got it') : level >= 2 ? (state.lang === 'ko' ? '단어 확인 완료' : 'Word revealed') : !remaining ? (state.lang === 'ko' ? '힌트를 모두 썼어요' : 'No hints left') : nextHint}</button></div>
    <p class="tool-note">✧ ${state.lang === 'ko' ? '초록색은 직접 맞힌 단어, 파란색은 AI 자막에서 보여 준 글자예요.' : 'Green shows your correct words; blue shows letters revealed from the AI transcript.'} ${t('aiNotice')}</p>`;
}

function reviewMarkup(c, result) {
  if (!result) return `<div class="empty-panel"><span>◎</span><b>${state.lang === 'ko' ? '받아쓰기를 확인하면 결과가 여기에 표시돼요.' : 'Check your transcription to see the result here.'}</b><p>${t('reviewCaveat')}</p></div>`;
  const revealed = wordTokens(c.text).filter((_, i) => wordIsRevealed(c, i)).length;
  return `<div class="review-head"><div class="review-ring ${result.score >= 80 ? 'passed' : ''}" style="--score:${result.score}%"><strong>${result.score}<small>%</small></strong></div><div><span>${t('similarity')}</span><b>${result.score >= 80 ? t('passed') : t('tryAgain')}</b><small>${t('threshold')}</small></div></div><div class="review-reference"><span>AI TRANSCRIPT</span><p>${esc(c.text)}</p></div><p class="tool-note">✧ ${revealed ? (state.lang === 'ko' ? `AI가 공개한 단어 ${revealed}개는 정답으로 인정하지 않았어요. ` : `${revealed} AI-revealed word${revealed === 1 ? '' : 's'} received no credit. `) : ''}${t('reviewCaveat')}</p>`;
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

function punctuatedStudentLine(c) {
  const source = String(c.text || '');
  const reference = [...source.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)];
  const typed = state.wordAnswers[c.id] || wordTokens(state.answers[c.id] || '');
  const output = [];
  let pending = source.slice(0, reference[0]?.index || 0).replace(/\s/g, '');
  reference.forEach((match, i) => {
    const answer = wordIsRevealed(c, i) ? match[0] : (typed[i] || '').trim();
    if (answer) {
      const clean = wordTokens(answer).join(' ');
      let word = clean;
      if (match[0].length > 1 && match[0] === match[0].toLocaleUpperCase('en')) word = clean.toLocaleUpperCase('en');
      else if (/^\p{Lu}/u.test(match[0])) word = clean.replace(/^\p{L}/u, char => char.toLocaleUpperCase('en'));
      else word = clean.replace(/^\p{Lu}/u, char => char.toLocaleLowerCase('en'));
      if (word) { output.push(pending + word); pending = ''; }
    }
    const end = match.index + match[0].length;
    const next = reference[i + 1]?.index ?? source.length;
    const marks = source.slice(end, next).replace(/\s/g, '');
    if (marks) {
      if (output.length) {
        if (/^[.!?…]/u.test(marks)) output[output.length - 1] = output[output.length - 1].replace(/[,;:]$/u, '');
        if (!output[output.length - 1].endsWith(marks)) output[output.length - 1] += marks;
      }
      else pending += marks;
    }
  });
  return output.join(' ');
}

function summaryExportMarkup() {
  const title = state.lang === 'ko' ? '나의 수업 받아쓰기' : 'My class transcription';
  const lines = state.selected.map((c, i) => {
    const sentence = punctuatedStudentLine(c);
    return `<p style="display:flex;gap:14px;align-items:baseline;margin:0;padding:13px 0;border-bottom:1px solid #dfe9ee;color:#183047;font:500 16px/1.7 Arial,sans-serif;"><span style="flex:none;color:#608292;font:700 11px/1.7 Arial,sans-serif;">${String(i + 1).padStart(2, '0')}</span><span>${sentence ? esc(sentence) : `<em style="color:#93a7b3;">${state.lang === 'ko' ? '미작성' : 'Not transcribed'}</em>`}</span></p>`;
  }).join('');
  return `<section style="background:#ffffff;border:1px solid #d9e9ef;border-radius:20px;padding:clamp(20px,3vw,34px);box-shadow:0 14px 34px #081b2d12;">
    <div style="color:#348a91;font:800 11px/1.4 Arial,sans-serif;letter-spacing:1.5px;">MINTSCRIBE 2.0 · TRANSCRIPT</div>
    <h2 style="color:#142d41;font:800 26px/1.35 Arial,sans-serif;margin:7px 0 4px;">${title}</h2>
    <p style="color:#607b8a;font:400 12px/1.6 Arial,sans-serif;margin:0 0 14px;">${state.lang === 'ko' ? '직접 받아쓴 문장 · 구두점과 대문자는 AI 자막을 참고해 정리했어요.' : 'Your words, with punctuation and capitalization guided by the AI transcript.'}</p>
    <div>${lines}</div>
  </section>
  <aside style="display:flex;align-items:center;flex-wrap:wrap;gap:14px;background:linear-gradient(120deg,#ffffff,#f4f7f9);border:1px solid #d7e0e7;border-top:3px solid #54d7bd;border-radius:16px;padding:17px 19px;margin-top:14px;box-shadow:0 8px 24px #14283a12;font-family:Arial,sans-serif;color:#243748;">
    <div style="width:44px;height:44px;flex:none;display:grid;place-items:center;background:linear-gradient(145deg,#12263b,#21475a);border-radius:13px;color:#8ff5df;font-size:24px;box-shadow:0 5px 12px #17324630;">✦</div>
    <div style="flex:1;min-width:160px;"><div style="font-size:10px;font-weight:800;color:#468f8b;letter-spacing:1px;">수업을 다시 듣는 새로운 방법</div><div style="font-size:15px;font-weight:800;margin:3px 0;color:#182c3c;">MintScribe 2.0 (베타)으로 받아썼어요</div><div style="font-size:12px;line-height:1.5;color:#657684;">듣고, 쓰고, 내 것으로 만드는 수업 복습</div></div>
    <a href="https://zagzam.github.io/mintscribe_demo/" target="_blank" rel="noopener noreferrer" style="display:inline-block;flex:none;background:#20384b;border-radius:9px;padding:9px 12px;color:#ffffff;font-size:11px;font-weight:800;text-decoration:none;white-space:nowrap;">MintScribe 2.0 (베타) 써보기 ↗</a>
  </aside>`;
}

function renderSummary() {
  stopAudio();
  state.view = 'summary';
  const done = Object.keys(state.results).length;
  const rows = state.selected.map((c, i) => `<div class="summary-row"><span>${String(i + 1).padStart(2, '0')} · ${mmss(c.start)}</span><span>${state.results[c.id] ? state.results[c.id].score + '%' : '—'}</span></div>`).join('');
  shell(`<main class="page summary summary-v2"><header class="summary-v2-head"><div><div class="eyebrow">MINTSCRIBE 2.0 / REVIEW</div><h1>${state.lang === 'ko' ? '내가 받아쓴 수업' : 'What I heard in class'}</h1><p>${state.lang === 'ko' ? '선생님의 말에서 직접 받아쓴 내용을 한눈에 확인하세요.' : 'Review the teacher’s words you transcribed.'}</p></div><button class="summary-copy-btn" data-action="copySummary" aria-label="${state.lang === 'ko' ? '받아쓰기 HTML 복사' : 'Copy transcription HTML'}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg><span>${state.lang === 'ko' ? 'HTML 복사' : 'Copy HTML'}</span></button></header>
    <div id="copyStatus" class="copy-status" role="status" aria-live="polite"></div>
    <div id="exportView" class="summary-export">${summaryExportMarkup()}</div>
    <div class="summary-compact"><div><small>${t('totalTime')}</small><b>${mmss(state.seconds)}</b></div><div><small>${t('completed')}</small><b>${done} / ${state.selected.length}</b></div><div><small>${t('avg')}</small><b>${done ? avgScore() + '%' : '—'}</b></div></div>
    <details class="summary-details"><summary>${state.lang === 'ko' ? '문장별 점수 보기' : 'View scores by caption'}</summary><div class="summary-list">${rows}</div></details>
    <div class="summary-v2-actions"><button class="secondary-btn" data-action="returnPractice">← ${state.lang === 'ko' ? '연습으로 돌아가기' : 'Back to practice'}</button><button class="secondary-btn" data-action="home">${t('newFiles')}</button><button class="primary-btn" data-action="restart">${t('restart')} →</button></div>
    <p class="footnote">${t('reviewCaveat')}</p>
  </main>`);
}

async function copySummaryHtml() {
  const view = $('#exportView');
  if (!view) return;
  const html = view.innerHTML;
  const plain = state.selected.map((c, i) => `${i + 1}. ${punctuatedStudentLine(c) || (state.lang === 'ko' ? '미작성' : 'Not transcribed')}`).join('\n') + '\n\nMintScribe 2.0 · https://zagzam.github.io/mintscribe_demo/';
  let copied = false;
  try {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({'text/html': new Blob([html], {type:'text/html'}), 'text/plain': new Blob([plain], {type:'text/plain'})})]);
      copied = true;
    }
  } catch (_) { /* Try selection-based rich copy below. */ }
  if (!copied) {
    const selection = window.getSelection(), range = document.createRange();
    range.selectNodeContents(view); selection.removeAllRanges(); selection.addRange(range);
    copied = document.execCommand('copy');
    selection.removeAllRanges();
  }
  const status = $('#copyStatus');
  status.textContent = copied ? (state.lang === 'ko' ? '받아쓰기와 MintScribe 카드가 복사됐어요.' : 'Transcription and attribution copied.') : (state.lang === 'ko' ? '복사하지 못했어요. 다시 시도해 주세요.' : 'Copy failed. Please try again.');
}

function wordInputsMarkup(c) {
  const words = wordTokens(c.text), typed = state.wordAnswers[c.id] || [];
  const count = words.length;
  return `<div class="word-entry" id="wordEntry" role="group" aria-label="${t('write')}">${Array.from({length: count}, (_, i) => {
    const word = words[i] || '', revealed = wordIsRevealed(c, i);
    const value = revealed ? word : typed[i] || '', correct = word && wordIsCorrect(c, i);
    const length = word.length;
    return `<label class="word-slot ${revealed ? 'revealed' : correct ? 'correct' : ''}" style="--slot-width:${Math.min(Math.max(length, 3), 16)}ch"><span class="slot-number">${i + 1}</span><input class="word-input" data-index="${i}" type="text" value="${esc(value)}" autocomplete="off" autocapitalize="off" spellcheck="false" ${revealed ? 'disabled' : ''} aria-label="${state.lang === 'ko' ? `${i + 1}번 단어, ${revealed ? 'AI 힌트로 공개됨' : `${length}글자`}` : `Word ${i + 1}, ${revealed ? 'revealed by AI hint' : `${length} letters`}`}" placeholder="${'·'.repeat(Math.min(length, 16))}"><span class="slot-length">${revealed ? (state.lang === 'ko' ? 'AI 힌트' : 'AI hint') : `${length} ${state.lang === 'ko' ? '글자' : 'letters'}`}</span></label>`;
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
      <div class="player"><button class="play-button" data-action="play" ${state.sample ? 'disabled' : ''} aria-label="${t('play')}">▶</button><button class="restart-button" data-action="restartAudio" ${state.sample ? 'disabled' : ''} aria-label="${state.lang === 'ko' ? '처음부터 재생' : 'Play from beginning'}" title="${state.lang === 'ko' ? '처음부터 재생' : 'Play from beginning'}">⏮</button><input class="seek-bar" id="seekBar" type="range" min="${c.start}" max="${c.end}" step="0.01" value="${c.start}" style="--seek-pct:0%" aria-label="${state.lang === 'ko' ? '재생 위치' : 'Playback position'}" aria-valuetext="${mmss(c.start)}" ${state.sample ? 'disabled' : ''}><div class="player-time" id="playerTime">${mmss(c.start)} / ${mmss(c.end)}</div></div>
      <div class="play-options"><button class="pill-btn ${state.loop ? 'active' : ''}" data-action="loop" aria-pressed="${state.loop}">↺ ${t('loop')}</button><select id="speed" class="speed-select" aria-label="${t('slow')}"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select><button class="pill-btn timer-pill ${state.paused ? '' : 'active'}" data-action="timer">${state.paused ? t('timerResume') : t('timerPause')}</button></div>
      ${state.sample ? `<div class="sample-note">${t('sampleNoAudio')}</div>` : ''}
      <div class="write-label"><span>${t('write')}</span><small>${state.lang === 'ko' ? '단어 아래 글자 수를 보고 입력하세요' : 'Use the letter count below each word'}</small></div>${wordInputsMarkup(c)}<textarea id="answer" class="hidden" tabindex="-1" aria-hidden="true">${esc(state.answers[c.id] || '')}</textarea>
      <div class="write-actions"><span class="ai-caution">✦ AI STT ${state.lang === 'ko' ? '기준' : 'reference'}</span><div><button class="secondary-btn" data-action="check">${t('check')}</button><button class="primary-btn" data-action="next">${state.index === state.selected.length - 1 ? t('finish') : t('next')} →</button></div></div>
    </section><section class="insight-surface"><div class="tool-tabs" role="tablist" aria-label="Practice tools"><button class="compact-write-tab" role="tab" data-action="toolClose">✎ ${state.lang === 'ko' ? '받아쓰기' : 'Write'}</button><button role="tab" data-action="panel" data-panel="hint" aria-selected="${panel === 'hint'}" class="${panel === 'hint' ? 'active' : ''}">✧ ${state.lang === 'ko' ? '힌트' : 'Hints'}</button><button role="tab" data-action="panel" data-panel="review" aria-selected="${panel === 'review'}" class="${panel === 'review' ? 'active' : ''}">◎ ${state.lang === 'ko' ? '확인' : 'Review'}${result ? '<i></i>' : ''}</button><button role="tab" data-action="panel" data-panel="shadow" aria-selected="${panel === 'shadow'}" class="${panel === 'shadow' ? 'active' : ''}">◉ ${state.lang === 'ko' ? '따라 말하기' : 'Shadowing'}</button></div><div class="tool-content">${panel === 'hint' ? hintMarkup(c) : panel === 'review' ? reviewMarkup(c, result) : shadowMarkup(c)}</div></section></div>
    <audio id="sourceAudio" src="${esc(state.audioUrl || '')}" preload="metadata"></audio>
  </main>`);
  bindPractice();
  bindSeekBar(c);
  bindWordInputs(c);
  $('#cueJump').addEventListener('change', event => { stopAudio(); state.index = Number(event.target.value); renderPractice(); });
}

function bindSeekBar(c) {
  const audio = $('#sourceAudio'), seek = $('#seekBar');
  const sync = () => {
    const position = Math.min(c.end, Math.max(c.start, audio.currentTime || c.start));
    const percent = Math.max(0, Math.min(100, ((position - c.start) / Math.max(c.end - c.start, 0.01)) * 100));
    seek.value = String(position);
    seek.style.setProperty('--seek-pct', `${percent}%`);
    seek.setAttribute('aria-valuetext', mmss(position));
    const display = $('#playerTime');
    if (display) display.textContent = `${mmss(position)} / ${mmss(c.end)}`;
  };
  seek.addEventListener('input', () => {
    const position = Math.min(c.end, Math.max(c.start, Number(seek.value)));
    try { audio.currentTime = position; } catch (_) { /* The media may still be loading. */ }
    seek.style.setProperty('--seek-pct', `${((position - c.start) / Math.max(c.end - c.start, 0.01)) * 100}%`);
    seek.setAttribute('aria-valuetext', mmss(position));
    const display = $('#playerTime');
    if (display) display.textContent = `${mmss(position)} / ${mmss(c.end)}`;
  });
  audio.addEventListener('timeupdate', sync);
  audio.addEventListener('seeked', sync);
  audio.addEventListener('loadedmetadata', sync);
  sync();
}

async function restartCueAudio() {
  if (state.sample) return;
  const audio = $('#sourceAudio'), c = current();
  audio.currentTime = c.start;
  const seek = $('#seekBar');
  seek.value = String(c.start);
  seek.style.setProperty('--seek-pct', '0%');
  $('#playerTime').textContent = `${mmss(c.start)} / ${mmss(c.end)}`;
  try {
    await audio.play();
    state.playing = true;
    state.lastActive = Date.now();
    syncPlayButton();
  } catch (error) { alert(error.message); }
}

function bindWordInputs(c) {
  const entry = $('#wordEntry');
  const inputs = [...entry.querySelectorAll('.word-input')];
  const focusEditable = (from, direction) => {
    for (let i = from + direction; i >= 0 && i < inputs.length; i += direction) {
      if (!inputs[i].disabled) { inputs[i].focus(); return; }
    }
  };
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
        const targets = inputs.map((candidate, index) => !candidate.disabled && index >= i ? index : -1).filter(index => index >= 0);
        pieces.forEach((piece, offset) => { const index = targets[offset]; if (index !== undefined) { typed[index] = piece; inputs[index].value = piece; } });
        focusEditable(targets[Math.min(pieces.length, targets.length) - 1] ?? i, 1);
      } else typed[i] = input.value;
      sync();
    });
    input.addEventListener('keydown', event => {
      if (event.key === ' ' && input.value.trim()) { event.preventDefault(); focusEditable(i, 1); }
      if (event.key === 'Backspace' && !input.value) focusEditable(i, -1);
      if (event.key === 'ArrowRight' && input.selectionStart === input.value.length) focusEditable(i, 1);
      if (event.key === 'ArrowLeft' && input.selectionStart === 0) focusEditable(i, -1);
    });
    input.addEventListener('focus', () => { state.hintIndex = Math.min(i, wordTokens(c.text).length - 1); if (state.panel === 'hint') { const content = $('.tool-content'); if (content) content.innerHTML = hintMarkup(c); } });
  });
}

app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'returnPractice') { renderPractice(); }
  if (action === 'copySummary') { copySummaryHtml(); }
  if (action === 'restartAudio') { restartCueAudio(); }
  if (action === 'loadTab') { state.loadTab = button.dataset.tab; state.error = ''; renderHome(); }
  if (action === 'panel') { state.panel = button.dataset.panel; state.compactToolOpen = true; renderPractice(); }
  if (action === 'toolClose') { state.compactToolOpen = false; renderPractice(); }
  if (action === 'prev' && state.index > 0) { stopAudio(); state.index--; renderPractice(); }
  if (action === 'hintPrev' && state.hintIndex > 0) { state.hintIndex--; renderPractice(); }
  if (action === 'hintNext' && state.hintIndex < wordTokens(current().text).length - 1) { state.hintIndex++; renderPractice(); }
  if (action === 'hintSelect') { state.hintIndex = Number(button.dataset.index); renderPractice(); }
  if (action === 'reveal') {
    const c = current(), h = hintState(c), i = state.hintIndex;
    if (state.hintUsed < hintAllowance() && !wordIsCorrect(c, i) && (h.levels[i] || 0) < 2) {
      h.levels[i] = (h.levels[i] || 0) + 1;
      h.uses++;
      state.hintUsed++;
      if (h.levels[i] === 2) {
        const typed = state.wordAnswers[c.id] || (state.wordAnswers[c.id] = []);
        typed[i] = wordTokens(c.text)[i];
        state.answers[c.id] = typed.join(' ').trim();
        delete state.results[c.id];
        state.lastResultKey = null;
      }
      renderPractice();
    }
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

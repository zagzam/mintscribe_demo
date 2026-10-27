/* The compact visual layer reuses the parser, playback and scoring logic in app.js. */
state.loadTab = state.audioUrlInput || state.textUrlInput ? 'url' : 'files';
state.scope = state.scope || '10';
state.panel = 'hint';
state.hintIndex = 0;
state.compactToolOpen = false;
state.lastRenderedCue = null;
state.lastResultKey = null;
state.wordAnswers = {};
state.hintUsed = 0;
state.practiceScope = state.scope;
state.reviewPending = null;

const baseResetSession = resetSession;
resetSession = function () {
  document.querySelector('#cueReviewDialog')?.remove();
  state.reviewPending = null;
  baseResetSession();
  state.panel = 'hint';
  state.hintIndex = 0;
  state.compactToolOpen = false;
  state.lastRenderedCue = null;
  state.lastResultKey = null;
  state.wordAnswers = {};
  state.hintUsed = 0;
  state.practiceNotice = null;
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
  const integrated = window.MintScribeLaunch.isIntegration;
  const filesSelected = Boolean(state.audioFile && state.textFile);
  const mode = integrated ? 'url' : state.loadTab || 'files';
  const linkError = integrated && window.MintScribeLaunch.status !== 'ready'
    ? launchErrorMessage() : '';
  shell(`<main class="page home-page">
    <section class="home-story">
      <div class="eyebrow">MINTSCRIBE 2.0</div>
      <h1>${esc(t('heroTitle').replace('\n', ' '))}</h1>
      <p>${t('heroBody')}</p>
    </section>
    <section class="load-panel neon-load">
      <div class="load-head"><div>${integrated ? '<h2>수업 파일 확인</h2><p>민트 홈페이지에서 연결된 수업입니다. 음원과 자막은 변경할 수 없습니다.</p>' : `<div class="eyebrow">START HERE</div><h2>${t('loadTitle')}</h2><p>${t('loadBody')}</p>`}</div>${integrated ? '' : '<span class="load-number">01</span>'}</div>
      ${integrated ? '' : `<div class="load-switch" role="tablist" aria-label="${t('loadTitle')}"><button data-action="loadTab" data-tab="files" role="tab" aria-selected="${mode === 'files'}" class="${mode === 'files' ? 'active' : ''}">⇧ ${('파일 선택')}</button><button data-action="loadTab" data-tab="url" role="tab" aria-selected="${mode === 'url'}" class="${mode === 'url' ? 'active' : ''}">⌁ URL</button></div>`}
      ${integrated ? linkedClassMarkup() : mode === 'files' ? `<div class="load-mode"><div id="drop" class="drop-zone"><div class="upload-icon">⇧</div><strong>${t('dropTitle')}</strong><p>${t('dropBody')}</p><div class="file-buttons"><button class="secondary-btn" data-action="audioPick">♪ ${t('audioFile')}</button><button class="secondary-btn" data-action="textPick">≡ ${t('transcriptFile')}</button></div></div><input id="audioInput" class="hidden" type="file" accept=".m4a,.mp3,audio/*"><input id="textInput" class="hidden" type="file" accept=".vtt,.txt,text/plain,text/vtt"><div class="file-status"><div class="file-line"><b>♪ ${esc(state.audioFile?.name || '—')}</b><span>AUDIO</span></div><div class="file-line"><b>≡ ${esc(state.textFile?.name || '—')}</b><span>TEXT</span></div></div></div>` : `<div class="load-mode url-mode"><label>${t('audioUrl')}<input class="text-input" id="audioUrl" type="url" placeholder="https://…/class.m4a" value="${esc(state.audioUrlInput || '')}"></label><label>${t('textUrl')}<input class="text-input" id="textUrl" type="url" placeholder="https://…/class.vtt" value="${esc(state.textUrlInput || '')}"></label><p class="helper">${t('cors')}</p></div>`}
      <div class="load-bottom"><div><label class="scope-label" for="scope">${t('choosePractice')}</label>${scopeSelect()}</div><button class="primary-btn" data-action="${mode === 'files' ? 'start' : 'urlLoad'}" ${state.loadingUrls || linkError || (mode === 'files' && !filesSelected) ? 'disabled' : ''}>${state.loadingUrls ? (('불러오는 중…')) : t('start')} <span>↗</span></button></div>
      ${state.error || linkError ? `<div class="notice error" role="alert">${esc(state.error || linkError)}</div>` : ''}
      <div class="load-footer"><span>${integrated ? '연습 내용은 현재 브라우저에 자동 저장되어 이어서 연습할 수 있습니다.' : t('offline')}</span></div>
    </section>
  </main>`);
  if (!integrated && mode === 'files') bindHome();
}

function linkedClassMarkup() {
  const launch = window.MintScribeLaunch;
  const name = value => {
    try { return decodeURIComponent(new URL(value, location.href).pathname.split('/').pop()) || '—'; }
    catch (_) { return '—'; }
  };
  return `<div class="load-mode"><div class="file-status"><div class="file-line"><b>♪ ${esc(name(launch.audioUrl))}</b><span>AUDIO</span></div><div class="file-line"><b>≡ ${esc(name(launch.transcriptUrl))}</b><span>TEXT</span></div></div></div>`;
}

document.addEventListener('click', event => {
  if (!window.MintScribeLaunch.isIntegration) return;
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!['loadTab', 'audioPick', 'textPick', 'start', 'sample', 'chooseResumeAudio'].includes(action)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  console.warn('[MintScribe][02/load] 연동 수업의 자료 변경을 차단했습니다.', {action});
}, true);

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

function cueHasAnswer(c) {
  const typed = state.wordAnswers[c.id] || [];
  return wordTokens(c.text).some((_, i) => wordIsRevealed(c, i) || wordTokens(String(typed[i] || '')).length > 0);
}

function cueAnswerSignature(c) {
  const typed = state.wordAnswers[c.id] || [];
  return JSON.stringify(wordTokens(c.text).map((word, i) => {
    const revealed = wordIsRevealed(c, i);
    return [revealed ? word : String(typed[i] || '').trim(), revealed];
  }));
}

function cueIsComplete(c) {
  const result = state.results[c.id];
  if (!result || (result.checkedAnswer !== undefined && result.checkedAnswer !== cueAnswerSignature(c))) return false;
  // Preserve nonempty checks from older checkpoints. New checks require continuation.
  return result.continued === true || (result.continued === undefined && cueHasAnswer(c));
}

function isPracticeComplete() {
  return state.selected.length > 0 && state.selected.every(cueIsComplete);
}

progressPercent = function () {
  return state.selected.length ? Math.round(state.selected.filter(cueIsComplete).length / state.selected.length * 100) : 0;
};

function invalidateCueCheck(c, reason) {
  state.practiceNotice = null;
  if (!state.results[c.id]) return;
  delete state.results[c.id];
  state.lastResultKey = null;
  console.info('[MintScribe][04/completion] 수정한 구간은 다시 확인해야 합니다.', {caption:state.index + 1,reason});
}

function practiceNoticeMarkup() {
  const notice = state.practiceNotice;
  if (!notice || notice.cueId !== current()?.id) return '';

  const message = `아직 진행하지 않은 구간이 ${notice.remaining}개 있습니다. ${state.index + 1}번 구간에서 다음 자막을 눌러 주세요.`;
  return `<div id="practiceNotice" class="notice error" role="alert" tabindex="-1">${esc(message)}</div>`;
}

function assessCue(c) {
  const words = wordTokens(c.text), typed = state.wordAnswers[c.id] || [];
  const correct = words.filter((_, i) => wordIsCorrect(c, i)).length;
  const missing = words.filter((_, i) => !wordIsRevealed(c, i) && !String(typed[i] || '').trim()).length;
  const hinted = words.filter((_, i) => wordIsRevealed(c, i)).length;
  state.answers[c.id] = words.map((word, i) => wordIsRevealed(c, i) ? word : String(typed[i] || '').trim()).join(' ').trim();
  return {score:Math.round(correct / Math.max(1, words.length) * 100),correct,missing,hinted,total:words.length,
    checkedAnswer:cueAnswerSignature(c),continued:false};
}

function saveReviewProgress() {
  window.MintScribePracticeStore?.checkpoint();
}

function advanceReviewedCue() {
  if (state.index >= state.selected.length - 1) renderSummary();
  else { state.index++; renderPractice(); }
}

function closeCueReview(continuePractice) {
  const pending = state.reviewPending;
  if (!pending) return;
  const c = current(), result = state.results[c?.id];
  const valid = c?.id === pending.cueId && result === pending.result && result.checkedAnswer === cueAnswerSignature(c);
  state.reviewPending = null;
  const dialog = document.querySelector('#cueReviewDialog');
  dialog?.close(); dialog?.remove();
  if (!valid) return;
  if (continuePractice) {
    result.continued = true;
    console.info('[MintScribe][04/completion] 결과 확인 후 계속 진행', {section:state.index + 1,score:result.score,missing:result.missing});
    advanceReviewedCue();
    saveReviewProgress();
  } else {
    state.panel = 'hint';
    refreshPracticeTools();
    saveReviewProgress();
    $('[data-action="next"]')?.focus({preventScroll:true});
  }
}

function openCueReview(c, result) {
  const dialog = document.createElement('dialog');
  dialog.id = 'cueReviewDialog';
  dialog.className = 'cue-review-dialog';
  dialog.setAttribute('aria-labelledby','cueReviewTitle');
  const canRetry = result.correct + result.hinted < result.total;
  const title = result.score === 100 ? '모두 맞혔어요! 🎉' : result.missing ? `미입력 단어가 ${result.missing}개 있어요` : '결과를 확인해 주세요';
  const help = result.score === 100 ? (state.index === state.selected.length - 1 ? '정확도 100%! 마지막 구간까지 멋지게 마쳤어요.' : '정확도 100%! 다음 구간도 이어서 도전해 보세요.') : result.missing ? '다시 풀거나, 미입력 단어의 정답을 확인하고 계속 진행할 수 있어요.' : '붉은 단어를 확인한 뒤 계속 진행해 주세요.';
  dialog.innerHTML = `<div class="cue-review-scroll"><div class="review-head"><div class="review-ring ${result.score >= 80 ? 'passed' : ''}" style="--score:${result.score}%"><strong>${result.score}<small>%</small></strong></div><div><h2 id="cueReviewTitle">${title}</h2><p>${help}</p></div></div><div class="review-reference"><span>AI TRANSCRIPT</span><p>${referenceResultMarkup(c)}</p></div><p class="tool-note">${t('reviewCaveat')}</p></div><div class="cue-review-actions ${canRetry ? '' : 'single-action'}">${canRetry ? '<button type="button" class="secondary-btn" data-action="retryCue">다시 풀기</button>' : ''}<button type="button" class="primary-btn" data-action="continueCue">${state.index === state.selected.length - 1 ? '결과 요약 보기' : '계속'}</button></div>`;
  state.reviewPending = {cueId:c.id,result};
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeCueReview(false); });
  document.body.appendChild(dialog);
  dialog.showModal();
}

nextCue = function () {
  if (state.reviewPending) return;
  const c = current();
  if (!c) return;
  stopAudio();
  state.practiceNotice = null;
  state.error = '';
  const result = assessCue(c);
  state.results[c.id] = result;
  refreshPracticeTools();
  console.info('[MintScribe][04/completion] 다음 구간 이동 전 자동 확인', {
    section:state.index + 1,score:result.score,missing:result.missing,hinted:result.hinted,total:result.total
  });
  // Every section gets its accuracy moment, including a perfect answer.
  saveReviewProgress();
  openCueReview(c, result);
};

// Dialog buttons live outside the app shell; native modal focus traps the background.
document.addEventListener('click', event => {
  const action = event.target.closest('#cueReviewDialog [data-action]')?.dataset.action;
  if (action === 'continueCue') closeCueReview(true);
  if (action === 'retryCue') closeCueReview(false);
});

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
  const nextHint = word.length === 1 || level > 0 ? (('단어 전체 보기')) : (('첫 글자 보기'));
  return `<div class="tool-intro"><span class="tool-kicker">${('막힌 단어를 선택하세요')}</span><strong>${('남은 세션 힌트')} <em>${remainingLabel}</em> / ${allowanceLabel}</strong></div>
    <div class="hint-word-list" aria-label="${('단어별 힌트')}">${words.map((w, n) => { const done = wordIsCorrect(c, n), reveal = h.levels[n] || 0; const label = done ? `✓ ${esc((state.wordAnswers[c.id] || [])[n])}` : reveal === 2 ? esc(w) : reveal === 1 ? `${esc(w[0])}${'·'.repeat(Math.min(w.length - 1, 10))}` : `${w.length} ${('글자')}`; return `<button data-action="hintSelect" data-index="${n}" class="hint-word ${n === i ? 'current' : ''} ${done ? 'correct' : reveal ? 'system-shown' : ''}" aria-label="${n + 1}: ${w.length} ${('글자')}"><small>${n + 1}</small><b>${label}</b></button>`; }).join('')}</div>
    <div class="hint-focus"><div><small>${(`${i + 1}번 단어 · ${word.length}글자`)}</small><div class="hint-focus-word ${correct ? 'correct' : ''}">${visible}</div></div><button class="reveal-btn" data-action="reveal" ${correct || level >= 2 || !remaining ? 'disabled' : ''}>✦ ${correct ? (('직접 맞혔어요')) : level >= 2 ? (('단어 확인 완료')) : !remaining ? (('힌트를 모두 썼어요')) : nextHint}</button></div>
    <p class="tool-note">✧ ${('파란색은 직접 맞힌 단어, 회색은 AI 자막에서 보여 준 글자예요. 흰색은 아직 맞히지 못한 단어예요.')} ${t('aiNotice')}</p>`;
}

function resultWordKind(c, i) {
  // Any hint use, including the first letter, marks this word for review.
  const usedHint = (state.hints[c.id]?.levels?.[i] || 0) > 0;
  return !usedHint && wordIsCorrect(c, i) ? 'correct' : 'error';
}

function referenceResultMarkup(c, exported = false) {
  const source = String(c.text || '');
  const matches = [...source.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)];
  const colors = {correct:'#242424',error:'#BA3434'};
  let cursor = 0;
  return matches.map((match, i) => {
    const before = source.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    const kind = resultWordKind(c, i);
    const label = kind === 'correct' ? '직접 정답' : '복습할 단어';
    return `${esc(before)}<span class="result-word result-${kind}" data-result="${kind}" title="${label}"${exported ? ` style="color:${colors[kind]};"` : ''}>${esc(match[0])}</span>`;
  }).join('') + esc(source.slice(cursor));
}

function reviewMarkup(c, result) {
  if (!result) return `<div class="empty-panel"><span>◎</span><b>다음 자막을 누르면 결과가 여기에 표시돼요.</b><p>${t('reviewCaveat')}</p></div>`;
  return `<div class="review-head"><div class="review-ring ${result.score >= 80 ? 'passed' : ''}" style="--score:${result.score}%"><strong>${result.score}<small>%</small></strong></div><div><span>${t('similarity')}</span><b>${result.score >= 80 ? t('passed') : t('tryAgain')}</b><small>${t('threshold')}</small></div></div><div class="review-reference"><span>AI TRANSCRIPT</span><p>${referenceResultMarkup(c)}</p></div><p class="tool-note">${t('reviewCaveat')}</p>`;
}

function summaryExportMarkup() {
  const lines = state.selected.map((c, i) => `<div style="margin:0;padding:13px 0;border-bottom:1px solid #E1E1E1;"><div style="display:flex;gap:14px;align-items:baseline;color:#242424;font:500 16px/1.7 Pretendard,Arial,sans-serif;"><span style="flex:none;color:#777777;font:700 11px/1.7 Pretendard,Arial,sans-serif;">${String(i + 1).padStart(2, '0')}</span><span>${referenceResultMarkup(c, true)}</span></div></div>`).join('');
  return `<section style="background:#ffffff;border:1px solid #E1E1E1;border-radius:8px;padding:clamp(20px,3vw,34px);"><div style="color:#0F91FF;font:700 11px/1.4 Pretendard,Arial,sans-serif;letter-spacing:1.5px;">MINTSCRIBE 2.0 · TRANSCRIPT</div><h2 style="color:#242424;font:700 26px/1.35 Pretendard,Arial,sans-serif;margin:7px 0 4px;">나의 수업 받아쓰기</h2><p style="color:#777777;font:400 12px/1.6 Pretendard,Arial,sans-serif;margin:0 0 10px;">AI 자막을 기준으로 정리한 학습 결과입니다.</p><div>${lines}</div></section>`;
}

function renderSummary() {
  stopAudio();
  if (!state.selected.length) { renderHome(); return; }
  if (!isPracticeComplete()) {
    const unfinished = state.selected.filter(c => !cueIsComplete(c));
    state.index = state.selected.findIndex(c => !cueIsComplete(c));
    state.practiceNotice = {code:'SUMMARY_BLOCKED',cueId:current().id,remaining:unfinished.length};
    console.warn('[MintScribe][04/completion] 요약 진입 차단', {
      firstUnfinished:state.index + 1,remaining:unfinished.length,total:state.selected.length
    });
    renderPractice();
    const notice = $('#practiceNotice');
    notice?.focus({preventScroll:true});
    notice?.scrollIntoView({block:'center'});
    return;
  }
  state.practiceNotice = null;
  console.info('[MintScribe][04/completion] 모든 구간 확인 완료, 요약 진입', {total:state.selected.length});
  state.view = 'summary';
  const done = state.selected.filter(cueIsComplete).length;
  const rows = state.selected.map((c, i) => `<div class="summary-row"><span>${String(i + 1).padStart(2, '0')} · ${mmss(c.start)}</span><span>${state.results[c.id] ? state.results[c.id].score + '%' : '—'}</span></div>`).join('');
  shell(`<main class="page summary summary-v2"><header class="summary-v2-head"><div><div class="eyebrow">MINTSCRIBE 2.0 / REVIEW</div><h1>${('내가 받아쓴 수업')}</h1><p>${('AI 자막의 정답 문장과 나의 학습 결과를 함께 확인하세요.')}</p></div></header>
    <div id="exportView" class="summary-export">${summaryExportMarkup()}</div>
    <div class="summary-compact"><div><small>${t('completed')}</small><b>${done} / ${state.selected.length}</b></div><div><small>${t('avg')}</small><b>${done ? avgScore() + '%' : '—'}</b></div></div>
    <details class="summary-details"><summary>${('구간별 점수 보기')}</summary><div class="summary-list">${rows}</div></details>
    ${window.MintScribeSubmission.markup()}
    <div class="summary-v2-actions"><button class="secondary-btn" data-action="returnPractice">← ${('연습으로 돌아가기')}</button>${window.MintScribeLaunch.isIntegration ? '' : `<button class="secondary-btn" data-action="home">${t('newFiles')}</button>`}<button class="primary-btn" data-action="restart">${t('restart')} →</button></div>
    <p class="footnote">${t('reviewCaveat')}</p>
  </main>`);
  window.MintScribeSubmission.syncUI();
}

function wordInputsMarkup(c) {
  const words = wordTokens(c.text), typed = state.wordAnswers[c.id] || [];
  const count = words.length;
  return `<div class="word-entry" id="wordEntry" role="group" aria-label="${t('write')}">${Array.from({length: count}, (_, i) => {
    const word = words[i] || '', revealed = wordIsRevealed(c, i);
    const value = revealed ? word : typed[i] || '', correct = word && wordIsCorrect(c, i);
    const length = word.length;
    return `<label class="word-slot ${revealed ? 'revealed' : correct ? 'correct' : ''}" style="--slot-width:${Math.min(Math.max(length, 3), 16)}ch"><span class="slot-number">${i + 1}</span><input class="word-input" data-index="${i}" type="text" value="${esc(value)}" autocomplete="off" autocapitalize="off" spellcheck="false" ${revealed || correct ? 'disabled' : ''} aria-label="${(`${i + 1}번 단어, ${revealed ? 'AI 힌트로 공개됨' : correct ? '정답' : `${length}글자`}`)}" placeholder="${'·'.repeat(Math.min(length, 16))}"><span class="slot-length">${revealed ? (('AI 힌트')) : `${length} ${('글자')}`}</span></label>`;
  }).join('')}</div>`;
}

// Hint interactions update only their UI; never replace the active media element.
function refreshPracticeMetrics() {
  const progress = $('.session-progress b'), fill = $('.session-progress .progress-fill');
  if (progress) progress.textContent = `${progressPercent()}%`;
  if (fill) fill.style.width = `${progressPercent()}%`;
  const stats = document.querySelectorAll('.session-strip .strip-stat b');
  if (stats[0]) stats[0].textContent = Object.keys(state.results).length ? `${avgScore()}%` : '—';
  if (stats[1]) stats[1].textContent = `${state.selected.filter(c => cueIsComplete(c) && state.results[c.id].score >= 80).length}/${state.selected.length}`;
}

function refreshPracticeTools({refreshWords = false} = {}) {
  const c = current();
  if (state.view !== 'practice' || !c) return;
  const panel = state.panel === 'review' ? 'review' : 'hint';
  const content = $('.tool-content');
  if (content) content.innerHTML = panel === 'review' ? reviewMarkup(c, state.results[c.id]) : hintMarkup(c);
  for (const tab of document.querySelectorAll('.tool-tabs [data-action="panel"]')) {
    const selected = tab.dataset.panel === panel;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  }
  $('.workbench')?.classList.toggle('compact-tool-open', Boolean(state.compactToolOpen));
  if (refreshWords) {
    const entry = $('#wordEntry');
    if (entry) {
      entry.outerHTML = wordInputsMarkup(c);
      bindWordInputs(c);
    }
    const answer = $('#answer');
    if (answer) answer.value = state.answers[c.id] || '';
  }
  if (!state.results[c.id]) document.querySelector('[data-panel="review"] i')?.remove();
  if (!state.practiceNotice) $('#practiceNotice')?.remove();
  refreshPracticeMetrics();
  scheduleFloatingPlayer();
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
  const pct = progressPercent(), panel = state.panel === 'review' ? 'review' : 'hint';
  shell(`<main class="page practice-page">
    <div class="practice-head"><h1 class="lesson-teacher">${esc((window.MintScribeLaunch.teacherName || '').trim() || '무명')} 강사님 수업</h1>${window.MintScribeLaunch.isIntegration ? '' : `<div class="head-buttons"><button class="ghost-btn" data-action="home">← <span>${t('back')}</span></button></div>`}</div>
    <div class="session-strip"><div class="session-progress"><span>전체 진행도 <b>${pct}%</b></span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div><div class="strip-stat"><small>${t('score')}</small><b>${Object.keys(state.results).length ? avgScore() + '%' : '—'}</b></div><div class="strip-stat"><small>통과구간</small><b>${state.selected.filter(c => cueIsComplete(c) && state.results[c.id].score >= 80).length}/${state.selected.length}</b></div></div>
    ${practiceNoticeMarkup()}
    <div class="workbench ${state.compactToolOpen ? 'compact-tool-open' : ''}"><section class="listen-surface"><div class="cue-bar"><div><h2 class="section-title">구간 <b>${String(state.index + 1).padStart(2, '0')}</b><span>/${String(state.selected.length).padStart(2, '0')}</span></h2></div></div>
      <div class="cue-time">${mmss(c.start)} — ${mmss(c.end)} <span>·</span> ${duration(c)} <span>·</span> ${wordTokens(c.text).length} ${t('words')}</div>
      <div class="player-anchor"><div class="player"><button class="play-button" data-action="play" ${state.sample ? 'disabled' : ''} aria-label="${t('play')}">▶</button><button class="restart-button" data-action="restartAudio" ${state.sample ? 'disabled' : ''} aria-label="${('처음부터 재생')}" title="${('처음부터 재생')}">⏮</button><input class="seek-bar" id="seekBar" type="range" min="${c.start}" max="${c.end}" step="0.01" value="${c.start}" style="--seek-pct:0%" aria-label="${('재생 위치')}" aria-valuetext="${mmss(c.start)}" ${state.sample ? 'disabled' : ''}><div class="player-time" id="playerTime">${mmss(c.start)} / ${mmss(c.end)}</div></div></div>
      <div class="play-options"><button class="pill-btn ${state.loop ? 'active' : ''}" data-action="loop" aria-pressed="${state.loop}">↺ ${t('loop')}</button><select id="speed" class="speed-select" aria-label="${t('slow')}"><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option></select></div>
      ${state.sample ? `<div class="sample-note">${t('sampleNoAudio')}</div>` : ''}
      <div class="write-label"><span>${t('write')}</span><small>${('단어 아래 글자 수를 보고 입력하세요')}</small></div>${wordInputsMarkup(c)}<textarea id="answer" class="hidden" tabindex="-1" aria-hidden="true">${esc(state.answers[c.id] || '')}</textarea>
      <div class="write-actions"><div class="caption-actions"><button class="secondary-btn" data-action="prev" ${state.index === 0 ? 'disabled' : ''}>← ${('이전 자막')}</button><button class="primary-btn" data-action="next">${state.index === state.selected.length - 1 ? t('finish') : t('next')} →</button></div><span class="ai-caution">✦ AI STT ${('기준')}</span></div>
    </section><section class="insight-surface"><div class="tool-tabs" role="tablist" aria-label="연습 도구"><button class="compact-write-tab" role="tab" data-action="toolClose">✎ ${('받아쓰기')}</button><button role="tab" data-action="panel" data-panel="hint" aria-selected="${panel === 'hint'}" class="${panel === 'hint' ? 'active' : ''}">✧ ${('힌트')}</button><button role="tab" data-action="panel" data-panel="review" aria-selected="${panel === 'review'}" class="${panel === 'review' ? 'active' : ''}">◎ ${('확인')}${result ? '<i></i>' : ''}</button></div><div class="tool-content">${panel === 'review' ? reviewMarkup(c, result) : hintMarkup(c)}</div></section></div>
    <audio id="sourceAudio" src="${esc(state.audioUrl || '')}" preload="metadata"></audio>
  </main>`);
  bindPractice();
  bindSeekBar(c);
  bindAudioDiagnostics();
  bindWordInputs(c);
  scheduleFloatingPlayer();
}

// Keep the existing controls visible across both the writing and tools sections.
// A placeholder preserves their original space; the audio element is untouched.
let floatingPlayerFrame = 0;
function updateFloatingPlayer() {
  const player = document.querySelector('.practice-page .player');
  const anchor = player?.parentElement;
  if (!player || !anchor?.classList.contains('player-anchor')) return;
  const enabled = window.matchMedia('(max-width:760px),(max-height:700px)').matches
    || document.documentElement.classList.contains('keyboard-open');
  const top = Math.max(0, parseFloat(getComputedStyle(player).top) || 0);
  const bounds = anchor.getBoundingClientRect();
  const floating = enabled && bounds.width > 0 && bounds.top < top;
  if (floating) {
    // Reserve height before taking the controls out of normal document flow.
    anchor.style.height = `${player.getBoundingClientRect().height}px`;
    player.style.left = `${bounds.left}px`;
    player.style.width = `${bounds.width}px`;
    player.classList.add('player-floating');
    // Width changes (rotation, window resize) may change the controls' height.
    anchor.style.height = `${player.getBoundingClientRect().height}px`;
  } else {
    player.classList.remove('player-floating');
    player.style.removeProperty('left');
    player.style.removeProperty('width');
    anchor.style.removeProperty('height');
  }
}
function scheduleFloatingPlayer() {
  if (floatingPlayerFrame) return;
  floatingPlayerFrame = requestAnimationFrame(() => {
    floatingPlayerFrame = 0;
    updateFloatingPlayer();
  });
}
window.addEventListener('scroll', scheduleFloatingPlayer, {passive:true,capture:true});
window.addEventListener('resize', scheduleFloatingPlayer, {passive:true});
window.visualViewport?.addEventListener('resize', scheduleFloatingPlayer, {passive:true});
window.visualViewport?.addEventListener('scroll', scheduleFloatingPlayer, {passive:true});

function bindAudioDiagnostics() {
  const audio = $('#sourceAudio');
  audio.addEventListener('loadedmetadata', () => {
    console.info('[MintScribe][02/audio] 음원 정보 수신', {duration:audio.duration,readyState:audio.readyState});
  });
  audio.addEventListener('playing', () => {
    console.info('[MintScribe][02/audio] 음원 재생', {currentTime:audio.currentTime,readyState:audio.readyState});
    document.querySelector('.audio-load-error')?.remove();
  });
  audio.addEventListener('error', () => {
    const code = audio.error?.code || 0;
    const message = audioLoadErrorMessage(code);
    console.error('[MintScribe][02/audio] 음원 불러오기 실패', {code,networkState:audio.networkState,readyState:audio.readyState});
    document.querySelector('.audio-load-error')?.remove();
    const notice = document.createElement('div');
    notice.className = 'notice error audio-load-error';
    notice.setAttribute('role', 'alert');
    notice.textContent = `${message} [AUDIO_${code}]`;
    document.querySelector('.play-options')?.after(notice);
    state.playing = false;
    syncPlayButton();
  });
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

    syncPlayButton();
  } catch (error) { alert(error.message); }
}

let keyboardBaselineHeight = window.visualViewport?.height || window.innerHeight;
let keyboardFocusTimer;
let keyboardViewportTimer;

function keepFocusedWordVisible() {
  scheduleFloatingPlayer();
  const input = document.activeElement;
  const viewport = window.visualViewport;
  if (!input?.classList.contains('word-input') || !viewport) {
    document.documentElement.classList.remove('keyboard-open');
    document.documentElement.style.removeProperty('--keyboard-inset');
    keyboardBaselineHeight = viewport?.height || window.innerHeight;
    return;
  }
  const visibleBottom = viewport.offsetTop + viewport.height;
  const covered = Math.max(0, Math.max(window.innerHeight, document.documentElement.clientHeight) - visibleBottom);
  const shrink = Math.max(0, keyboardBaselineHeight - viewport.height);
  if (Math.max(covered, shrink) < 120) {
    if (document.documentElement.classList.contains('keyboard-open')) {
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.removeProperty('--keyboard-inset');
      keyboardBaselineHeight = viewport.height;
    }
    return;
  }
  document.documentElement.style.setProperty('--keyboard-inset', `${Math.ceil(Math.max(covered, shrink))}px`);
  document.documentElement.classList.add('keyboard-open');
  requestAnimationFrame(() => {
    if (document.activeElement !== input) return;
    const rect = input.closest('.word-slot').getBoundingClientRect();
    const viewportTop = viewport.offsetTop;
    const viewportBottom = viewport.offsetTop + viewport.height;
    const player = document.querySelector('.listen-surface .player');
    const playerRect = player?.getBoundingClientRect();
    const stickyTop = player ? Math.max(0, parseFloat(getComputedStyle(player).top) || 0) : 0;
    const topLimit = playerRect && playerRect.top <= viewportTop + stickyTop + 24 ? playerRect.bottom + 12 : viewportTop + 16;
    const bottomMargin = Math.max(72, Math.min(110, viewport.height * 0.12));
    if (rect.bottom > viewportBottom - bottomMargin) window.scrollBy(0, rect.bottom - viewportBottom + bottomMargin);
    else if (rect.top < topLimit) window.scrollBy(0, rect.top - topLimit);
  });
}

function scheduleKeyboardViewportCheck() {
  clearTimeout(keyboardViewportTimer);
  keyboardViewportTimer = setTimeout(keepFocusedWordVisible, 140);
}

document.addEventListener('focusin', event => {
  if (!event.target.classList?.contains('word-input')) return;
  clearTimeout(keyboardFocusTimer);
  keepFocusedWordVisible();
  keyboardFocusTimer = setTimeout(keepFocusedWordVisible, 450);
});
document.addEventListener('focusout', event => {
  if (!event.target.classList?.contains('word-input')) return;
  clearTimeout(keyboardFocusTimer);
  keyboardFocusTimer = setTimeout(keepFocusedWordVisible, 150);
});
window.visualViewport?.addEventListener('resize', scheduleKeyboardViewportCheck);
window.addEventListener('resize', scheduleKeyboardViewportCheck);

function bindWordInputs(c) {
  const entry = $('#wordEntry');
  const inputs = [...entry.querySelectorAll('.word-input')];
  const words = wordTokens(c.text);
  const focusEditable = (from, direction) => {
    for (let i = from + direction; i >= 0 && i < inputs.length; i += direction) {
      if (!inputs[i].disabled) { inputs[i].focus(); return; }
    }
  };
  const sync = () => {
    invalidateCueCheck(c, 'answer_changed');
    $('#practiceNotice')?.remove();
    const typed = state.wordAnswers[c.id] || [];
    const answer = typed.join(' ').trim();
    $('#answer').value = answer;
    state.answers[c.id] = answer;
    inputs.forEach((input, i) => {
      const correct = wordIsCorrect(c, i);
      input.closest('.word-slot').classList.toggle('correct', correct);
      input.disabled = wordIsRevealed(c, i) || correct;
    });
    if (state.panel === 'hint') { const content = $('.tool-content'); if (content) content.innerHTML = hintMarkup(c); }
    if (state.panel === 'review') { const content = $('.tool-content'); if (content) content.innerHTML = reviewMarkup(c, null); }
    document.querySelector('[data-panel="review"] i')?.remove();
    refreshPracticeMetrics();

  };
  inputs.forEach((input, i) => {
    const handleInput = event => {
      if (event.isComposing) return;
      const typed = state.wordAnswers[c.id] || (state.wordAnswers[c.id] = []);
      const pieces = input.value.trim().split(/\s+/);
      if (pieces.length > 1) {
        const targets = inputs.map((candidate, index) => !candidate.disabled && index >= i ? index : -1).filter(index => index >= 0);
        pieces.forEach((piece, offset) => { const index = targets[offset]; if (index !== undefined) { typed[index] = piece; inputs[index].value = piece; } });
        focusEditable(targets[Math.min(pieces.length, targets.length) - 1] ?? i, 1);
        sync();
        return;
      }
      let remaining = input.value;
      let position = i;
      let lastCorrect = -1;
      while (remaining && position < inputs.length) {
        if (inputs[position].disabled) { position++; continue; }
        const candidate = remaining.slice(0, words[position].length);
        if (!candidate || normalizedWord(candidate) !== normalizedWord(words[position])) break;
        typed[position] = candidate;
        inputs[position].value = candidate;
        remaining = remaining.slice(candidate.length);
        lastCorrect = position;
        position++;
      }
      if (remaining && position < inputs.length) {
        typed[position] = remaining;
        inputs[position].value = remaining;
      } else if (lastCorrect < 0) {
        typed[i] = input.value;
      }
      if (lastCorrect >= 0) {
        if (remaining && position < inputs.length && !inputs[position].disabled) inputs[position].focus();
        else focusEditable(lastCorrect, 1);
      }
      sync();
    };
    input.addEventListener('input', handleInput);
    input.addEventListener('compositionend', handleInput);
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
  if (action === 'restartAudio') { restartCueAudio(); }
  if (action === 'loadTab') { state.loadTab = button.dataset.tab; state.error = ''; renderHome(); }
  if (action === 'panel') { state.panel = button.dataset.panel === 'review' ? 'review' : 'hint'; state.compactToolOpen = true; refreshPracticeTools(); }
  if (action === 'toolClose') { state.compactToolOpen = false; refreshPracticeTools(); }
  if (action === 'prev' && state.index > 0) { stopAudio(); state.index--; renderPractice(); }
  if (action === 'hintPrev' && state.hintIndex > 0) { state.hintIndex--; refreshPracticeTools(); }
  if (action === 'hintNext' && state.hintIndex < wordTokens(current().text).length - 1) { state.hintIndex++; refreshPracticeTools(); }
  if (action === 'hintSelect') { state.hintIndex = Number(button.dataset.index); refreshPracticeTools(); }
  if (action === 'reveal') {
    const c = current(), h = hintState(c), i = state.hintIndex;
    if (state.hintUsed < hintAllowance() && !wordIsCorrect(c, i) && (h.levels[i] || 0) < 2) {
      h.levels[i] = wordTokens(c.text)[i]?.length === 1 ? 2 : (h.levels[i] || 0) + 1;
      h.uses++;
      state.hintUsed++;
      if (h.levels[i] === 2) {
        const typed = state.wordAnswers[c.id] || (state.wordAnswers[c.id] = []);
        typed[i] = wordTokens(c.text)[i];
        state.answers[c.id] = typed.join(' ').trim();
        invalidateCueCheck(c, 'word_revealed');
      }
      refreshPracticeTools({refreshWords:h.levels[i] === 2});
    }
  }
});

app.addEventListener('change', event => {
  if (event.target.id === 'scope') state.scope = event.target.value;
});



renderHome();

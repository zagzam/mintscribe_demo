/* One browser-local practice checkpoint. Media is written once; small progress is saved often. */
(function () {
  const databaseName = 'mintscribe-practice';
  const checkpointKey = 'mintscribe-practice-checkpoint';
  const sourceKey = 'mintscribe-practice-source-id';
  const entryLaunch = window.MintScribeEntry;
  let database = null;
  let savedSource = null;
  let savedProgress = null;
  let activeSourceId = null;
  let lastSessionView = 'practice';
  let replacingSource = false;
  let missingAudio = false;
  let pendingProgress = null;
  let writeTimer = null;
  let writeChain = Promise.resolve();
  let warned = false;
  let superseded = false;

  function normalizeUrl(value) {
    if (!value) return '';
    try { return new URL(value, location.href).href; } catch (_) { return ''; }
  }

  function canResume(source) {
    if (!source) return false;
    if (entryLaunch.isIntegration) {
      const launch = source.launch;
      return entryLaunch.status === 'ready' && source.kind === 'url'
        && launch?.isIntegration && launch.status === 'ready'
        && launch.token === entryLaunch.token && launch.environment === entryLaunch.environment
        && normalizeUrl(source.audioUrl) === normalizeUrl(entryLaunch.audioUrl)
        && normalizeUrl(source.transcriptUrl) === normalizeUrl(entryLaunch.transcriptUrl)
        && launch.urlScope === entryLaunch.urlScope && launch.minWords === entryLaunch.minWords;
    }
    if (entryLaunch.audioUrl || entryLaunch.transcriptUrl) {
      return !source.launch?.isIntegration && source.kind === 'url'
        && normalizeUrl(source.audioUrl) === normalizeUrl(entryLaunch.audioUrl)
        && normalizeUrl(source.transcriptUrl) === normalizeUrl(entryLaunch.transcriptUrl);
    }
    return true;
  }

  function activateLaunch(source, progress) {
    const saved = source.launch;
    const launch = saved || {
      ...entryLaunch, isIntegration: false, status: 'standalone', token: '',
      audioUrl: source.audioUrl || '', transcriptUrl: source.transcriptUrl || '',
      urlScope: null, minWords: 4
    };
    // Older checkpoints lacked an explicit mode. Only a valid new entry can supply it.
    const mode = launch.isIntegration
      ? (['dev','real'].includes(launch.mode) ? launch.mode : entryLaunch.isIntegration ? entryLaunch.mode : null)
      : null;
    const missingMode = launch.isIntegration && !['dev','real'].includes(mode);
    window.MintScribeLaunch = Object.freeze({
      ...launch, scope: progress.scope || launch.scope || '10',
      mode, environment: mode === 'dev' ? 'development' : mode === 'real' ? 'production' : null,
      status: missingMode ? 'incomplete' : launch.status,
      missingRequired: Object.freeze([...new Set([...(launch.missingRequired || []),...(missingMode ? ['mode'] : [])])]),
      invalidParameters: Object.freeze([...(launch.invalidParameters || [])])
    });
    state.urlScope = window.MintScribeLaunch.urlScope;
    state.minWords = window.MintScribeLaunch.minWords;
  }

  function storedSourceId() {
    try { return localStorage.getItem(sourceKey); } catch (_) { return null; }
  }

  function markSource(id) {
    try { localStorage.setItem(sourceKey, id); } catch (_) { /* IndexedDB checks ownership too. */ }
  }

  function ownsSource() {
    const id = storedSourceId();
    return !superseded && (!id || id === activeSourceId);
  }

  const originalRenderHome = renderHome;
  const originalRenderPractice = renderPractice;
  const originalStartLocal = startLocal;
  const originalStartUrls = startUrls;

  function storageWarning(message) {
    if (warned) return;
    warned = true;
    const warning = document.createElement('div');
    warning.className = 'storage-warning';
    warning.setAttribute('role', 'alert');
    warning.textContent = message;
    document.body.appendChild(warning);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function readRecord(key) {
    return new Promise((resolve, reject) => {
      const request = database.transaction('records', 'readonly').objectStore('records').get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  function writeRecords(entries) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      for (const [key, value] of entries) store.put(value, key);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function writeCurrentProgress(progress) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      const store = transaction.objectStore('records');
      const request = store.get('source');
      request.onsuccess = () => {
        if (request.result?.id === progress.sourceId) store.put(progress, 'progress');
      };
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function clearRecords() {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      transaction.objectStore('records').clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function enqueueWrite(work) {
    writeChain = writeChain.catch(() => {}).then(work);
    return writeChain;
  }

  function readLocalCheckpoint() {
    try { return JSON.parse(localStorage.getItem(checkpointKey) || 'null'); }
    catch (_) { return null; }
  }

  function writeLocalCheckpoint(progress) {
    try { localStorage.setItem(checkpointKey, JSON.stringify(progress)); }
    catch (_) { /* IndexedDB still holds a copy. */ }
  }

  function snapshot(sourceId = activeSourceId) {
    if (!sourceId || !state.selected.length) return null;
    const view = state.view === 'home' ? lastSessionView : state.view;
    const complete = isPracticeComplete();
    return {
      version: 2, sourceId, savedAt: Date.now(), view: view === 'summary' && complete ? 'summary' : 'practice',
      selectedIds: state.selected.map(cue => cue.id), index: state.index,
      answers: state.answers, wordAnswers: state.wordAnswers, results: state.results,
      hints: state.hints, hintUsed: state.hintUsed, seconds: state.seconds,
      cueSeconds: state.cueSeconds, scope: state.practiceScope || state.scope,
      panel: state.panel, hintIndex: state.hintIndex, paused: state.paused,
      loop: state.loop, playbackRate: state.playbackRate || 1,
      nameHide: state.nameHide === 'Y' ? 'Y' : 'N',
      registration: state.registration || null
    };
  }

  function flushProgress() {
    clearTimeout(writeTimer);
    writeTimer = null;
    const progress = pendingProgress;
    pendingProgress = null;
    if (!progress || !database) return writeChain.catch(() => {});
    return enqueueWrite(() => writeCurrentProgress(progress)).catch(error => {
      console.error('[MintScribe][03/store] 진행 기록 저장 실패', {errorType: error.name});
      storageWarning(state.lang === 'ko'
        ? '연습 기록을 브라우저에 저장하지 못했습니다. 저장 공간을 확인해 주세요.'
        : 'Could not save practice progress. Check browser storage space.');
    });
  }

  function saveProgress() {
    if (replacingSource || !activeSourceId || !state.selected.length) return;
    if (!ownsSource()) return;
    const progress = snapshot();
    if (!progress) return;
    lastSessionView = progress.view;
    savedProgress = progress;
    writeLocalCheckpoint(progress);
    pendingProgress = progress;
    clearTimeout(writeTimer);
    writeTimer = setTimeout(flushProgress, 250);
  }

  function resumeMarkup(progress, source) {
    const korean = state.lang === 'ko';
    const finished = Object.keys(progress.results || {}).length;
    const total = progress.selectedIds?.length || 0;
    const name = esc(source.textName || (korean ? '이전 수업' : 'Previous class'));
    return `<section class="resume-card" aria-label="${korean ? '저장된 연습' : 'Saved practice'}">
      <div class="resume-copy"><small>${korean ? '자동 저장된 최근 연습' : 'Last autosaved practice'}</small><strong>${name}</strong><span>${korean ? `확인한 구간 ${finished}/${total} · 집중 시간 ${mmss(progress.seconds || 0)}` : `${finished}/${total} checked · Active time ${mmss(progress.seconds || 0)}`}</span></div>
      <div class="resume-actions"><button type="button" class="resume-button" data-action="resumePractice">${korean ? '이어서 하기' : 'Resume'} →</button><button type="button" class="resume-clear" data-action="clearPractice">${korean ? '기록 삭제' : 'Delete saved practice'}</button></div>
    </section>`;
  }

  function showResumeCard() {
    document.querySelector('.resume-card')?.remove();
    if (superseded) return;
    if (activeSourceId && !ownsSource()) return;
    const progress = activeSourceId && state.selected.length ? snapshot() : savedProgress;
    const source = savedSource;
    if (!progress || !source || !canResume(source) || state.view !== 'home') return;
    if (storedSourceId() && storedSourceId() !== source.id) return;
    const heading = document.querySelector('.neon-load .load-head');
    heading?.insertAdjacentHTML('afterend', resumeMarkup(progress, source));
  }

  renderHome = function () {
    originalRenderHome();
    showResumeCard();
  };

  function showMissingAudio() {
    if (!missingAudio || state.view !== 'practice') return;
    const player = document.querySelector('.listen-surface .player');
    if (!player) return;
    player.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
    const korean = state.lang === 'ko';
    player.insertAdjacentHTML('afterend', `<div class="missing-audio"><span>${korean ? '받아쓰기 기록은 복구됐어요. 음원 파일을 다시 선택하면 이어서 들을 수 있습니다.' : 'Your transcription is restored. Select the recording again to continue listening.'}</span><button type="button" class="secondary-btn" data-action="chooseResumeAudio">${korean ? '음원 다시 선택' : 'Choose recording'}</button><input id="resumeAudioInput" type="file" accept=".m4a,.mp3,audio/*" hidden></div>`);
  }

  renderPractice = function () {
    originalRenderPractice();
    showMissingAudio();
  };

  async function beginNewPractice(start, kind, scope) {
    await ready;
    if (state.loadingUrls || replacingSource) return;
    if (savedProgress && !confirm(state.lang === 'ko'
      ? '새 연습을 시작하면 저장된 이전 연습이 교체됩니다. 계속할까요?'
      : 'Starting a new practice will replace your saved practice. Continue?')) return;
    replacingSource = true;
    const previousPracticeScope = state.practiceScope;
    let started = false;
    clearTimeout(writeTimer);
    pendingProgress = null;
    try {
      await start(scope);
      if (state.view !== 'practice' || !state.selected.length) return;
      started = true;
      // Detach the old ID before saving new files, including when storage fails.
      activeSourceId = null;
      const sourceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const source = {
        version: 2, id: sourceId, kind, textName: state.textName, cues: state.cues,
        launch: {...window.MintScribeLaunch, missingRequired: [...window.MintScribeLaunch.missingRequired]},
        audioFile: kind === 'local' ? state.audioFile : null,
        textFile: kind === 'local' ? state.textFile : null,
        audioUrl: kind === 'url' ? state.audioUrl : null,
        transcriptUrl: kind === 'url' ? state.textUrlInput : null,
        audioName: state.audioFile?.name || null,
        audioSize: state.audioFile?.size ?? null,
        audioMissing: false
      };
      const progress = snapshot(sourceId);
      try {
        await enqueueWrite(() => writeRecords([['source', source], ['progress', progress]]));
      } catch (error) {
        if (kind !== 'local') throw error;
        source.audioFile = null;
        source.audioMissing = true;
        await enqueueWrite(() => writeRecords([['source', source], ['progress', progress]]));
        storageWarning(state.lang === 'ko'
          ? '음원 저장 공간이 부족합니다. 받아쓰기는 저장되지만, 다음에 이어할 때 음원을 다시 선택해야 합니다.'
          : 'The recording could not be saved. Your transcription is saved, but you will need to select the recording again.');
      }
      activeSourceId = sourceId;
      superseded = false;
      markSource(sourceId);
      savedSource = source;
      savedProgress = progress;
      lastSessionView = 'practice';
      missingAudio = false;
      writeLocalCheckpoint(progress);
      console.info('[MintScribe][03/store] 새 연습과 연동 정보 저장 완료', {
        sourceId, kind, isIntegration: source.launch.isIntegration,
        environment: source.launch.environment, selectedCaptions: progress.selectedIds.length
      });
    } catch (error) {
      console.error('[MintScribe][03/store] 새 연습 저장 실패', {errorType: error.name});
      storageWarning(state.lang === 'ko'
        ? '이 연습은 자동 저장되지 않습니다. 브라우저 저장 공간을 확인해 주세요.'
        : 'This practice is not being autosaved. Check browser storage space.');
    } finally {
      if (!started) state.practiceScope = previousPracticeScope;
      replacingSource = false;
    }
  }

  startLocal = scope => beginNewPractice(originalStartLocal, 'local', scope);
  startUrls = () => beginNewPractice(originalStartUrls, 'url');

  function restorePractice() {
    if (!savedSource || !savedProgress) return;
    const source = savedSource, progress = savedProgress;
    if (superseded || !canResume(source) || (storedSourceId() && storedSourceId() !== source.id)) {
      console.warn('[MintScribe][03/store] 현재 링크와 다른 연습의 복원을 차단했습니다.');
      state.error = state.lang === 'ko'
        ? '현재 수업과 저장된 연습 정보가 다릅니다. 현재 수업을 새로 시작해 주세요.'
        : 'The saved practice does not match this class. Start this class again.';
      renderHome();
      return;
    }
    activateLaunch(source, progress);
    console.info('[MintScribe][03/store] 연습과 연동 정보 복원', {
      sourceId: source.id, isIntegration: window.MintScribeLaunch.isIntegration,
      environment: window.MintScribeLaunch.environment, selectedCaptions: progress.selectedIds?.length || 0,
      index: progress.index || 0
    });
    const resumeSummary = progress.view === 'summary' && progress.selectedIds?.length > 0
      && progress.selectedIds.every(id => progress.results?.[id]);
    if (activeSourceId === source.id && state.selected.length && state.view === 'home') {
      if (resumeSummary) renderSummary();
      else renderPractice();
      return;
    }
    if (state.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(state.audioUrl);
    activeSourceId = source.id;
    lastSessionView = progress.view;
    state.cues = source.cues;
    state.selected = (progress.selectedIds || []).map(id => state.cues.find(cue => cue.id === id)).filter(Boolean);
    if (!state.selected.length) { activeSourceId = null; return; }
    state.index = Math.max(0, Math.min(progress.index || 0, state.selected.length - 1));
    state.answers = progress.answers || {};
    state.wordAnswers = progress.wordAnswers || {};
    state.results = progress.results || {};
    state.hints = progress.hints || {};
    state.hintUsed = progress.hintUsed || 0;
    state.seconds = progress.seconds || 0;
    state.cueSeconds = progress.cueSeconds || {};
    state.scope = progress.scope || '10';
    state.practiceScope = state.scope;
    state.panel = progress.panel || 'hint';
    state.hintIndex = progress.hintIndex || 0;
    state.paused = Boolean(progress.paused);
    state.loop = Boolean(progress.loop);
    state.playbackRate = progress.playbackRate || 1;
    state.nameHide = progress.nameHide === 'Y' ? 'Y' : 'N';
    state.registration = window.MintScribeSubmission.restoreRegistration(progress.registration);
    state.textName = source.textName;
    state.sample = false;
    state.audioFile = source.audioFile || null;
    state.textFile = source.textFile || null;
    state.audioUrlInput = source.audioUrl || '';
    state.textUrlInput = source.transcriptUrl || '';
    state.loadTab = source.kind === 'url' ? 'url' : 'files';
    missingAudio = source.kind === 'local' && !source.audioFile;
    state.audioUrl = missingAudio ? null : source.kind === 'local' ? URL.createObjectURL(source.audioFile) : source.audioUrl;
    state.lastRenderedCue = null;
    state.lastResultKey = progress.results?.[state.selected[state.index].id]
      ? `${state.selected[state.index].id}:${progress.results[state.selected[state.index].id].score}` : null;
    if (resumeSummary) renderSummary();
    else renderPractice();
  }

  async function deleteSavedPractice() {
    if (superseded || (storedSourceId() && storedSourceId() !== savedSource?.id)) {
      console.warn('[MintScribe][03/store] 다른 창에서 변경된 연습의 삭제를 차단했습니다.');
      return;
    }
    if (!confirm(state.lang === 'ko'
      ? '저장된 받아쓰기, 점수, 힌트와 음원을 모두 삭제할까요? 되돌릴 수 없습니다.'
      : 'Delete the saved transcription, scores, hints, and recording? This cannot be undone.')) return;
    await ready;
    clearTimeout(writeTimer);
    pendingProgress = null;
    activeSourceId = null;
    superseded = false;
    await enqueueWrite(clearRecords);
    try { localStorage.removeItem(checkpointKey); } catch (_) { /* Storage may be unavailable. */ }
    savedSource = null;
    savedProgress = null;
    try { localStorage.removeItem(sourceKey); } catch (_) { /* Storage may be unavailable. */ }
    window.MintScribeLaunch = entryLaunch;
    stopAudio();
    if (state.audioUrl?.startsWith('blob:')) URL.revokeObjectURL(state.audioUrl);
    resetSession();
    state.audioFile = null;
    state.textFile = null;
    state.audioUrl = null;
    state.audioUrlInput = entryLaunch.audioUrl;
    state.textUrlInput = entryLaunch.transcriptUrl;
    state.urlScope = entryLaunch.urlScope;
    state.scope = entryLaunch.scope;
    state.practiceScope = entryLaunch.scope;
    state.minWords = entryLaunch.minWords;
    state.textName = '';
    state.cues = [];
    state.selected = [];
    state.loadTab = entryLaunch.audioUrl || entryLaunch.transcriptUrl ? 'url' : 'files';
    missingAudio = false;
    renderHome();
  }

  async function chooseMissingAudio(file) {
    if (!file || !savedSource) return;
    if (file.name !== savedSource.audioName || file.size !== savedSource.audioSize) {
      alert(state.lang === 'ko' ? '이전에 사용한 음원 파일을 선택해 주세요.' : 'Select the recording used for this practice.');
      return;
    }
    state.audioFile = file;
    state.audioUrl = URL.createObjectURL(file);
    missingAudio = false;
    savedSource.audioFile = file;
    savedSource.audioMissing = false;
    enqueueWrite(() => writeRecords([['source', savedSource]])).catch(() => {
      savedSource.audioFile = null;
      savedSource.audioMissing = true;
      storageWarning(state.lang === 'ko'
        ? '음원은 이번 화면에서 재생할 수 있지만 브라우저에는 저장되지 않았습니다.'
        : 'The recording will play now but could not be saved in this browser.');
    });
    renderPractice();
  }

  document.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'home' && (state.view === 'practice' || state.view === 'summary')) lastSessionView = state.view;
    if (action === 'restart' && !confirm(state.lang === 'ko'
      ? '현재 수업의 받아쓰기, 점수, 힌트와 시간을 지우고 처음부터 다시 연습할까요?'
      : 'Clear this class’s transcription, scores, hints, and time to practice again?')) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  }, true);

  app.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'resumePractice') { restorePractice(); return; }
    if (action === 'clearPractice') { deleteSavedPractice().catch(() => storageWarning(state.lang === 'ko' ? '기록을 삭제하지 못했습니다.' : 'Could not delete saved practice.')); return; }
    if (action === 'chooseResumeAudio') { document.getElementById('resumeAudioInput')?.click(); return; }
    if (action && action !== 'start' && action !== 'urlLoad' && action !== 'theme') saveProgress();
  });

  app.addEventListener('input', event => {
    if (event.target.matches('.word-input, #answer')) saveProgress();
  });
  app.addEventListener('change', event => {
    if (event.target.id === 'cueJump' || event.target.id === 'speed' || event.target.id === 'nameHide') saveProgress();
    if (event.target.id === 'resumeAudioInput') chooseMissingAudio(event.target.files?.[0]);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveProgress(); flushProgress(); } });
  window.addEventListener('pagehide', () => { saveProgress(); flushProgress(); });
  window.addEventListener('storage', event => {
    if (event.key !== sourceKey) return;
    if (!activeSourceId) {
      if (savedSource && event.newValue !== savedSource.id) {
        savedSource = null;
        savedProgress = null;
      }
      showResumeCard();
      return;
    }
    if (event.newValue === activeSourceId) return;
    superseded = true;
    clearTimeout(writeTimer);
    pendingProgress = null;
    console.warn('[MintScribe][03/store] 다른 창의 새 연습을 보호하기 위해 이 창의 자동 저장을 중지했습니다.');
    storageWarning(state.lang === 'ko'
      ? '다른 창에서 연습 기록이 변경되었습니다. 이 창의 내용은 더 이상 자동 저장되지 않습니다. 최신 수업 링크를 다시 열어 주세요.'
      : 'Practice changed in another tab. This tab is no longer autosaving. Reopen the latest class link.');
    showResumeCard();
  });
  setInterval(() => { if (activeSourceId && state.view === 'practice') saveProgress(); }, 5000);

  window.MintScribePracticeStore = Object.freeze({
    checkpoint: () => { saveProgress(); return flushProgress(); },
    isCurrent: () => !superseded && (!activeSourceId || ownsSource())
  });

  const ready = (async () => {
    try {
      database = await openDatabase();
      const [source, idbProgress] = await Promise.all([readRecord('source'), readRecord('progress')]);
      savedSource = source;
      const localProgress = readLocalCheckpoint();
      savedProgress = source && localProgress?.sourceId === source.id && localProgress.savedAt >= (idbProgress?.savedAt || 0)
        ? localProgress : idbProgress?.sourceId === source?.id ? idbProgress : null;
      if (source && !storedSourceId()) markSource(source.id);
      console.info('[MintScribe][03/store] 저장된 연습 확인', {
        available: Boolean(savedProgress), compatibleWithLink: Boolean(savedProgress && canResume(source)),
        isIntegration: Boolean(source?.launch?.isIntegration)
      });
      if (savedProgress && state.view === 'home') showResumeCard();
    } catch (_) {
      storageWarning(state.lang === 'ko'
        ? '브라우저 저장 기능을 사용할 수 없어 연습 기록이 자동 저장되지 않습니다.'
        : 'Browser storage is unavailable, so practice progress will not be saved.');
    }
  })();
})();

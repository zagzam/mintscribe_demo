/* Registration payload, API transport and same-window return navigation. */
(function () {
  'use strict';

  state.nameHide = 'N';
  state.registration = null;
  let inFlight = false;

  const previousResetSession = resetSession;
  resetSession = function () {
    previousResetSession();
    state.nameHide = 'N';
    state.registration = null;
  };

  function message(code) {

    const messages = {
      NOT_LINKED: ('민트 홈페이지에서 수업을 열어 주세요.'),
      MISSING_TOKEN: ('수업 연결 정보가 부족합니다. 민트 홈페이지에서 수업을 다시 열어 주세요.'),
      INVALID_MODE: ('접속 환경이 올바르지 않습니다. mode=dev 또는 mode=real이 포함된 수업 링크를 민트 홈페이지에서 다시 열어 주세요.'),
      INCOMPLETE_PRACTICE: ('모든 구간을 확인한 뒤 등록할 내용을 확인해 주세요.'),
      PREPARATION_FAILED: ('등록할 내용을 준비하지 못했습니다. 다시 시도해 주세요.'),
      PENDING: ('민트 홈페이지에 등록하고 있습니다. 잠시 기다려 주세요.'),
      RETURN_GUIDANCE: ('등록이 완료되었습니다. 자동으로 이동하지 않으면 아래 버튼으로 민트 홈페이지에 돌아가 주세요.'),
      SUCCESS: ('게시글이 등록되었습니다.'),
      SESSION_CHANGED: ('다른 창에서 연습 기록이 변경되었습니다. 최신 수업 링크를 다시 열어 주세요.'),
      NETWORK_ERROR: ('서버 응답을 받지 못했습니다. 민트 홈페이지에서 게시글 등록 여부를 확인해 주세요.'),
      TIMEOUT: ('등록 응답 시간이 초과되었습니다. 민트 홈페이지에서 게시글 등록 여부를 확인해 주세요.'),
      INVALID_RESPONSE: ('서버 응답을 해석하지 못했습니다. 민트 홈페이지에서 게시글 등록 여부를 확인해 주세요.'),
      REQUEST_INTERRUPTED: ('이전 등록 요청의 결과를 확인하지 못했습니다. 민트 홈페이지에서 게시글 등록 여부를 확인해 주세요.'),
      REGISTRATION_FAILED: ('등록에 실패했습니다.'),
      AUTH_GUIDANCE: ('이 연결 정보로는 다시 등록할 수 없습니다. 작성 내용은 유지됩니다. 민트 홈페이지에서 수업을 다시 열어 주세요.'),
      DUPLICATE_GUIDANCE: ('이미 작성한 수업이므로 다시 제출하지 않습니다. 민트 홈페이지에서 등록된 게시글을 확인해 주세요.'),
      INPUT_GUIDANCE: ('전달된 입력 정보를 확인해 주세요. 필요하면 민트 홈페이지에서 수업을 다시 열어 주세요. 작성 내용과 익명 선택은 유지됩니다.'),
      SERVER_GUIDANCE: ('작성 내용과 익명 선택은 유지됩니다. 잠시 후 다시 등록하기를 눌러 주세요.'),
      DETAIL_GUIDANCE: ('서버 안내를 확인해 주세요. 원인이 해결된 뒤 직접 다시 시도할 수 있습니다. 작성 내용과 익명 선택은 유지됩니다.'),
      UNKNOWN_GUIDANCE: ('등록 여부가 아직 확실하지 않습니다. 민트 홈페이지에서 게시글이 없는 것을 확인한 경우에만 다시 제출해 주세요.')
    };
    return messages[code] || messages.PREPARATION_FAILED;
  }

  function buildPayload() {
    const launch = window.MintScribeLaunch;
    const fail = code => { const error = new Error(message(code)); error.code = code; throw error; };
    if (!launch.isIntegration) fail('NOT_LINKED');
    if (!['dev','real'].includes(launch.mode)) fail('INVALID_MODE');
    if (window.MintScribePracticeStore && !window.MintScribePracticeStore.isCurrent()) fail('SESSION_CHANGED');
    if (launch.status !== 'ready' || !launch.token.trim()) fail('MISSING_TOKEN');
    if (state.view !== 'summary' || !isPracticeComplete()) fail('INCOMPLETE_PRACTICE');
    return Object.freeze({
      token: launch.token,
      content: summaryExportMarkup(),
      name_hide: state.nameHide === 'Y' ? 'Y' : 'N'
    });
  }

  function apiUrl() {
    const mode = window.MintScribeLaunch.mode;
    if (mode === 'dev') return 'https://dsapi.mintspeaking.com/index.php/boards/dictation/write_article_external';
    if (mode === 'real') return 'https://lbapi.mint05.com/boards/dictation/write_article_external';
    const error = new Error(message('INVALID_MODE')); error.code = 'INVALID_MODE'; throw error;
  }

  function registration() {
    return state.registration || {status:'idle'};
  }

  function homeUrl() {
    const mode = window.MintScribeLaunch.mode;
    return mode === 'dev' ? 'https://dsm.mintspeaking.com/'
      : mode === 'real' ? 'https://story.mint05.com/' : 'https://mint05.com/';
  }

  function returnUrl(result = registration()) {
    if (result.status === 'success' && result.redirectUrl) {
      try {
        const target = new URL(result.redirectUrl);
        if (target.protocol === 'https:' && target.origin === new URL(homeUrl()).origin
          && !target.username && !target.password) return result.redirectUrl;
      } catch (_) { /* Keep the successful registration and offer the homepage. */ }
    }
    return homeUrl();
  }

  function returnToMint(expected = registration()) {
    if (expected.status !== 'success' || registration() !== expected) return;
    if (window.MintScribePracticeStore && !window.MintScribePracticeStore.isCurrent()) return;
    const target = returnUrl(expected);
    console.info('[MintScribe][08/redirect] 홈페이지 이동', {
      mode:window.MintScribeLaunch.mode, destinationHost:new URL(target).hostname,
      articleRedirect:target !== homeUrl()
    });
    try { window.location.replace(target); }
    catch (error) {
      console.warn('[MintScribe][08/redirect] 자동 이동 실패. 돌아가기 버튼을 이용해 주세요.', {errorType:error.name});
      syncUI();
    }
  }

  function errorPolicy(result = registration()) {
    if (result.status === 'success') return {category:'none',retry:false,home:true,guidance:'RETURN_GUIDANCE'};
    if (result.status === 'unknown') return {category:'uncertain',retry:true,home:true,guidance:'UNKNOWN_GUIDANCE'};
    if (result.status !== 'error') return {category:'none',retry:false,home:false,guidance:''};
    if (result.resCode === '0401') return {category:'authentication',retry:false,home:true,guidance:'AUTH_GUIDANCE'};
    if (result.resCode === '0900' && result.errCode === '0338') return {category:'duplicate',retry:false,home:true,guidance:'DUPLICATE_GUIDANCE'};
    if (result.resCode === '0400') return {category:'input',retry:true,home:true,guidance:'INPUT_GUIDANCE'};
    if (result.resCode === '0500') return {category:'server',retry:true,home:false,guidance:'SERVER_GUIDANCE'};
    if (result.resCode === '0900') return {category:'detail',retry:true,home:true,guidance:'DETAIL_GUIDANCE'};
    const launch = window.MintScribeLaunch;
    const invalidContext = (result.code === 'INVALID_MODE' && !['dev','real'].includes(launch.mode))
      || (result.code === 'MISSING_TOKEN' && (launch.status !== 'ready' || !launch.token.trim()))
      || result.code === 'NOT_LINKED'
      || (result.code === 'SESSION_CHANGED' && window.MintScribePracticeStore && !window.MintScribePracticeStore.isCurrent());
    if (invalidContext) return {category:'connection',retry:false,home:true,guidance:result.code};
    return {category:'other',retry:true,home:true,guidance:'DETAIL_GUIDANCE'};
  }

  function reportErrorPolicy() {
    const result = registration(), policy = errorPolicy(result);
    if (policy.category === 'none') return;
    console.warn('[MintScribe][07/error] 오류 처리 방침', {
      category:policy.category,res_code:result.resCode || '',err_code:result.errCode || '',
      code:result.code || '',retryAllowed:policy.retry,
      confirmBeforeRetry:result.status === 'unknown',showHomeLink:policy.home
    });
  }

  function statusText() {
    const result = registration();
    if (result.status === 'pending') return message('PENDING');
    if (result.status === 'idle') return '';
    const codes = [result.resCode || result.code, result.errCode].filter(Boolean).join(' / ');
    return `${result.message || message(result.code || 'REGISTRATION_FAILED')}${codes ? ` [${codes}]` : ''}`;
  }

  function buttonText() {
    const status = registration().status;

    if (status === 'pending') return ('등록 중…');
    if (status === 'success') return ('등록 완료');
    if (status === 'error' && !errorPolicy().retry) return ('등록할 수 없음');
    if (status === 'unknown') return ('등록 여부 확인 후 재시도');
    if (status === 'error') return ('다시 등록하기');
    return ('등록하기');
  }

  function markup() {
    if (!window.MintScribeLaunch.isIntegration) return '';

    const result = registration();
    const locked = result.status === 'pending' || result.status === 'success';
    const policy = errorPolicy(result);
    const submitLocked = locked || (result.status === 'error' && !policy.retry);
    const failed = result.status === 'error' || result.status === 'unknown';
    return `<section class="submission-card" aria-labelledby="submissionTitle">
      <h2 id="submissionTitle">${('민트 홈페이지에 받아쓰기 등록')}</h2>
      <p>${('위에 표시된 정답 문장과 단어별 학습 결과가 등록 본문에 포함됩니다.')}</p>
      <label class="submission-anonymous"><input id="nameHide" type="checkbox" ${state.nameHide === 'Y' ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-describedby="anonymousHelp"><span>${('익명으로 작성')}</span></label>
      <p id="anonymousHelp" class="submission-help">${('익명 작성은 작성자 이름만 숨깁니다. 게시글 본문은 공개됩니다.')}</p>
      <div class="submission-actions"><a id="registrationHome" class="secondary-btn submission-home" href="${esc(returnUrl())}" ${policy.home ? '' : 'hidden'}>${('민트 홈페이지로 돌아가기')}</a><button type="button" class="primary-btn" data-action="submitDictation" ${submitLocked ? 'disabled' : ''}>${buttonText()}</button></div>
      <div id="submissionStatus" class="submission-status ${failed ? 'error' : ''}" role="${failed ? 'alert' : 'status'}" aria-live="polite">${esc(statusText())}</div>
      <p id="registrationGuidance" class="submission-guidance">${policy.guidance ? esc(message(policy.guidance)) : ''}</p>
    </section>`;
  }

  function syncUI() {
    const result = registration();
    const locked = result.status === 'pending' || result.status === 'success';
    const policy = errorPolicy(result);
    const checkbox = $('#nameHide');
    if (checkbox) checkbox.disabled = locked;
    const button = $('[data-action="submitDictation"]');
    if (button) { button.disabled = locked || (result.status === 'error' && !policy.retry); button.textContent = buttonText(); }
    const home = $('#registrationHome');
    if (home) { home.hidden = !policy.home; home.href = returnUrl(); }
    const guidance = $('#registrationGuidance');
    if (guidance) guidance.textContent = policy.guidance ? message(policy.guidance) : '';
    document.querySelector('.submission-card')?.setAttribute('aria-busy', result.status === 'pending' ? 'true' : 'false');
    for (const control of document.querySelectorAll('.summary-v2-actions button,.topbar .brand')) control.disabled = result.status === 'pending';
    const status = $('#submissionStatus');
    if (!status) return;
    const failed = result.status === 'error' || result.status === 'unknown';
    status.textContent = statusText();
    status.classList.toggle('error', failed);
    status.setAttribute('role', failed ? 'alert' : 'status');
  }

  function checkpoint() {
    return window.MintScribePracticeStore?.checkpoint();
  }

  function safeMessage(value, payload) {
    if (typeof value !== 'string') return '';
    let text = value;
    for (const secret of [payload.token, encodeURIComponent(payload.token), payload.content]) {
      if (secret) text = text.split(secret).join('[redacted]');
    }
    return text;
  }

  function restoreRegistration(saved) {
    if (!saved || !['pending','success','error','unknown'].includes(saved.status)) return null;
    if (saved.status === 'pending') return {status:'unknown',code:'REQUEST_INTERRUPTED'};
    return {
      status:saved.status, code:typeof saved.code === 'string' ? saved.code : '',
      resCode:typeof saved.resCode === 'string' ? saved.resCode : '',
      errCode:typeof saved.errCode === 'string' ? saved.errCode : '',
      message:typeof saved.message === 'string' ? saved.message : '',
      redirectUrl:typeof saved.redirectUrl === 'string' ? saved.redirectUrl : ''
    };
  }

  async function submit() {
    if (inFlight || ['pending','success'].includes(registration().status)) {
      console.warn('[MintScribe][06/api] 중복 제출 차단', {status:registration().status});
      return;
    }
    if (registration().status === 'error' && !errorPolicy().retry) {
      console.warn('[MintScribe][07/error] 다시 제출할 수 없는 오류의 재시도를 차단했습니다.', {
        res_code:registration().resCode || '',err_code:registration().errCode || ''
      });
      syncUI();
      return;
    }
    if (registration().status === 'unknown' && !confirm(('민트 홈페이지에서 게시글이 등록되지 않은 것을 확인하셨나요? 확인한 경우에만 다시 제출해 주세요.'))) return;

    let payload;
    try { payload = buildPayload(); }
    catch (error) {
      state.registration = {status:'error',code:error.code || 'PREPARATION_FAILED'};
      console.error('[MintScribe][06/api] 전송 준비 실패', {code:state.registration.code});
      reportErrorPolicy();
      syncUI(); checkpoint(); return;
    }
    inFlight = true;
    state.registration = {status:'pending'};
    syncUI(); checkpoint();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let failureCode = 'NETWORK_ERROR';
    const endpoint = apiUrl();
    console.info('[MintScribe][06/api] 등록 요청 전송', {
      environment:window.MintScribeLaunch.environment, endpoint,
      name_hide:payload.name_hide, tokenLength:payload.token.length,
      contentBytes:new TextEncoder().encode(payload.content).length
    });
    try {
      const response = await fetch(endpoint, {
        method:'POST',
        headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams(payload).toString(),
        signal:controller.signal
      });
      failureCode = 'INVALID_RESPONSE';
      const result = await response.json();
      if (!result || typeof result.res_code !== 'string') throw new Error('Invalid response');
      const resCode = result.res_code;
      const errCode = typeof result.data?.err_code === 'string' ? result.data.err_code : '';
      const serverMessage = safeMessage(result.data?.err_msg || result.msg, payload);
      console.info('[MintScribe][06/api] 등록 응답 수신', {
        httpStatus:response.status,res_code:resCode,err_code:errCode,message:serverMessage
      });
      if (resCode === '0000') {
        state.registration = {
          status:'success',resCode,errCode,
          message:serverMessage || message('SUCCESS'),
          redirectUrl:typeof result.data?.redirect_url === 'string' ? result.data.redirect_url : ''
        };
        // A success code means registration happened; never retry due to a bad HTTP status.
        if (!response.ok) console.warn('[MintScribe][06/api] 성공 코드와 HTTP 상태가 다릅니다.', {httpStatus:response.status});
      } else {
        state.registration = {status:'error',resCode,errCode,message:serverMessage || message('REGISTRATION_FAILED')};
        console.error('[MintScribe][06/api] 서버 등록 실패', {httpStatus:response.status,res_code:resCode,err_code:errCode,message:serverMessage});
      }
    } catch (error) {
      const code = controller.signal.aborted ? 'TIMEOUT' : failureCode;
      state.registration = {status:'unknown',code};
      console.error('[MintScribe][06/api] 등록 결과 확인 불가', {code,errorType:error.name});
    } finally {
      clearTimeout(timeout);
      inFlight = false;
      reportErrorPolicy();
      syncUI();
      const completed = registration();
      try { await checkpoint(); }
      catch (error) {
        console.warn('[MintScribe][08/redirect] 저장 완료 확인 실패', {errorType:error.name});
      }
      if (completed.status === 'success') returnToMint(completed);
    }
  }

  app.addEventListener('change', event => {
    if (event.target.id !== 'nameHide') return;
    if (['pending','success'].includes(registration().status)) return;
    state.nameHide = event.target.checked ? 'Y' : 'N';
    console.info('[MintScribe][05/submission] 익명 작성 설정 변경', {name_hide: state.nameHide});
  });

  app.addEventListener('click', event => {
    if (event.target.closest('#registrationHome') && registration().status === 'success') {
      event.preventDefault();
      returnToMint();
      return;
    }
    if (event.target.closest('[data-action]')?.dataset.action === 'submitDictation') submit();
  });

  document.addEventListener('click', event => {
    if (!inFlight) return;
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!['home','restart','returnPractice','start','urlLoad','resumePractice','clearPractice','submitDictation'].includes(action)) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);

  window.MintScribeSubmission = Object.freeze({markup, buildPayload, submit, apiUrl, restoreRegistration, syncUI, errorPolicy, homeUrl});
})();

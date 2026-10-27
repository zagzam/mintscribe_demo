/* Read launch parameters once. No requests, storage writes, or token decoding. */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const audioUrl = params.get('audio') || params.get('audioUrl') || '';
  const transcriptUrl = params.get('transcript') || params.get('transcriptUrl') || '';
  const token = params.get('token') || '';
  const teacherName = (params.get('tu_name') || '').trim();
  const segments = params.get('segments');
  const urlScope = segments === 'full' ? 'all' : ['5', '10', '15'].includes(segments) ? segments : null;
  const minWordsParam = params.get('min_words');
  const minWordsValue = minWordsParam !== null && /^\d+$/.test(minWordsParam) ? Number(minWordsParam) : NaN;
  // A plain audio/transcript link remains usable for independent practice.
  const isIntegration = params.has('token') || params.has('mode');
  const requestedMode = params.get('mode') || '';
  const validMode = ['dev', 'real'].includes(requestedMode);
  const missingRequired = isIntegration
    ? [['audio', audioUrl], ['transcript', transcriptUrl], ['token', token], ['mode', requestedMode], ['tu_name', teacherName]]
      .filter(([, value]) => !value.trim()).map(([name]) => name)
    : [];
  const invalidParameters = isIntegration && requestedMode.trim() && !validMode ? ['mode'] : [];
  const config = Object.freeze({
    isIntegration,
    mode: validMode ? requestedMode : null,
    environment: validMode ? (requestedMode === 'dev' ? 'development' : 'production') : null,
    status: !isIntegration ? 'standalone' : missingRequired.length || invalidParameters.length ? 'incomplete' : 'ready',
    audioUrl,
    transcriptUrl,
    token,
    teacherName,
    segments,
    urlScope,
    scope: urlScope || '10',
    minWords: Number.isSafeInteger(minWordsValue) ? minWordsValue : 4,
    missingRequired: Object.freeze(missingRequired),
    invalidParameters: Object.freeze(invalidParameters)
  });

  // The raw token is kept only for later API integration; never log this object.
  window.MintScribeLaunch = config;
  // Keep the original entry separate from a session restored without URL parameters.
  window.MintScribeEntry = config;
  console.info('[MintScribe][01/launch] URL 파라미터 수신', {
    isIntegration: config.isIntegration,
    environment: config.environment,
    mode: config.mode,
    status: config.status,
    audioProvided: Boolean(audioUrl.trim()),
    transcriptProvided: Boolean(transcriptUrl.trim()),
    tokenProvided: Boolean(token.trim()),
    tokenLength: token.length,
    scope: config.scope,
    minWords: config.minWords,
    missingRequired: [...missingRequired],
    invalidParameters: [...invalidParameters]
  });
  if (missingRequired.length) {
    console.warn('[MintScribe][01/launch] 연동 필수 파라미터 누락:', missingRequired.join(', '));
  }
  if (invalidParameters.length) {
    console.warn('[MintScribe][01/launch] mode 값이 올바르지 않습니다. mode=dev 또는 mode=real을 지정하세요.');
  }
  if (params.has('dev')) {
    console.info('[MintScribe][01/launch] 기존 dev 파라미터는 무시합니다. 개발 환경은 mode=dev로 지정하세요.');
  }
})();

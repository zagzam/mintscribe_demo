(function () {
  const storageKey = 'mintscribe-theme';
  const brightStyles = document.getElementById('brightTheme');
  const browserTheme = document.querySelector('meta[name="theme-color"]');

  function applyTheme(theme, save) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    brightStyles.disabled = dark;
    browserTheme.content = dark ? '#202020' : '#f7f7f7';
    if (save) {
      try { localStorage.setItem(storageKey, dark ? 'dark' : 'light'); } catch (_) { /* Storage can be unavailable. */ }
    }

    const button = document.querySelector('.theme-toggle');
    if (button) {
      const korean = document.documentElement.lang === 'ko';
      const action = korean
        ? (dark ? '라이트 모드로 전환' : '다크 모드로 전환')
        : (dark ? 'Switch to bright mode' : 'Switch to dark mode');
      button.setAttribute('aria-label', action);
      button.title = action;
      button.querySelector('span').textContent = korean
        ? (dark ? '다크' : '라이트')
        : (dark ? 'Dark' : 'Bright');
    }
  }

  let savedTheme = 'light';
  try { if (localStorage.getItem(storageKey) === 'dark') savedTheme = 'dark'; } catch (_) { /* Keep the default theme. */ }
  applyTheme(savedTheme, false);

  document.addEventListener('click', event => {
    if (!event.target.closest('[data-action="theme"]')) return;
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
})();

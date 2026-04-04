const STORAGE_KEY = 'nexcall_server_url';

function getServerURL() {
  // Priority: 1) input field, 2) localStorage, 3) same origin
  const input = document.getElementById('server-url');
  const inputVal = input ? input.value.trim() : '';
  if (inputVal) {
    localStorage.setItem(STORAGE_KEY, inputVal);
    return inputVal.replace(/\/+$/, '');
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) return saved.replace(/\/+$/, '');
  return '';  // empty means same-origin (for web/PWA deployment)
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getServerURL, STORAGE_KEY };
}

(function getContent() {
  const url = document.location.href;
  if (!url || !/^https?:\/\//.test(url)) return null;
  let title = document.querySelector('title');
  if (title) title = title.innerText.trim();
  const selection = window.getSelection().toString().trim();
  let meta = document.querySelector('meta[name="description"]');
  const description = meta && (meta.getAttribute('content') || '').trim();
  meta = document.querySelector('meta[name="keywords"]');
  const keywords = meta && (meta.getAttribute('content') || '').trim();
  return {url, title, selection, description, keywords};
})();

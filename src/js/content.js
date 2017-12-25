(function getContent() {
  const url = document.location.href;
  if (!url || !/^https?:\/\//.test(url)) return null;
  let title = document.querySelector('title');
  if (title) title = title.innerText.trim();
  let description = window.getSelection().toString().trim();
  if (!description) {
    let meta = document.querySelector('meta[name="description"]');
    if (meta)
      description = (meta.getAttribute('content') || '').trim();
  }
  let keywords = null;
  let meta = document.querySelector('meta[name="keywords"]');
  if (meta) {
    const content = (meta.getAttribute('content') || '').trim();
    if (content) {
      let words = [];
      for (let word of content.split(',')) {
        word = word.replace(/\s+/, '').slice(0, 255).toLowerCase();
        if (word && !words.includes(word)) {
          words.push(word);
          if (words.length >= 100) break;
        }
      }
      if (words.length) keywords = words;
    }
  }
  if (description) description = description.slice(0, 64000);
  if (keywords) keywords = keywords.slice(0, 6400);
  return {url: url, title: title || null,
    description: description || null, keywords: keywords};
})();

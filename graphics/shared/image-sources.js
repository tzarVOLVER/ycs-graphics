// An image that tries each address in turn and gives up only after the last one fails. The decktype files
// are named by hand, some with non-breaking spaces and some without, so a graphic tries the exact name
// first and then the spellings that differ only in those spaces.
export function imageSources(image, { retryBroken = false } = {}) {
  let urls = [], index = 0, settle = () => {}, settled = Promise.resolve();
  image.addEventListener('load', () => settle());
  image.addEventListener('error', () => {
    if (index + 1 < urls.length) image.setAttribute('src', urls[++index]);
    else settle();
  });
  return {
    // Returns false when these addresses are already showing or loading, so nothing reloads.
    // With retryBroken, a list that failed every address is tried again (a file added since).
    set(next) {
      const list = next.filter(Boolean);
      const same = list.length === urls.length && list.every((url, i) => url === urls[i]);
      const broken = image.hasAttribute('src') && image.complete && image.naturalWidth === 0;
      if (same && !(retryBroken && broken)) return false;
      settle();
      urls = list; index = 0;
      if (!urls.length) { settled = Promise.resolve(); image.removeAttribute('src'); return true; }
      settled = new Promise((resolve) => { settle = resolve; });
      image.setAttribute('src', urls[0]);
      return true;
    },
    // Resolves once one address has loaded or all of them have failed: true if these are still the
    // addresses showing, false if a newer set() has replaced them since.
    ready() { const mine = settled; return mine.then(() => mine === settled); }
  };
}

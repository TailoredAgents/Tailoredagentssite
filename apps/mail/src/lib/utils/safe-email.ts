/** Browser parser: email content never supplies executable elements or navigation metadata. */
export function safeEmailHtml(html: string, allowRemoteImages = false): string {
  const doc = new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('script,iframe,object,embed,form,input,button,textarea,select,meta,base,link,svg,math,video,audio').forEach(node => node.remove());
  for (const node of doc.querySelectorAll('*')) {
    if (node.tagName === 'IMG' && isTrackingImage(node)) { node.remove(); continue; }
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name) || ['srcdoc','srcset','ping','action','formaction'].includes(attribute.name)) node.removeAttribute(attribute.name);
    }
    if (node.hasAttribute('href')) {
      const href = node.getAttribute('href')!.trim();
      if (!/^(https?:|mailto:|tel:|#)/i.test(href)) node.removeAttribute('href');
      node.setAttribute('target','_blank'); node.setAttribute('rel','noopener noreferrer');
    }
    if (node.hasAttribute('src')) {
      const src = node.getAttribute('src')!.trim().replace(/^\/\//, 'https://');
      node.setAttribute('src', src);
      const localImage = /^data:image\/(png|jpeg|gif|webp);base64,/i.test(src) || /^\/api\/mail\/[^/]+\/attachments\/[^/?]+/.test(src);
      if (!localImage && !(allowRemoteImages && /^https:\/\//i.test(src))) node.removeAttribute('src');
    }
  }
  return '<!doctype html>' + doc.documentElement.outerHTML;
}

function isTrackingImage(node: Element): boolean {
  const style = node.getAttribute('style') ?? '';
  const dimension = (name: string) => {
    const value = node.getAttribute(name) ?? style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*(\\d+(?:\\.\\d+)?)(?:px)?\\s*(?:;|$)`, 'i'))?.[1];
    return value !== null && value !== undefined && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : null;
  };
  const width = dimension('width'), height = dimension('height');
  return (width !== null && height !== null && width <= 1 && height <= 1) ||
    /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important)?\s*(?:;|$)/i.test(style);
}

/** A normal hyperlink alone should never produce an image warning. */
export function hasRemoteImages(html: string): boolean {
  const doc = new DOMParser().parseFromString(safeEmailHtml(html, true), 'text/html');
  return [...doc.querySelectorAll('img[src]')].some(node => /^https:\/\//i.test(node.getAttribute('src') ?? '')) ||
    [...doc.querySelectorAll('[style],style,[background]')].some(node =>
      /url\(\s*["']?(?:https?:)?\/\//i.test((node.getAttribute('style') ?? '') + (node.tagName === 'STYLE' ? node.textContent : '')) ||
      /^(https?:)?\/\//i.test(node.getAttribute('background') ?? ''));
}

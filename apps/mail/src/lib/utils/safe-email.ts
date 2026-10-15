/** Browser parser: email content never supplies executable elements or navigation metadata. */
export function safeEmailHtml(html: string, allowRemoteImages = false): string {
  const doc = new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('script,iframe,object,embed,form,input,button,textarea,select,meta,base,link,svg,math,video,audio').forEach(node => node.remove());
  for (const node of doc.querySelectorAll('*')) {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name) || ['srcdoc','srcset','ping','action','formaction'].includes(attribute.name)) node.removeAttribute(attribute.name);
    }
    if (node.hasAttribute('href')) {
      const href = node.getAttribute('href')!.trim();
      if (!/^(https?:|mailto:|tel:|#)/i.test(href)) node.removeAttribute('href');
      node.setAttribute('target','_blank'); node.setAttribute('rel','noopener noreferrer');
    }
    if (node.hasAttribute('src')) {
      const src = node.getAttribute('src')!.trim();
      const localImage = /^data:image\/(png|jpeg|gif|webp);base64,/i.test(src) || /^\/api\/mail\/[^/]+\/attachments\/[^/?]+/.test(src);
      if (!localImage && !(allowRemoteImages && /^https:\/\//i.test(src))) node.removeAttribute('src');
    }
  }
  return '<!doctype html>' + doc.documentElement.outerHTML;
}

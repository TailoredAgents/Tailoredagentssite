import {Fragment, type ReactNode} from 'react';

// Render a deliberately small Markdown subset without accepting HTML or arbitrary URLs.
function inline(text: string): ReactNode {
  return text.split(/(\[[^\]\n]+\]\((?:\/dashboard(?:[/?#][^\s)]*)?|https:\/\/[^\s)]*)\)|\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target={link[2].startsWith('https:') ? '_blank' : undefined} rel="noreferrer noopener">{link[1]}</a>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    return part;
  });
}

export function AssistantMessage({text}: {text: string}) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = line.match(/^#{1,6}\s+(.+)/);
    if (heading) { blocks.push(<h3 key={i}>{inline(heading[1])}</h3>); i++; continue; }
    const list = line.match(/^\s*(?:([-*])|\d+[.)])\s+(.+)/);
    if (list) {
      const start = i, ordered = !list[1], items: ReactNode[] = [];
      while (i < lines.length) {
        const item = lines[i].match(ordered ? /^\s*\d+[.)]\s+(.+)/ : /^\s*[-*]\s+(.+)/);
        if (!item) break;
        items.push(<li key={i}>{inline(item[1])}</li>); i++;
      }
      blocks.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>);
      continue;
    }
    const start = i, paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,6}\s|\s*(?:[-*]|\d+[.)])\s)/.test(lines[i])) paragraph.push(lines[i++]);
    // An unfinished heading/list marker is ordinary text, and must still advance.
    if (!paragraph.length) paragraph.push(lines[i++]);
    blocks.push(<p key={start}>{paragraph.map((part, index) => <Fragment key={index}>{index > 0 && <br/>}{inline(part)}</Fragment>)}</p>);
  }
  return <div className="assistant-message-body">{blocks}</div>;
}

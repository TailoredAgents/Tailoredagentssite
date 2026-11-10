'use client';

import {useEffect, useRef, type ReactNode} from 'react';
import {useRouter, useSearchParams} from 'next/navigation';
import {BriefcaseBusiness, Files, History, MessageSquare, Settings2, Sparkles} from 'lucide-react';
import {AssistantChat} from './assistant-chat';

export type AssistantSection = 'chat' | 'work' | 'files' | 'activity' | 'settings';
const sections = [
  {id: 'chat', label: 'Chat', icon: MessageSquare},
  {id: 'work', label: 'My work', icon: BriefcaseBusiness},
  {id: 'files', label: 'Files', icon: Files},
  {id: 'activity', label: 'Activity', icon: History},
  {id: 'settings', label: 'Settings', icon: Settings2},
] as const;

export function AssistantWorkspace({name, initialSection, pendingCount, work, activity, settings}: {
  name: string;
  initialSection: AssistantSection;
  pendingCount: number;
  work: {reviews:ReactNode;goals:ReactNode};
  activity: ReactNode;
  settings: ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selected = searchParams.get('view');
  const section = sections.some(s => s.id === selected) ? selected as AssistantSection : initialSection;
  const tabs = useRef<HTMLElement>(null);
  const previousSection = useRef(section);

  function navigate(next: AssistantSection) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', next);
    url.searchParams.delete('action');
    url.hash = '';
    window.history.pushState(null, '', url.pathname + url.search);
    if (next !== 'chat') router.refresh();
  }

  useEffect(() => {
    if (previousSection.current !== section) {
      tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({block: 'nearest', inline: 'nearest'});
      previousSection.current = section;
    }
  }, [section]);

  return <div className="assistant-workspace" data-section={section}>
    <header className="assistant-workspace-heading">
      <div className="assistant-workspace-title"><span className="assistant-brand-icon"><Sparkles size={22} aria-hidden="true"/></span><div><h1>Assistant</h1><p>A little context. A useful next step.</p></div></div>
      <span className="assistant-private-label">Your personal workspace</span>
    </header>
    <nav className="assistant-workspace-tabs" aria-label="Assistant workspace" role="tablist" ref={tabs}>
      {sections.map(({id, label, icon: Icon}, index) => <button key={id} id={'assistant-tab-' + id} role="tab" aria-selected={section === id} aria-controls={'assistant-view-' + id} tabIndex={section === id ? 0 : -1} onClick={() => navigate(id)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % sections.length : event.key === 'ArrowLeft' ? (index + sections.length - 1) % sections.length : event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        navigate(sections[next].id);
        tabs.current?.querySelector<HTMLButtonElement>('#assistant-tab-' + sections[next].id)?.focus();
      }}><Icon size={17} aria-hidden="true"/><span>{label}</span>{id === 'work' && pendingCount > 0 && <span className="assistant-tab-count" aria-label={pendingCount + ' changes awaiting review'}>{pendingCount}</span>}</button>)}
    </nav>
    <AssistantChat firstName={name.split(' ')[0]} section={section} onNavigate={navigate} workContent={work} activityContent={activity} settingsContent={settings}/>
  </div>;
}

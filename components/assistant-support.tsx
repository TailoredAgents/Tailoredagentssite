import type {ReactNode} from 'react';
import {ArrowLeft, Sparkles} from 'lucide-react';
import styles from './assistant-support.module.css';

export function AssistantSupportPage({title, description, backHref, backLabel, action, children}: {
  title:string; description:string; backHref:string; backLabel:string; action?:ReactNode; children:ReactNode;
}) {
  return <>
    <header className="dashboard-topbar"><div><span>Assistant</span><strong>{title}</strong></div></header>
    <div className={`dashboard-content ${styles.workspace}`}>
      <a className="dashboard-back-link" href={backHref}><ArrowLeft size={14} aria-hidden="true"/>{backLabel}</a>
      <header className={styles.header}><div><span className={styles.eyebrow}><Sparkles size={15} aria-hidden="true"/>Your company assistant</span><h1>{title}</h1><p>{description}</p></div>{action&&<div className={styles.actions}>{action}</div>}</header>
      {children}
    </div>
  </>;
}

export function AssistantSupportFacts({items}:{items:{label:string;value:ReactNode}[]}) {
  return <dl className={styles.facts}>{items.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}

export function AssistantSupportStatus({children, attention=false}:{children:ReactNode;attention?:boolean}) {
  return <span className={styles.badge} data-attention={attention||undefined}>{children}</span>;
}

export function assistantAudience(value:string) {
  return ({private:'Only you',workspace:'Workspace',employees:'Selected employees'} as Record<string,string>)[value]??value;
}

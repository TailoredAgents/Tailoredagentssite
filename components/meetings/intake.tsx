'use client';

import Link from 'next/link';
import {useState} from 'react';
import {ArrowRight, ChevronDown, Mic, NotebookPen} from 'lucide-react';
import {MeetingUpload} from './client';
import styles from './intake.module.css';

export function MeetingIntake() {
  const [showUpload, setShowUpload] = useState(false);

  return <section aria-label="Save a conversation">
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.action}
        aria-expanded={showUpload}
        aria-controls="meeting-recording-upload"
        aria-labelledby="meeting-recording-label"
        aria-describedby="meeting-recording-description"
        onClick={() => setShowUpload(!showUpload)}
      >
        <span className={styles.icon}><Mic size={22} aria-hidden="true" /></span>
        <span className={styles.copy}>
          <strong id="meeting-recording-label">Add recording</strong>
          <span id="meeting-recording-description">Upload audio for a transcript and AI findings. No prospect required.</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className={showUpload ? styles.expanded : undefined} />
      </button>
      <Link href="/dashboard/capture" className={styles.action} aria-labelledby="meeting-capture-label" aria-describedby="meeting-capture-description">
        <span className={styles.icon}><NotebookPen size={22} aria-hidden="true" /></span>
        <span className={styles.copy}>
          <strong id="meeting-capture-label">Quick capture</strong>
          <span id="meeting-capture-description">Type notes and save them to a new or existing prospect.</span>
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </div>
    <div id="meeting-recording-upload" hidden={!showUpload} className={styles.upload}>
      <MeetingUpload />
    </div>
  </section>;
}

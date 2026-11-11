"use client";

import { createContext, useContext, useRef, useState } from "react";
import { ChevronDown, PencilLine } from "lucide-react";
import styles from "./record-workspace.module.css";

const RecordEditorContext = createContext<(() => void) | null>(null);

export function useRecordEditorCancel() {
  return useContext(RecordEditorContext);
}

/** Keep the saved record readable until an employee chooses to edit it. */
export function RecordEditor({ label, children, disabled = false }: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const [revision, setRevision] = useState(0);
  if (disabled) return null;

  function cancel() {
    // Remount both controlled and uncontrolled fields, including action feedback.
    setRevision((value) => value + 1);
    if (details.current) details.current.open = false;
    summary.current?.focus();
  }

  return <details ref={details} className={styles.editor}>
    <summary ref={summary}><PencilLine size={16} aria-hidden="true" /><span>{label}</span><ChevronDown size={16} aria-hidden="true" /></summary>
    <RecordEditorContext.Provider value={cancel}>
      <div key={revision} className={styles.editorContent}>{children}</div>
    </RecordEditorContext.Provider>
  </details>;
}

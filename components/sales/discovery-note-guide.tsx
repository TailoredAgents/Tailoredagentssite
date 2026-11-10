export function DiscoveryNoteGuide({ followUpHref }: { followUpHref?: string }) {
  return (
    <details className="sales-discovery-guide dashboard-field-full">
      <summary>Discovery prompts (optional)</summary>
      <p>Capture what you know in the notes. Leave unanswered questions open.</p>
      <ul>
        <li><strong>How we met:</strong> event, office visit, introduction or other source; date and people involved.</li>
        <li><strong>Introduced by:</strong> the referrer’s name and organization, separately from our sales owner.</li>
        <li><strong>Business and problems:</strong> what they do, where work gets stuck, and who is affected.</li>
        <li><strong>Current workflow:</strong> steps, software, documents, volume and time spent, when known.</li>
        <li><strong>Desired outcome:</strong> what they want automated or improved; constraints and open questions.</li>
        <li><strong>Our commitment:</strong> what we promised, who will do it, and by when.</li>
      </ul>
      <p>Separate what they told us from our ideas. Referral notes record context, not agreed compensation.</p>
      {followUpHref ? <p>Then <a href={followUpHref}>assign and schedule the next step</a>. A note alone does not create a reminder.</p> : null}
    </details>
  );
}

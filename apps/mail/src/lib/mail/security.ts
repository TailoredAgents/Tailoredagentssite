export type AuthenticationResult = 'pass' | 'fail' | 'gray' | 'processing_failed' | 'unknown';
export type MailAuthentication = Record<'spf' | 'dkim' | 'dmarc', AuthenticationResult>;
export type SenderImageMode = 'automatic' | 'allow' | 'block';
export type MessageSecurity = {
  authentication: MailAuthentication;
  verification: 'verified' | 'failed' | 'unknown';
  senderDisposition: 'safe' | 'spam' | null;
  junkReason: string | null;
  imageMode: SenderImageMode;
  automaticImages: boolean;
};

export function automaticImageLoading(verification: MessageSecurity['verification'], imageMode: SenderImageMode, spam: boolean, disposition: MessageSecurity['senderDisposition']): boolean {
  return !spam && disposition !== 'spam' && verification !== 'failed' &&
    (imageMode === 'allow' || (imageMode === 'automatic' && verification === 'verified'));
}

export function normalizeAuthentication(input: unknown): MailAuthentication {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const result = (key: string): AuthenticationResult => {
    const raw = typeof value[key] === 'string' ? value[key].toLowerCase().trim() : '';
    return ['pass', 'fail', 'gray', 'processing_failed'].includes(raw)
      ? raw as AuthenticationResult : 'unknown';
  };
  return { spf: result('spf'), dkim: result('dkim'), dmarc: result('dmarc') };
}

/** Authentication proves a domain's sending authority, not that its content is safe. */
export function messageSecurity(input: {
  authentication: unknown;
  senderDisposition?: 'safe' | 'spam' | null;
  blocked?: boolean;
  spam?: boolean;
  spamSource?: string | null;
  junkReason?: string | null;
  imageMode?: SenderImageMode;
}): MessageSecurity {
  const authentication = normalizeAuthentication(input.authentication);
  const verification = authentication.dmarc === 'pass' ? 'verified'
    : authentication.dmarc === 'fail' ? 'failed' : 'unknown';
  const senderDisposition = input.blocked ? 'spam' : input.senderDisposition ?? null;
  const imageMode = input.imageMode ?? 'automatic';
  const junkReason = input.spam
    ? input.spamSource === 'user' ? 'You marked this conversation as junk.'
      : input.junkReason === 'sender' ? 'This sender is on your junk list.'
      : input.junkReason === 'authentication' ? 'The receiving server reported a failed domain authentication check.'
      : 'This message was filtered as suspected junk.'
    : null;
  return {
    authentication, verification, senderDisposition, junkReason, imageMode,
    // Even a remembered image preference cannot auto-load a flagged message.
    automaticImages: automaticImageLoading(verification, imageMode, Boolean(input.spam), senderDisposition)
  };
}

export function inboundJunkReason(authentication: unknown, disposition: 'safe' | 'spam' | null, blocked = false): 'sender' | 'authentication' | null {
  if (blocked || disposition === 'spam') return 'sender';
  // A person's explicit correction wins routing; failed authentication still
  // remains visible and prevents automatic image loading in the reader.
  if (disposition === 'safe') return null;
  return normalizeAuthentication(authentication).dmarc === 'fail' ? 'authentication' : null;
}

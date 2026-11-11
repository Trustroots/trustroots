export type EmailReplyPreview = {
  id: string;
  sender: string;
  recipients: string[];
  matching: 'candidate' | 'ambiguous' | 'unmatched';
  candidates: string[];
  parseResult: 'Extracted' | 'Empty' | 'Automated' | 'Incomplete' | 'Too large';
  extractedText: string;
  sourceText: string;
};

export type EmailRepliesPreview =
  | { status: 'unconfigured' }
  | { status: 'preview'; checkedAt: string; replies: EmailReplyPreview[] };

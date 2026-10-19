export type BrainSource = 'vault' | 'ebooks'
export type BrainKind = 'note' | 'index' | 'ebook'
export type BrainEntry = {
  id: string; source: BrainSource; path: string; title: string; kind: BrainKind;
  extension: string; bytes: number; modifiedAt: string; snippet?: string
}
export type BrainStatus = {
  configured: boolean; available: boolean; vaultName: string; readOnly: true;
  ebooksConfigured: boolean; ebooksAvailable: boolean; message?: string
}
export type BrainCatalog = {
  items: BrainEntry[]; total: number; limit: number; offset: number; scannedAt: string;
  counts: Record<BrainKind, number>; warnings: string[]; readOnly: true
}
export type BrainNote = {
  entry: BrainEntry; content: string; links: { target: string; label: string }[];
  obsidianUrl: string; readOnly: true
}

export interface AudioFile {
  name: string;
  size: string;
  contentType: string;
  updated: string;
  url: string;
}

export interface AudioEntry {
  id: string;
  title?: string;
  voice?: string;
  isNew?: boolean;
  category?: string;
  imageUrl?: string;
}

export interface Category {
  id: string;
  name: string;
}

export const HISTORY_CATEGORIES: Category[] = [
  { id: 'ancient', name: 'Ancient Civilizations' },
  { id: 'medieval', name: 'Medieval Life' },
  { id: 'crafts', name: 'Crafts & Trades' },
  { id: 'daily', name: 'Daily Routines' },
  { id: 'government', name: 'Government & Society' },
  { id: 'industrial', name: 'Industrial Era' }
];
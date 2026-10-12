import dotenv from 'dotenv';
dotenv.config();

export const SITE_URL = process.env.SITE_URL || '';
export const REPO_URL = process.env.REPO_URL || '';

export const vocab = {
  editor: 'editor',
  editors: 'editors',
  Editor: 'Editor',
  Editors: 'Editors',
  client: 'client',
  clients: 'clients',
  document: 'document',
  documents: 'documents',
  deal: 'deal',
  deals: 'deals',
  tagline: 'Document editing and feedback on your own writing, priced per page.'
};

export default {
  SITE_URL,
  REPO_URL,
  vocab
};


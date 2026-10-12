import dotenv from 'dotenv';
dotenv.config();

const getSiteUrl = () => {
  if (process.env.SITE_URL && !process.env.SITE_URL.includes('localhost')) {
    return process.env.SITE_URL.replace(/\/+$/, '');
  }
  if (process.env.RENDER || process.env.NODE_ENV === 'production') {
    return 'https://perpage-app.onrender.com';
  }
  return process.env.SITE_URL || 'http://localhost:3000';
};

export const SITE_URL = getSiteUrl();
export const REPO_URL = process.env.REPO_URL || 'https://github.com/adityaa-nikam/perpage-editorial-marketplace';

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


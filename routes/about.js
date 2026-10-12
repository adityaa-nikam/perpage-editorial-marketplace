import express from 'express';
import { REPO_URL, SITE_URL } from '../config/site.js';

const router = express.Router();

router.get('/', (req, res) => {
  const baseUrl = SITE_URL || `${req.protocol}://${req.get('host')}`;
  const canonical = `${baseUrl}/about`;

  res.render('about', {
    pageTitle: 'About — PerPage Document Editing Marketplace',
    metaDescription: 'An academic demonstration project that models how clients and freelance editors agree on editing and feedback per page.',
    canonical,
    repoUrl: REPO_URL || null
  });
});

export default router;

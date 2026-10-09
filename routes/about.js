import express from 'express';
import { User } from '../models/User.js';
import mongoose from 'mongoose';
const router = express.Router();



// GET /profile/:id
router.get('/', async (req, res) => {
  

    res.render('about');
});

export default router;

import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import {Strategy as GitHubStrategy} from 'passport-github2';
import {expressError} from '../utils/expressErrors.js';
import {asyncWrap} from '../utils/wrapAsync.js'

dotenv.config();

export default function initialize(passport) {
  // Local strategy
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
      const user = await User.findOne({ email });
      if (!user) return done(null, false, { message: 'No user with that email' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return done(null, false, { message: 'Incorrect password' });

      return done(null, user);
    }catch{
      return done(new expressError("something went wrong", 500));
    }
  
    }
  ));


// Google strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        name: profile.displayName,
        googleId: profile.id,
        email: profile.emails[0].value,
        profilePic: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null
      
      },
      { upsert: true, new: true }
    );
    }
    return done(null, user);
  } catch (error) {
    console.error('❌ Google OAuth error:', error.message);
    return done(new expressError('Google authentication failed', 500));
  }
  }));
  passport.serializeUser((user, done) => {
    try {
      done(null, user.id);
    } catch (error) {
      console.error('❌ Serialize user error:', error.message);
      done(error);
    }
  });
  
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      console.error('❌ Deserialize user error:', error.message);
      done(error);
    }
  });


// git  strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: process.env.GITHUB_CALLBACK_URL,
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value || `${profile.username}@github.com`; // fallback
    let user = await User.findOne({ githubId: profile.id });
    if (user) {
      return done(null, user);
    }
    user = await User.findOne({ email });
    if (user) {
      user.githubId = profile.id;
      await user.save();
      return done(null, user);
    }
    const newUser = new User({
      username: profile.username,
      email,
      githubId: profile.id
    });
    await newUser.save();
    return done(null, newUser);
  } catch (err) {
    return done(err, null);
  }
}));
}
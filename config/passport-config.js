import mongoose from 'mongoose';
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


// Helper to compute dynamic callback URL with fallback
const getCallbackUrl = (configuredUrl, defaultPath) => {
  if (configuredUrl && configuredUrl.startsWith('http')) {
    // If user mistakenly configured just base URL like "https://perpage-app.onrender.com"
    if (!configuredUrl.includes('/auth/')) {
      return `${configuredUrl.replace(/\/+$/, '')}${defaultPath}`;
    }
    return configuredUrl;
  }
  const baseUrl = (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${baseUrl}${defaultPath}`;
};

// Google strategy
const googleCallback = getCallbackUrl(process.env.GOOGLE_CALLBACK_URL, '/auth/google/callback');
console.log('🔗 [OAuth] Google callback registered as:', googleCallback);

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: googleCallback,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    const photo = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;

    let user = await User.findOne({ googleId: profile.id });
    if (user) {
      let needsSave = false;
      if (photo && (!user.profilePic || user.profilePic !== photo)) {
        user.profilePic = photo;
        needsSave = true;
      }
      if (!user.name && profile.displayName) {
        user.name = profile.displayName;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
      return done(null, user);
    }

    if (email) {
      user = await User.findOne({ email });
      if (user) {
        user.googleId = profile.id;
        if (photo && (!user.profilePic || user.profilePic !== photo)) {
          user.profilePic = photo;
        }
        if (!user.name && profile.displayName) {
          user.name = profile.displayName;
        }
        await user.save();
        return done(null, user);
      }
    }

    const newUser = new User({
      name: profile.displayName || profile.name?.givenName || 'User',
      googleId: profile.id,
      email: email,
      profilePic: photo || ''
    });
    await newUser.save();
    return done(null, newUser);
  } catch (error) {
    console.error('❌ Google OAuth error:', error.message);
    return done(new expressError('Google authentication failed', 500));
  }
}));

passport.serializeUser((user, done) => {
  try {
    const id = user._id ? user._id.toString() : (user.id || (Array.isArray(user) ? user[0]?._id?.toString() : null));
    done(null, id);
  } catch (error) {
    console.error('❌ Serialize user error:', error.message);
    done(error);
  }
});

  
  passport.deserializeUser(async (id, done) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return done(null, false);
      }
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      console.warn('⚠️ Could not deserialize user (DB offline or error):', error.message);
      done(null, false);
    }
  });


// git  strategy
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: getCallbackUrl(process.env.GITHUB_CALLBACK_URL, '/auth/github/callback'),
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
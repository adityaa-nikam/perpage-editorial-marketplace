import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

export const ADMIN_EMAIL = 'adityatanajinikam@gmail.com';
export const ADMIN_INITIAL_PASSWORD = 'Admin@PerPage2026!';

/**
 * Ensures the primary platform administrator exists with role: 'admin' and active credentials.
 */
export async function ensureAdminUser() {
  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL });
    const hashedPassword = await bcrypt.hash(ADMIN_INITIAL_PASSWORD, 10);

    if (!existing) {
      const adminUser = new User({
        name: 'Aditya Nikam (Admin)',
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
        isSuspended: false,
        bio: 'Platform Administrator & Operations Controller'
      });
      await adminUser.save();
      console.log(`🛡️ [Admin Setup] Primary administrator initialized: ${ADMIN_EMAIL} (role: admin)`);
      return adminUser;
    }

    // Enforce role: 'admin' strictly
    let updated = false;
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      updated = true;
    }
    if (existing.isSuspended) {
      existing.isSuspended = false;
      updated = true;
    }

    // Ensure password matches the administrative access key
    existing.password = hashedPassword;
    await existing.save();
    console.log(`🛡️ [Admin Setup] Primary administrator verified & secured: ${ADMIN_EMAIL} (role: admin)`);
    return existing;
  } catch (err) {
    console.warn('⚠️ [Admin Setup] Could not verify/seed admin user:', err.message);
    return null;
  }
}

export default ensureAdminUser;

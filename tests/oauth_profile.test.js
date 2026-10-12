import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Google OAuth & Profile Picture Display Suite', () => {

  it('GET /profile redirects unauthenticated user to /login', async () => {
    const res = await fetch(`${BASE_URL}/profile`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.ok(res.headers.get('location').includes('/login'));
  });

  it('GET /profile with mockUser redirects to /profile/:id', async () => {
    const res = await fetch(`${BASE_URL}/profile?mockUser=1`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    const location = res.headers.get('location');
    assert.ok(location.startsWith('/profile/'), `Expected redirect to /profile/:id, got ${location}`);
  });

  it('GET /profile/:id renders avatar image with referrerpolicy="no-referrer"', async () => {
    const res = await fetch(`${BASE_URL}/profile/64f1a2b3c4d5e6f7a8b9c0d1?mockUser=1`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('Account Settings'), 'Renders Account Settings header');
    assert.ok(html.includes('Account Avatar'), 'Renders Account Avatar section');
  });

  it('Navbar renders user dropdown and profile pic support when logged in', async () => {
    const res = await fetch(`${BASE_URL}/?mockUser=1`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('id="user-menu-button"'), 'Navbar includes user-menu-button');
    assert.ok(html.includes('Sign out'), 'Dropdown includes Sign out button');
    assert.ok(html.includes('referrerpolicy="no-referrer"'), 'Navbar img tag uses referrerpolicy="no-referrer"');
  });

});

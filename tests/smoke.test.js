import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSafeRedirect } from '../utils/safeRedirect.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

describe('PerPage Smoke & Security Test Suite', () => {

  describe('1. Public Routes Status Codes', () => {
    const publicRoutes = [
      { path: '/', expected: 200 },
      { path: '/writers', expected: 200 },
      { path: '/about', expected: 200 },
      { path: '/login', expected: 200 },
      { path: '/register', expected: 200 },
      { path: '/health', expected: 200 },
      { path: '/api/test', expected: 200 },
      { path: '/robots.txt', expected: 200 },
      { path: '/sitemap.xml', expected: 200 },
      { path: '/non-existent-route-xyz', expected: 404 }
    ];

    for (const route of publicRoutes) {
      it(`GET ${route.path} returns ${route.expected}`, async () => {
        const res = await fetch(`${BASE_URL}${route.path}`, { redirect: 'manual' });
        if (route.path === '/health') {
          assert.ok(
            res.status === 200 || res.status === 503,
            `Expected ${route.path} to return 200 or 503, got ${res.status}`
          );
        } else {
          assert.equal(res.status, route.expected, `Expected ${route.path} to return ${route.expected}, got ${res.status}`);
        }
      });
    }
  });

  describe('2. Security Headers & CSP Report-Only', () => {
    it('serves expected security headers on HTML responses', async () => {
      const res = await fetch(`${BASE_URL}/`);
      assert.equal(res.status, 200);

      // Helmet defaults
      const nosniff = res.headers.get('x-content-type-options');
      assert.equal(nosniff, 'nosniff', 'Missing nosniff header');

      const frameGuard = res.headers.get('x-frame-options');
      assert.ok(frameGuard, 'Missing x-frame-options header');

      // CSP Report-Only Header
      const cspReportOnly = res.headers.get('content-security-policy-report-only');
      assert.ok(cspReportOnly, 'Missing content-security-policy-report-only header');
      assert.ok(cspReportOnly.includes("default-src 'self'"), 'CSP missing default-src');
      assert.ok(cspReportOnly.includes("https://cdn.jsdelivr.net"), 'CSP missing Alpine CDN source');
      assert.ok(cspReportOnly.includes("'unsafe-eval'"), 'CSP missing required unsafe-eval for Alpine');

      // X-Powered-By must be removed
      assert.equal(res.headers.get('x-powered-by'), null, 'x-powered-by header must be stripped');
    });
  });

  describe('3. CSRF Protection (Origin / Referer Validation)', () => {
    it('rejects cross-origin POST to /login with 403', async () => {
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Origin': 'https://evil-attacker.com',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'email=test@example.com&password=password123'
      });
      assert.equal(res.status, 403, 'Cross-origin POST to /login must return 403');
    });

    it('rejects cross-origin POST to /deal with 403', async () => {
      const res = await fetch(`${BASE_URL}/deal`, {
        method: 'POST',
        headers: {
          'Origin': 'https://malicious-site.org',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'pages=5'
      });
      assert.equal(res.status, 403, 'Cross-origin POST to /deal must return 403');
    });

    it('rejects cross-origin POST to /logout with 403', async () => {
      const res = await fetch(`${BASE_URL}/logout`, {
        method: 'POST',
        headers: {
          'Origin': 'https://attacker.evil',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      assert.equal(res.status, 403, 'Cross-origin POST to /logout must return 403');
    });

    it('rejects POST with Origin: null with 403', async () => {
      const res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Origin': 'null',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'email=test@example.com&password=password123'
      });
      assert.equal(res.status, 403, 'Null-origin POST must return 403');
    });
  });

  describe('4. Input Hygiene & Query Parameter Guards', () => {
    it('/writers?q[$ne]=x does not crash and returns 200', async () => {
      const res = await fetch(`${BASE_URL}/writers?q[$ne]=x`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.ok(text.includes('Choose your editor'), 'Directory should render safely');
    });

    it('unknown query error codes reflect nothing harmful', async () => {
      const hostile = '<script>alert("xss")</script>';
      const res = await fetch(`${BASE_URL}/writers?error=${encodeURIComponent(hostile)}`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.ok(!text.includes('<script>alert("xss")</script>'), 'Raw query code should not be reflected unescaped');
    });
  });

  describe('5. Safe Redirection Unit Tests (Open Redirect Prevention)', () => {
    it('rejects protocol-relative URL //evil.com', () => {
      const result = getSafeRedirect('//evil.com', '/dashboard');
      assert.equal(result, '/dashboard');
    });

    it('rejects backslash protocol-relative /\\evil.com', () => {
      const result = getSafeRedirect('/\\evil.com', '/dashboard');
      assert.equal(result, '/dashboard');
    });

    it('rejects absolute URL https://evil.com', () => {
      const result = getSafeRedirect('https://evil.com', '/dashboard');
      assert.equal(result, '/dashboard');
    });

    it('rejects javascript: scheme URL javascript:alert(1)', () => {
      const result = getSafeRedirect('javascript:alert(1)', '/dashboard');
      assert.equal(result, '/dashboard');
    });

    it('rejects URLs containing backslashes', () => {
      const result = getSafeRedirect('/path\\to\\danger', '/dashboard');
      assert.equal(result, '/dashboard');
    });

    it('rejects URLs containing control characters', () => {
      const result = getSafeRedirect('/valid\x00evil', '/dashboard');
      assert.equal(result, '/dashboard');
    });

    it('accepts valid relative path /dashboard', () => {
      const result = getSafeRedirect('/dashboard', '/default');
      assert.equal(result, '/dashboard');
    });

    it('accepts valid relative path with query parameters /deal?writerId=123', () => {
      const target = '/deal?writerId=64f1a2b3c4d5e6f7a8b9c0d1';
      const result = getSafeRedirect(target, '/dashboard');
      assert.equal(result, target);
    });
  });

  describe('6. Logout Behavior', () => {
    it('GET /logout does not log anyone out and redirects to /', async () => {
      const res = await fetch(`${BASE_URL}/logout`, { redirect: 'manual' });
      assert.equal(res.status, 302);
      assert.equal(res.headers.get('location'), '/');
    });
  });

  describe('7. SEO & Sitemap Response Format', () => {
    it('GET /robots.txt returns valid plaintext with sitemap directive', async () => {
      const res = await fetch(`${BASE_URL}/robots.txt`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.ok(text.includes('User-agent: *'), 'Robots.txt missing User-agent');
      assert.ok(text.includes('Sitemap:'), 'Robots.txt missing Sitemap directive');
    });

    it('GET /sitemap.xml returns valid XML containing core pages', async () => {
      const res = await fetch(`${BASE_URL}/sitemap.xml`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('xml'), 'Sitemap content-type is not XML');
      const text = await res.text();
      assert.ok(text.includes('<urlset'), 'Sitemap missing urlset element');
      assert.ok(text.includes('/writers'), 'Sitemap missing /writers route');
      assert.ok(text.includes('/about'), 'Sitemap missing /about route');
    });
  });

  describe('8. Styleguide Route Removal', () => {
    it('/styleguide returns 404 (removed from application)', async () => {
      const res = await fetch(`${BASE_URL}/styleguide`, { redirect: 'manual' });
      assert.equal(res.status, 404, 'Styleguide must return 404');
    });
  });

});

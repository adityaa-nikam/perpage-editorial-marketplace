# PerPage — Document Editing & Feedback Marketplace

PerPage is a demonstration marketplace for editing and feedback on a person's own documents (reports, drafts, résumés, cover letters). Editors improve what the client wrote—they do not write documents from scratch. Pricing stays transparently per page. Built with Node.js, Express, EJS, Alpine.js, MongoDB, and AWS S3, the application follows a strict editorial "Paper & Ink" design system.

> **Demonstration Platform Notice**  
> No real payments are processed in this demo. All pricing, deadlines, and transactions are simulated. The platform serves as an end-to-end prototype for document editing and review workflows.

---

## Features

### Client Workflow
- **Freelance Editor Directory**: Browse editors filtered by pricing per page.
- **Deal Request Flow**: Initiate editing requests specifying target page count, deadline, detailed editing notes, and original draft PDF attachments, with an explicit confirmation that the submission is the client's own work.
- **Order Tracking**: Monitor active requests via a 4-step progress stepper (Pending &rarr; Accepted &rarr; Delivered &rarr; Completed).
- **Deliverable Review & Confirmation**: Download uploaded edited PDF deliverables and confirm project completion via an accessible confirmation modal.

### Editor Workflow
- **Rate Configuration**: Configure per-page rates with instant validation and dynamic client pricing estimates.
- **Request Management**: Review incoming client proposals, accept deals, or decline requests with confirmation dialogues.
- **Deliverable Upload**: Deliver completed edited draft files (stored as clean S3 object keys) directly to the client order.

### Authentication & Sessions
- **Email & Password**: Authenticate using standard credentials hashed with bcryptjs (12 salt rounds) and session cookies.
- **OAuth 2.0 Integration**: Optional sign-in via Google and GitHub providers configured through Passport.js.
- **Safe Redirection**: All post-authentication redirects pass through a strict URL validator to prevent open redirect attacks.
- **Protected Logout**: Logout is handled exclusively via state-changing `POST /logout` requests with CSRF origin validation.

### Security Hardening
- **HTTP Security Headers**: Powered by Helmet with a report-only Content Security Policy (strict script nonce, Google Fonts, and Alpine.js CDN).
- **CSRF Protection**: Origin and Referer header validation on all state-changing HTTP requests (`POST`, `PUT`, `DELETE`).
- **Rate Limiting**: Granular request limits on authentication (`10 req/15m`), deal actions (`20 req/15m`), and general traffic (`300 req/15m`).
- **Input Sanitization**: Query parameter type checking (blocking NoSQL injection via object payloads) and request body limits capped at 100 KB.
- **Clean S3 Keys**: Object keys are stored in standard relative paths (`finals/<uuid>_<name>.pdf`) rather than raw URLs with embedded query parameters.

### Editorial Design System ("Paper & Ink")
- **Custom CSS Variables**: Two tailored palettes (tactile paper light mode `#FAFAF7` and deep obsidian dark mode `#0B0C0E`).
- **Typography**: Instrument Serif display headings paired with Inter body copy.
- **Zero Anti-Patterns**: No gradients, no emoji icons (replaced with inline Lucide SVGs), no inline styles, and strict WCAG AA contrast compliance across all pages.
- **Accessible UI**: Keyboard-navigable Alpine.js modals, dropdowns, and file drop-zones with full fallback support when JavaScript is disabled.

---

## Tech Stack

- **Runtime**: Node.js (v18.x, v20.x, or v24.x)
- **Web Framework**: Express 4.x
- **Templating**: EJS with shared partials and layout shells
- **Interactivity**: Alpine.js (via CDN with CSP nonce)
- **Styling**: Vanilla CSS custom properties compiled via Tailwind CSS CLI
- **Database**: MongoDB with Mongoose ODM (MongoDB Atlas or local)
- **Object Storage**: AWS S3 via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
- **Security & Utilities**: `helmet`, `express-rate-limit`, `bcryptjs`, `express-session`, `connect-mongo`, `passport`

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- MongoDB instance (local or MongoDB Atlas connection string)
- AWS S3 bucket (optional for local mock mode; required for live file uploads)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/example/perpage.git
   cd perpage
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Copy `.env.example` to `.env` and fill in your connection credentials:
   ```bash
   cp .env.example .env
   ```

4. **Build the CSS bundle**:
   ```bash
   npm run build:css
   ```

5. **Start the application**:
   ```bash
   npm start
   ```
   The application will be running at [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Description | Required | Default / Example |
| :--- | :--- | :--- | :--- |
| `PORT` | HTTP port the server binds to | No | `3000` |
| `NODE_ENV` | Application environment (`development` or `production`) | No | `development` |
| `SITE_URL` | Canonical base URL used for sitemaps, robots.txt, and CSRF origin checks | Yes (Prod) | `http://localhost:3000` |
| `REPO_URL` | Public GitHub repository URL displayed on the About page | No | `https://github.com/example/perpage` |
| `SESSION_SECRET` | Cryptographic secret used to sign session cookies | Yes (Prod) | `secretkey` (warns in prod) |
| `MONGO_URL` | MongoDB connection string (Atlas SRV or local URI) | Yes | `mongodb://localhost:27017/perpage` |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key with S3 Put/Get permissions | No (Mock) | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key | No (Mock) | `...` |
| `AWS_REGION` | AWS S3 region | No | `us-east-1` |
| `S3_BUCKET_NAME` | Name of the AWS S3 storage bucket | No (Mock) | `my-bucket` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID for social authentication | No | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | No | `...` |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect URL | No | `http://localhost:3000/auth/google/callback` |
| `GITHUB_CLIENT_ID` | GitHub OAuth Application Client ID | No | `...` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Application Client Secret | No | `...` |
| `GITHUB_CALLBACK_URL` | GitHub OAuth callback URL | No | `http://localhost:3000/auth/github/callback` |
| `RATE_LIMIT_DISABLED` | Set to `1` to disable express-rate-limit during automated testing | No | `0` |

---

## NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run build:css` | Compiles `src/styles/app.css` into minified `public/css/app.css` using Tailwind CLI |
| `npm run dev:css` | Watches `src/styles/app.css` and templates for live compilation |
| `npm run dev` | Runs CSS watch alongside `node index.js` |
| `npm start` | Starts the production Express server (`node index.js`) |
| `npm run test:smoke` | Runs the automated Node.js test runner suite (`tests/smoke.test.js`) |
| `npm run seed:demo` | Seeds 8 demo writers, 2 demo students, and 12 deals into local database |
| `npm run seed:demo:remove` | Idempotently purges all seeded demo records |

---

## Demo data (local only)

For local development, manual verification, and screenshot reviews, a dedicated seeding script is provided in `scripts/seed-demo.js`:
- Generates **8 demo writers** (`demo-writer-N@example.com`) with realistic academic backgrounds, variable bio lengths (including one with no bio and one with an extended multi-sentence monograph bio), and diverse rates (including one with an unset rate of $0).
- Generates **2 demo students** (`demo-student-N@example.com`) and **12 academic deals** representing every reachable status in the workflow (`pending`, `accepted`, deliverable attached, `completed`, `rejected`).
- **Safety Guard**: The script strictly refuses to execute if `NODE_ENV === 'production'` or if `MONGO_URL` does not point to `localhost` or `127.0.0.1`, printing the target database before execution.

```bash
# Seed demo data (idempotent, replaces existing demo records)
npm run seed:demo

# Remove all demo records safely
npm run seed:demo:remove
```

---

## Production Deployment (Render)

When deploying to Render or similar cloud platforms:

1. **Service Type**: Web Service
2. **Environment**: Node
3. **Build Command**:
   ```bash
   npm install && npm run build:css
   ```
4. **Start Command**:
   ```bash
   node index.js
   ```
5. **Environment Variables**:
   - Set `NODE_ENV=production`
   - Set `SITE_URL` to your production domain (e.g. `https://perpage.onrender.com`)
   - Set `SESSION_SECRET` to a cryptographically random string (32+ characters)
   - Set `MONGO_URL` to your MongoDB Atlas connection string
   - Configure S3 credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `AWS_REGION`)
6. **Reverse Proxy & Cookies**:
   - `index.js` enables `app.set('trust proxy', 1)`.
   - In production (`NODE_ENV === 'production'`), session cookies automatically enable the `secure: true` flag and `sameSite: 'lax'`.

---

## Test Suite & Verification

The project includes an automated test runner suite verifying routes, security headers, CSRF validation, input sanitization, and redirect safety:

```bash
npm run test:smoke
```

All 29 tests pass with zero failures:
- 10 Public Route status tests
- Security headers and report-only CSP verification
- CSRF Origin / Referer validation tests
- Query parameter injection guards
- Safe redirect unit tests (blocking `//`, `/\`, absolute URLs, and control characters)
- Safe logout behavior
- SEO robots.txt and sitemap.xml format verification
- Production styleguide gating verification

---

## Screenshots

Interface screenshots capturing desktop (1440px) and mobile (390px) viewports across light and dark modes are saved in `docs/screenshots/`:

| Page / State | Desktop Light | Desktop Dark | Mobile Light | Mobile Dark |
| :--- | :--- | :--- | :--- | :--- |
| **About Page** | [about-light-1440.png](file:///docs/screenshots/about-light-1440.png) | [about-dark-1440.png](file:///docs/screenshots/about-dark-1440.png) | [about-light-390.png](file:///docs/screenshots/about-light-390.png) | [about-dark-390.png](file:///docs/screenshots/about-dark-390.png) |
| **404 Not Found** | [error-404-light-1440.png](file:///docs/screenshots/error-404-light-1440.png) | [error-404-dark-1440.png](file:///docs/screenshots/error-404-dark-1440.png) | [error-404-light-390.png](file:///docs/screenshots/error-404-light-390.png) | [error-404-dark-390.png](file:///docs/screenshots/error-404-dark-390.png) |
| **403 Forbidden** | [error-403-1440.png](file:///docs/screenshots/error-403-1440.png) | — | — | — |
| **429 Rate Limit** | [error-429-1440.png](file:///docs/screenshots/error-429-1440.png) | — | — | — |
| **500 Server Error**| [error-500-1440.png](file:///docs/screenshots/error-500-1440.png) | — | — | — |
| **User Dropdown** | [navbar-logged-in-logout.png](file:///docs/screenshots/navbar-logged-in-logout.png) | — | — | — |

---

## Known Boundaries & Limitations

- **Simulated Financial Transactions**: No credit card processing or payment gateway is integrated. Deals calculate agreed totals based on page counts and rates for demonstration purposes.
- **Local Fallback Mode**: When AWS S3 credentials are unset, assignment file uploads and download links fallback to local mock handlers for development preview.
- **Single PDF Attachment**: Assignment prompts accept a single PDF document up to 10 MB in size.

# PerPage Design System: "Paper & Ink"

> **Design Direction**: Calm, editorial, trustworthy, like a modern university press crossed with Linear/Stripe. Not a neon SaaS template. Every future prompt and UI view in the PerPage platform must adhere to the tokens, rules, and component patterns documented here.

---

## 1. Core Principles & Philosophy

1. **Light Mode is the Primary Foundation**:
   - The default theme is warm, tactile paper (`#FAFAF7`). Dark mode (`#0B0C0E`) is a carefully calibrated secondary theme, not a lazy color inversion.
   - Theme preferences respect `prefers-color-scheme`, persist to `localStorage.theme`, and prevent FOUC (flash of unstyled theme) via an inline script in `<head>`.
2. **Restricted Accent Utility**:
   - The electric blue accent (`#3347FF` in light, `#6E7BFF` in dark) is strictly reserved for:
     - Primary call-to-action buttons (`.btn-primary`)
     - Inline text links and active navigation tabs
     - Keyboard focus indicator rings (`:focus-visible`)
     - Active stepper milestones
   - **Never** use the accent for decorative backgrounds, large cards, or non-interactive headings.
3. **Typography-Driven Hierarchy**:
   - Display and section headings use **Instrument Serif** (or Fraunces fallback) with tight tracking (`-0.025em` to `-0.03em`).
   - Body copy, forms, badges, and interface data use **Inter** with generous line-height (`1.5` to `1.6`) for effortless readability.
4. **Restraint & Elevation**:
   - Flat, subtle 1px borders (`var(--border-color)`) are prioritized over high-contrast drop shadows.
   - Motion is subtle (150ms–200ms `ease-out`) and disabled when `prefers-reduced-motion: reduce` is detected.

---

## 2. Hard Anti-Patterns (Absolute Don'ts)

| Anti-Pattern | Why It Is Forbidden | Paper & Ink Alternative |
| :--- | :--- | :--- |
| **Gradient Text** | Cheap, generic AI aesthetics; hard to read | Solid Ink (`var(--text-ink)`) with serif display font |
| **Glow Blobs / Blur Circles** | Distracting neon template look | Warm paper surface with 1px border cards |
| **Glassmorphism / Heavy Blur** | Accessibility issue; poor contrast | Solid surfaces (`var(--bg-surface)`) with clean borders |
| **Emoji in Interface Elements** | Inconsistent across OS; unprofessional | Inline Lucide SVGs via `<%- icon('name') %>` |
| **Purple-to-Blue Gradients** | Generic SaaS template signature | Single solid accent CTA button (`.btn-primary`) |
| **Rainbow Badges / Stat Counters**| Chaotic visual hierarchy | Semantic badges with muted backgrounds and dark text |

---

## 3. Design Tokens (CSS Variables)

All tokens are defined in `/src/styles/app.css` and compiled via the Tailwind v4 CLI to `/public/css/app.css`:

### Light Mode (Default)
```css
:root {
  --bg-background: #FAFAF7;         /* Warm paper base */
  --bg-surface: #FFFFFF;            /* Pure white card/nav surface */
  --bg-surface-muted: #F3F2EE;      /* Subtle muted background */
  --text-ink: #0E0F12;              /* Deep ink for headings & text */
  --text-muted: #5B5F68;            /* Secondary metadata text */
  --border-color: #E7E5DF;          /* Subtle dividing border */
  --border-strong: #D5D2C9;         /* High-contrast border */
  --accent: #3347FF;                /* Primary action color */
  --accent-hover: #2235E6;          /* Primary button hover */
  --accent-foreground: #FFFFFF;     /* Text on accent */
  --accent-subtle: #EEF0FF;         /* Accent wash for active nav */
  --accent-subtle-border: #D0D6FF;  /* Accent badge border */
}
```

### Dark Mode (Secondary)
```css
.dark {
  --bg-background: #0B0C0E;         /* Deep obsidian background */
  --bg-surface: #131519;            /* Slightly elevated card surface */
  --bg-surface-muted: #1A1D22;      /* Muted inset surface */
  --text-ink: #F2F2EF;              /* Crisp light ink */
  --text-muted: #9AA0AA;            /* Muted cool grey */
  --border-color: #25282E;          /* Muted dark border */
  --border-strong: #363A42;         /* Focused dark border */
  --accent: #6E7BFF;                /* High-contrast dark mode accent */
  --accent-hover: #838EFF;          /* Dark mode accent hover */
  --accent-foreground: #FFFFFF;     /* Text on accent */
  --accent-subtle: #181B38;         /* Subtle accent wash */
  --accent-subtle-border: #2B326B;  /* Subtle accent border */
}
```

### Semantic Status Tokens
| State | Light Background | Light Foreground | Dark Background | Dark Foreground |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `#ECFDF5` | `#065F46` | `#064E3B` | `#A7F3D0` |
| **Warning** | `#FFFBEB` | `#92400E` | `#451A03` | `#FDE68A` |
| **Danger**  | `#FEF2F2` | `#991B1B` | `#450A0A` | `#FECACA` |
| **Info**    | `#EFF6FF` | `#1E40AF` | `#172554` | `#BFDBFE` |

---

## 4. Typography Scale

Fonts are imported via Google Fonts with `font-display: swap` in `head.ejs`:
- Serif: `Instrument Serif`, `Georgia`, serif
- Sans: `Inter`, system-ui, sans-serif

| Style Class | Font Family | Size (clamp / rem) | Tracking | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `.type-display` | Instrument Serif | `clamp(2.75rem, 5vw, 4.25rem)` | `-0.03em` | `1.05` | Landing page hero titles |
| `.type-h1` | Instrument Serif | `clamp(2.25rem, 3.5vw, 3rem)` | `-0.025em` | `1.15` | Page titles (H1) |
| `.type-h2` | Instrument Serif | `clamp(1.75rem, 2.5vw, 2.25rem)` | `-0.02em` | `1.25` | Section headers |
| `.type-h3` | Inter (600) | `1.375rem` (22px) | `-0.015em` | `1.35` | Card headings |
| `.type-h4` | Inter (600) | `1.125rem` (18px) | Normal | `1.4` | Form / block titles |
| `.type-body` | Inter (400) | `1rem` (16px) | Normal | `1.6` | Standard body paragraphs |
| `.type-small` | Inter (400) | `0.875rem` (14px) | Normal | `1.5` | Data tables, form hints |
| `.type-caption` | Inter (400) | `0.75rem` (12px) | `0.02em` | `1.4` | Timestamps, micro labels |
| `.type-eyebrow` | Inter (600) | `0.75rem` (12px) | `0.08em` | `1.0` | Uppercase category kicker |

---

## 5. Lucide Icon Helper

Icons are rendered as inline SVGs. Do not use emoji or external icon font stylesheets.

### Helper Usage in EJS
```ejs
<!-- In any EJS template -->
<%- icon('arrow-right', { class: 'w-4 h-4 text-[var(--accent)]' }) %>

<!-- Or via the partial wrapper -->
<%- include('partials/icon', { name: 'shield-check', class: 'w-5 h-5 text-green-600' }) %>
```

### Supported Icons
`arrow-right`, `arrow-up-right`, `check`, `x`, `menu`, `sun`, `moon`, `star`, `upload`, `file-text`, `download`, `clock`, `user`, `log-out`, `layout-dashboard`, `search`, `shield-check`, `message-square`, `chevron-down`, `chevron-right`, `chevron-left`, `alert-circle`, `info`, `loader`, `copy`, `external-link`.

---

## 6. Layout Shell Architecture

Every view in `/views` inherits the standard shell:

```ejs
<%- include('partials/head', { pageTitle: 'Page Title — PerPage', metaDescription: '...' }) %>
<%- include('partials/navbar') %>

<main id="main-content" class="py-12 sm:py-16">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
    <!-- View content goes here -->
  </div>
</main>

<%- include('partials/footer') %>
<%- include('partials/scripts') %>
```

### Navbar Features
- Sticky, 64px height (`h-16`), 1px bottom border (`var(--border-color)`).
- Left: Typographic PerPage logo.
- Center: Active state links highlighted with `bg-[var(--accent-subtle)] text-[var(--accent)]` via `res.locals.currentPath`.
- Right: Theme toggle icon button, authentication state (Login/Register vs Alpine.js user avatar dropdown).
- Mobile: Fully responsive Alpine.js drawer with focus management and `Esc` to close.

### Footer Features
- Clean 4-column layout: Brand info, Platform links, Editorial Standards, Technical Details.
- Academic disclaimer rendered as small, low-contrast text.

---

## 7. Component Library Reference

### 1. Buttons
```html
<!-- Primary CTA -->
<button class="btn btn-primary btn-md">
  Confirm Order <%- icon('arrow-right', { class: 'w-4 h-4' }) %>
</button>

<!-- Secondary Action -->
<button class="btn btn-secondary btn-md">Cancel</button>

<!-- Ghost Action -->
<button class="btn btn-ghost btn-sm">Dismiss</button>

<!-- Danger Action -->
<button class="btn btn-danger btn-sm">Reject Deal</button>

<!-- Loading State -->
<button class="btn btn-primary btn-md is-loading">Loading</button>
```

### 2. Form Controls
```html
<div>
  <label for="pages" class="form-label">Page Count</label>
  <input type="number" id="pages" name="pages" class="form-input" placeholder="e.g. 5">
  <p class="form-hint">Standard page is approx. 250 words.</p>
</div>
```

### 3. Cards
```html
<div class="card p-6">
  <h3 class="type-h3">Title</h3>
  <p class="text-xs text-[var(--text-muted)]">Content</p>
</div>
```

### 4. Badges
```html
<span class="badge badge-neutral">Draft</span>
<span class="badge badge-accent">In Progress</span>
<span class="badge badge-success">Completed</span>
<span class="badge badge-warning">Awaiting Review</span>
<span class="badge badge-danger">Rejected</span>
```

### 5. Avatars
```html
<!-- Initials Fallback -->
<div class="avatar avatar-md">KK</div>

<!-- Image Avatar -->
<div class="avatar avatar-lg">
  <img src="/avatar.jpg" alt="Author name">
</div>
```

### 6. Data Tables
```html
<div class="table-wrapper overflow-x-auto">
  <table class="data-table">
    <thead>
      <tr>
        <th>Author</th>
        <th>Pages</th>
        <th>Rate</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Dr. Vance</td>
        <td>10</td>
        <td>₹1,500</td>
        <td><span class="badge badge-accent">In Progress</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

### 7. Deal Stepper Pipeline
```html
<div class="timeline-stepper max-w-xl mx-auto py-2">
  <div class="stepper-step is-complete">
    <div class="stepper-indicator"><%- icon('check', { class: 'w-3 h-3' }) %></div>
    <div class="stepper-line"></div>
  </div>
  <div class="stepper-step is-current">
    <div class="stepper-indicator">2</div>
    <div class="stepper-line"></div>
  </div>
  <div class="stepper-step">
    <div class="stepper-indicator">3</div>
  </div>
</div>
```

### Accordion (Alpine.js Accessible Accordion)
```html
<div x-data="{ active: null }" class="accordion">
  <div class="accordion-item">
    <button 
      type="button" 
      @click="active = (active === 1 ? null : 1)" 
      :aria-expanded="(active === 1).toString()"
      aria-controls="faq-content-1"
      id="faq-btn-1"
      class="accordion-trigger"
    >
      <span>Question text here?</span>
      <span :class="active === 1 ? 'rotate-180' : ''" class="transition-transform duration-200">
        <%- icon('chevron-down', { class: 'w-4 h-4' }) %>
      </span>
    </button>
    <div 
      x-show="active === 1" 
      id="faq-content-1"
      role="region"
      aria-labelledby="faq-btn-1"
      class="accordion-content"
    >
      Answer content here.
    </div>
  </div>
</div>
```

### Bento Card
```html
<div class="bento-card">
  <div>
    <div class="w-8 h-8 rounded-md bg-[var(--bg-surface-muted)] border border-[var(--border-color)] flex items-center justify-center mb-4 text-[var(--accent)]">
      <%- icon('shield-check', { class: 'w-4 h-4' }) %>
    </div>
    <h3 class="type-h4 mb-2">Feature Title</h3>
    <p class="type-small text-[var(--text-muted)]">Short descriptive feature copy.</p>
  </div>
</div>
```

### Step Numeral
```html
<span class="step-numeral">01</span>
```

### Alerts
```html
<div class="alert alert-info">
  <%- icon('info', { class: 'w-4 h-4 shrink-0' }) %>
  <span>Set your rate so students can create deals with you.</span>
</div>
```

### Filter Chips
```html
<div class="flex items-center gap-2">
  <span class="chip">
    Query: economics
    <a href="/writers" class="chip-remove" aria-label="Remove filter">
      <%- icon('x', { class: 'w-3 h-3' }) %>
    </a>
  </span>
</div>
```

### Pagination Controls
```html
<nav aria-label="Pagination" class="pagination">
  <a href="?page=1" class="pagination-link"><%- icon('chevron-left', { class: 'w-4 h-4' }) %></a>
  <a href="?page=1" class="pagination-link is-active" aria-current="page">1</a>
  <a href="?page=2" class="pagination-link">2</a>
  <a href="?page=2" class="pagination-link"><%- icon('chevron-right', { class: 'w-4 h-4' }) %></a>
</nav>
```

### Input Prefix / Suffix Group
```html
<div class="input-group">
  <span class="input-group-addon">₹</span>
  <input type="number" id="pricePerPage" name="pricePerPage" class="form-input">
  <span class="input-group-addon">per page</span>
</div>
```

### Vertical Stepper
```html
<div class="stepper">
  <div class="stepper-step">
    <div class="stepper-marker">1</div>
    <div class="stepper-content">
      <h3 class="text-sm font-semibold">Create a deal</h3>
      <p class="text-xs text-[var(--text-muted)]">Provide instructions and upload brief.</p>
    </div>
  </div>
</div>
```

### File-drop-zone & Selected-File Row
A accessible file uploader built on a real, focusable `<input type="file">` element enhanced with drag-and-drop feedback and an Alpine.js selected-file preview row.

```html
<div 
  class="file-dropzone relative transition-colors focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2"
  :class="{ 'border-[var(--accent)] bg-[var(--accent-subtle)]': isDragging, 'border-[var(--semantic-danger-border)]': clientFileError }"
  @dragover.prevent="isDragging = true"
  @dragleave.prevent="isDragging = false"
  @drop.prevent="handleDrop($event)"
>
  <!-- Dropzone Idle / Empty State -->
  <div x-show="!selectedFile" class="space-y-3">
    <div class="w-10 h-10 mx-auto rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)]" aria-hidden="true">
      <%- icon('upload', { class: 'w-5 h-5' }) %>
    </div>
    <div>
      <p class="text-xs sm:text-sm font-medium text-[var(--text-ink)]">
        Upload your brief as a PDF, up to <%= FILE_MAX_MB %> MB.
      </p>
      <p class="text-xs text-[var(--text-muted)] mt-0.5">
        Drag and drop your file here, or select from your device
      </p>
    </div>
    <!-- Real focusable input remains accessible -->
    <div class="pt-1">
      <input 
        type="file" 
        name="file" 
        id="file" 
        accept="application/pdf,.pdf" 
        required
        x-ref="fileInput"
        @change="handleFileChange($event)"
        class="block w-full text-xs text-[var(--text-muted)] file:mr-3 file:py-2 file:px-4 file:rounded-md file:border file:border-[var(--border-color)] file:text-xs file:font-medium file:bg-[var(--bg-surface)] file:text-[var(--text-ink)] hover:file:bg-[var(--bg-surface-muted)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
    </div>
  </div>

  <!-- Selected File Row (Alpine.js) -->
  <div x-show="selectedFile" x-cloak class="flex items-center justify-between gap-3 p-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg text-left">
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-8 h-8 rounded bg-[var(--bg-surface-muted)] border border-[var(--border-color)] flex items-center justify-center text-[var(--accent)] shrink-0" aria-hidden="true">
        <%- icon('file-text', { class: 'w-4 h-4' }) %>
      </div>
      <div class="min-w-0">
        <p class="text-xs font-medium text-[var(--text-ink)] truncate max-w-[200px] sm:max-w-[280px]" :title="selectedFile?.name" x-text="selectedFile?.name"></p>
        <p class="text-[11px] text-[var(--text-muted)]" x-text="formatBytes(selectedFile?.size)"></p>
      </div>
    </div>
    <button 
      type="button" 
      @click="clearFile()" 
      class="btn btn-ghost btn-sm text-[var(--semantic-danger-text)] hover:bg-[var(--semantic-danger-bg)] shrink-0"
      aria-label="Remove selected file"
    >
      <%- icon('x', { class: 'w-3.5 h-3.5 mr-1' }) %>
      Remove
    </button>
  </div>
</div>
```

### Sticky Summary Card Pattern
Provides transparent order calculation alongside forms, sticky on desktop (`lg:col-span-5 lg:sticky lg:top-24`) and stacked on mobile. Operates fully without JavaScript (showing static rates and disclaimers), and upgrades with Alpine.js to calculate live totals in real-time as users modify page inputs.

```html
<aside class="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
  <div class="card p-6 space-y-6">
    <!-- Entity Row -->
    <div class="flex items-center gap-3 pb-5 border-b border-[var(--border-color)]">
      <div class="avatar avatar-lg shrink-0"><span>EV</span></div>
      <div class="min-w-0 flex-1">
        <h2 class="text-base font-semibold truncate">Dr. Eleanor Vance</h2>
        <a href="/writers/id" class="text-xs text-[var(--accent)] hover:underline">View profile &nearr;</a>
      </div>
    </div>

    <!-- Calculation Rows -->
    <dl class="space-y-3 text-sm">
      <div class="flex items-center justify-between">
        <dt class="text-[var(--text-muted)]">Rate</dt>
        <dd class="font-medium">₹150 per page</dd>
      </div>
      <div class="flex items-center justify-between" x-show="pages" x-cloak>
        <dt class="text-[var(--text-muted)]">Pages</dt>
        <dd class="font-medium" x-text="pages">1</dd>
      </div>
      <div class="pt-3 border-t border-[var(--border-color)] p-3 bg-[var(--bg-surface-muted)] rounded-lg space-y-1">
        <div class="flex items-center justify-between">
          <dt class="font-medium text-[var(--text-ink)]">Estimated total</dt>
          <dd class="text-base font-semibold font-mono" x-text="'₹' + Number(estimatedTotal).toLocaleString('en-IN')">₹150</dd>
        </div>
        <p class="text-[11px] text-[var(--text-muted)]">Estimate. The final total is calculated by the server when you create the deal.</p>
      </div>
    </dl>

    <!-- What Happens Next Stepper -->
    <div class="pt-5 border-t border-[var(--border-color)] space-y-4">
      <h3 class="type-eyebrow text-[var(--accent)]">What happens next</h3>
      <ol class="space-y-4">
        <li class="flex items-start gap-3">
          <div class="w-6 h-6 rounded-full bg-[var(--bg-surface-muted)] border border-[var(--border-color)] flex items-center justify-center text-xs font-semibold shrink-0">1</div>
          <div class="text-xs">
            <p class="font-semibold text-[var(--text-ink)]">Writer reviews your request</p>
            <p class="text-[var(--text-muted)]">Checks your prompt brief and instructions.</p>
          </div>
        </li>
      </ol>
    </div>
  </div>
</aside>
```

### Deal Card Component (Stacked Responsive Card)
A clean 1px border card container for dashboard management with responsive header, facts breakdown, status badge, compact stepper, expandable disclosure, and role-specific action area.

```html
<article class="card p-5 sm:p-6 space-y-5" x-data="{ expanded: false }">
  <!-- Header: Counterpart entity, ID, creation date, semantic badge -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-color)] pb-4">
    <div class="flex items-center gap-3 min-w-0">
      <div class="avatar avatar-md shrink-0"><span>EV</span></div>
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold truncate">Dr. Eleanor Vance</span>
          <span class="text-xs text-[var(--text-muted)] font-mono">#A1B2C3</span>
        </div>
        <time datetime="2026-10-10" class="text-xs text-[var(--text-muted)]">Created 10 Oct 2026</time>
      </div>
    </div>
    <span class="badge badge-accent"><%- icon('loader', { class: 'w-3 h-3' }) %> Accepted</span>
  </div>

  <!-- Facts: Pages, Rate, Total -->
  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
    <div>
      <span class="text-[var(--text-muted)] block">Pages</span>
      <span class="font-medium font-mono">10 pages</span>
    </div>
    <div>
      <span class="text-[var(--text-muted)] block">Rate</span>
      <span class="font-medium font-mono">₹150 / page</span>
    </div>
    <div>
      <span class="text-[var(--text-muted)] block">Total</span>
      <span class="font-semibold font-mono">₹1,500</span>
    </div>
  </div>
</article>
```

### Filter Pills Toolbar Component
Horizontally scrollable filter pills with inline count badges and active page state (`aria-current="page"`).

```html
<div class="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
  <a href="/dashboard?status=all" class="chip bg-[var(--accent-subtle)] text-[var(--accent)] border-[var(--accent-subtle-border)]" aria-current="page">
    All <span class="text-[10px] font-mono px-1 py-0.2 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-muted)] ml-1">12</span>
  </a>
  <a href="/dashboard?status=pending" class="chip hover:border-[var(--border-strong)]">
    Pending <span class="text-[10px] font-mono px-1 py-0.2 rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-muted)] ml-1">3</span>
  </a>
</div>
```

### Stat Row Block Pattern
Neutral, high-contrast metric summaries that link directly to matching filtered views.

```html
<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
  <a href="/dashboard?status=pending" class="card p-4 hover:border-[var(--border-strong)] transition-colors group">
    <div class="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--text-ink)]">Pending</div>
    <div class="text-2xl font-semibold mt-1 font-mono text-[var(--text-ink)]">3</div>
  </a>
</div>
```

### Expandable Disclosure (Alpine.js)
Keyboard accessible disclosure accordion with rotating chevron, aria-expanded state, and CSS/HTML fallback for No-JS.

```html
<div class="pt-2 border-t border-[var(--border-color)]" x-data="{ expanded: false }">
  <button 
    type="button" 
    @click="expanded = !expanded" 
    :aria-expanded="expanded.toString()"
    class="flex items-center justify-between w-full text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-ink)] py-1"
  >
    <span>Assignment Details &amp; Brief Files</span>
    <span :class="expanded ? 'rotate-180' : ''" class="transition-transform duration-150">
      <%- icon('chevron-down', { class: 'w-3.5 h-3.5' }) %>
    </span>
  </button>
  <div x-show="expanded" x-cloak class="mt-3 pt-3 border-t border-[var(--border-color)] space-y-3 text-xs">
    <!-- Notes and download links -->
  </div>
</div>
```

### Confirm Dialog Modal (Alpine.js)
Focus-trapping confirmation dialog that closes on <kbd>Esc</kbd> or backdrop click, returns focus to trigger, and degrades to standard POST submit without JavaScript.

```html
<div 
  x-show="declineModalOpen" 
  x-cloak
  @keydown.escape.window="closeDeclineModal()"
  class="modal-backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
  <div class="modal-dialog" @click.away="closeDeclineModal()">
    <div class="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
      <h2 id="modal-title" class="type-h4">Decline this request?</h2>
      <button type="button" @click="closeDeclineModal()" aria-label="Close dialog">
        <%- icon('x', { class: 'w-4 h-4' }) %>
      </button>
    </div>
    <p class="py-4 text-xs text-[var(--text-muted)]">The student will see this deal as declined. This cannot be undone.</p>
    <div class="pt-3 border-t border-[var(--border-color)] flex justify-end gap-2">
      <button type="button" @click="closeDeclineModal()" class="btn btn-secondary btn-sm">Cancel</button>
      <form action="/deal/reject/123" method="POST">
        <button type="submit" class="btn btn-danger btn-sm">Decline request</button>
      </form>
    </div>
  </div>
</div>
```

### Notice / Toast Mapping Table
Strict server-side whitelist mapping URL query codes to fixed alert copy:

| Code | Type | Message |
| :--- | :--- | :--- |
| `created` | Success | "Deal created successfully. The writer will review your request." |
| `accepted` | Success | "Deal accepted. You can now work on the assignment and upload the final PDF." |
| `rejected` | Success | "Deal declined." |
| `uploaded` | Success | "Final document uploaded successfully." |
| `invalid_state` | Error | "This deal is no longer in a state that allows that action." |
| `not_found` | Error | "The requested deal could not be found." |
| `forbidden` | Error | "You are not authorized to perform that action on this deal." |
| `upload_size` | Error | "File exceeds the maximum size limit (10MB)." |
| `upload_type` | Error | "Only valid PDF documents are accepted." |
| `upload_missing` | Error | "Please select a PDF document to upload." |
| `upload_failed` | Error | "Failed to upload document. Please try again." |

### Inline Upload Section
Compact inline file uploader for accepted deals inside dashboard cards, featuring client validation, file preview chip, and upload loading spinner.

```html
<form action="/deal/upload-final" method="POST" enctype="multipart/form-data">
  <input type="hidden" name="dealId" value="123">
  <div class="file-dropzone py-3 px-4">
    <input type="file" name="finalPdf" accept="application/pdf,.pdf" required>
  </div>
  <button type="submit" class="btn btn-primary btn-sm">Upload final file</button>
</form>
```

---

## 8. Build & Deployment Commands

- **Local CSS Build**: `npm run build:css`
- **Local CSS Watch**: `npm run dev:css`
- **Local Server**: `npm start` (Runs on `http://localhost:3000`)
- **Render Production Build Command**:
  ```bash
  npm install && npm run build:css
  ```
- **Render Start Command**:
  ```bash
  npm start
  ```

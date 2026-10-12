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
   - Display and section headings use **Source Serif 4** (self-hosted variable woff2 with optical sizing) with deliberate tracking (`-0.02em` to `-0.025em`) and line heights tailored per step.
   - Body copy, forms, badges, and interface data use **Instrument Sans** (self-hosted variable woff2) with generous line-height (`1.5` to `1.6`) and 60-68 character line lengths (`.prose-measure`) for effortless readability.
   - Monospace font is strictly restricted to tiny data details (prices, page counts, dates, and IDs) and is **never** used for section headers or eyebrows.
4. **Restraint & Elevation**:
   - Flat, subtle hairline borders (`var(--border-color)`) and minimal paper shadows are prioritized over harsh digital borders or heavy drop shadows.
   - Motion is subtle, using exclusively `transform` and `opacity` with fixed-size containers to guarantee zero cumulative layout shift (CLS = 0).
   - All animations and transitions respect `prefers-reduced-motion` and degrade gracefully with JavaScript disabled.

---

## 2. Hard Anti-Patterns (Absolute Don'ts)

| Anti-Pattern | Why It Is Forbidden | Paper & Ink Alternative |
| :--- | :--- | :--- |
| **Gradient Text** | Cheap, generic AI aesthetics; hard to read | Solid Ink (`var(--text-ink)`) with serif display font |
| **Glow Blobs / Blur Circles** | Distracting neon template look | Warm paper surface with hairline 1px border cards |
| **Glassmorphism / Heavy Blur** | Accessibility issue; poor contrast | Solid surfaces (`var(--bg-surface)`) with clean borders |
| **Emoji in Interface Elements** | Inconsistent across OS; unprofessional | Inline Lucide SVGs via `<%- icon('name') %>` |
| **Purple-to-Blue Gradients** | Generic SaaS template signature | Single solid accent CTA button (`.btn-primary`) |
| **Mono Bracket Labels (`[01 // ...]`)** | Artificial AI template indexing cliché | Plain numeral small-caps eyebrow with hairline rule (`.section-eyebrow`) |
| **Identical Icon-Tile Card Grids** | Formulaic SaaS card repetition | Asymmetric columns, wide editorial text blocks, and hairline lists |
| **Rainbow Badges / Stat Counters**| Chaotic visual hierarchy | Semantic badges with muted backgrounds and dark text |

---

## 2.5 Brand Motif: "Proofreader's Marks & Editorial Craft" (Replaces Bracket Labels)

**Design Choice & Rationale:**
> *PerPage adopts an authentic editorial proofreader motif rooted in the tangible physical craft of editing: hand-drawn proofreader underlines, caret insertions, strikethroughs, margin notes, and faint ruled margins. All artificial monospace bracket stamps (`[01 // OVERVIEW]`, `[04 // ...]`, `[WR-...]`, etc.) have been completely removed across every template. Section eyebrows now feature small-caps/uppercase sans kickers with a plain numeral and a hairline rule or caret accent (e.g. `01  How it works`).*

### Motif Components:
1. **Section Eyebrow (`.section-eyebrow`)**:
   - Small-caps or uppercase sans text (`.eyebrow-label`) accompanied by a plain numeral (`.eyebrow-num`) and a delicate hairline rule (`.eyebrow-rule`). Replaces all `[01 // ...]` bracket labels.
2. **Hand-Drawn Wavy Underline (`.proof-wavy-hero`)**:
   - Inline SVG wavy path under a single emphasized word in headings (e.g. hero "Improve"). Draws itself once on initial page paint (`stroke-dashoffset`, 600ms, transform/opacity only, zero layout shift).
3. **Proofreader Strikethrough (`.proof-strike`, `.hero-anim-strike`)**:
   - Subtle editor-pen strike through text rendered using the dedicated `--mark` token.
4. **Caret Insertion Mark (`.proof-insert`, `.hero-anim-insert`)**:
   - Caret insertion mark (`^`) paired with underlined correction copy.
5. **Margin Comment Bubble (`.proof-comment-badge`, `.hero-anim-comment`)**:
   - Small margin note badge (`bg-[var(--mark-bg)] text-[var(--mark)]`) modeling an editor's margin feedback.
6. **Ruled Margin Line (`.proof-margin-rule`, `.hero-doc-sheet::before`)**:
   - Faint vertical hairline rule running along the left margin of editorial excerpts, callouts, and paper sheets.

---

## 3. Design Tokens (CSS Variables)

All tokens are defined in `/src/styles/app.css` and compiled via the Tailwind v4 CLI to `/public/css/app.css`:

### Light Mode (Primary Default — "Warm Tactile Paper")
```css
:root {
  /* Fonts */
  --font-serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;
  --font-sans: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Theme Tokens - Light Paper */
  --bg-background: #FAF8F5;         /* Warm off-white paper, not digital white */
  --bg-surface: #FFFFFF;            /* Clean white document sheet */
  --bg-surface-muted: #F3EFE8;      /* Soft parchment wash */
  --text-ink: #141413;              /* Deep editorial ink */
  --text-muted: #5C5B56;            /* Graphite editorial notes (AA contrast 4.9:1) */
  --border-color: #E6E2D8;          /* Hairline sheet border */
  --border-strong: #CFC9BC;         /* Ruled margin border */

  /* Accent Token (Strictly for primary CTA, links, focus rings, active states) */
  --accent: #1F3BB3;                /* Refined deep academic cobalt */
  --accent-hover: #162B85;          /* Deep cobalt hover */
  --accent-foreground: #FFFFFF;     /* Text on accent */
  --accent-subtle: #EEF2FD;         /* Accent wash for active nav */
  --accent-subtle-border: #CCD6F6;  /* Accent badge border */

  /* Editor Pen Token Group (Strictly for proofreader marks, NEVER buttons/links) */
  --mark: #C23B27;                  /* Warm red editor proofing pen */
  --mark-bg: #FDF2F0;               /* Subtle proofing tint */
  --mark-border: #F5C7C1;           /* Proofing margin note border */
  --mark-hover: #A62F1E;

  /* Semantic Status Tokens */
  --semantic-success-bg: #ECFDF5;
  --semantic-success-text: #065F46;
  --semantic-success-border: #A7F3D0;

  --semantic-warning-bg: #FFFBEB;
  --semantic-warning-text: #92400E;
  --semantic-warning-border: #FDE68A;

  --semantic-danger-bg: #FEF2F2;
  --semantic-danger-text: #991B1B;
  --semantic-danger-border: #FECACA;

  --semantic-info-bg: #EFF6FF;
  --semantic-info-text: #1E40AF;
  --semantic-info-border: #BFDBFE;
}
```

### Dark Mode (Secondary — "Obsidian Paper")
```css
.dark {
  /* Theme Tokens - Dark Mode */
  --bg-background: #111215;         /* Deep neutral obsidian, not indigo wash */
  --bg-surface: #17181D;            /* Elevated paper surface */
  --bg-surface-muted: #1F2127;      /* Muted inset surface */
  --text-ink: #EDECE8;              /* Crisp light ink */
  --text-muted: #A8ACB8;            /* High-contrast graphite (AA contrast 5.8:1) */
  --border-color: #262931;          /* Subtle dark hairline border */
  --border-strong: #383C46;         /* Focused dark border */

  /* Accent Token */
  --accent: #5D7AFF;                /* High-contrast dark mode cobalt */
  --accent-hover: #758DFF;          /* Dark mode accent hover */
  --accent-foreground: #0E0F14;     /* Dark button text */
  --accent-subtle: #19203D;         /* Subtle accent wash */
  --accent-subtle-border: #2B3566;  /* Subtle accent border */

  /* Editor Pen Token Group - Dark Mode (Soft Coral) */
  --mark: #E05D4E;                  /* Soft coral editor proofing pen */
  --mark-bg: #2B1816;               /* Dark proofing wash */
  --mark-border: #522722;           /* Dark proofing border */
  --mark-hover: #F07668;

  /* Semantic Status Tokens */
  --semantic-success-bg: #064E3B;
  --semantic-success-text: #A7F3D0;
  --semantic-success-border: #047857;

  --semantic-warning-bg: #451A03;
  --semantic-warning-text: #FDE68A;
  --semantic-warning-border: #78350F;

  --semantic-danger-bg: #450A0A;
  --semantic-danger-text: #FECACA;
  --semantic-danger-border: #7F1D1D;

  --semantic-info-bg: #172554;
  --semantic-info-text: #BFDBFE;
  --semantic-info-border: #1D4ED8;
}
```

---

## 4. Typography Scale

Fonts are self-hosted Latin variable WOFF2 files stored in `/public/fonts/` with `font-display: swap` preloaded in `<head>`:
- **Serif Display & Headings**: `Source Serif 4` (variable weight 200–900, optical sizing)
- **Sans Interface & Body**: `Instrument Sans` (variable weight 400–700)
- **Monospace Restricted Utility**: `ui-monospace, Menlo, Monaco, Consolas` (strictly restricted to prices, counts, and dates)

| Style Class | Font Family | Size (clamp / rem) | Tracking | Line Height | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `.type-display` | Source Serif 4 | `clamp(2.5rem, 5vw, 4rem)` | `-0.02em` | `1.1` | Landing page hero titles |
| `.type-h1` | Source Serif 4 | `clamp(2rem, 3.5vw, 2.75rem)` | `-0.02em` | `1.18` | Page titles (H1) |
| `.type-h2` | Source Serif 4 | `clamp(1.65rem, 2.5vw, 2.15rem)` | `-0.015em` | `1.25` | Section headers |
| `.type-h3` | Instrument Sans (600) | `1.25rem` (20px) | `-0.01em` | `1.35` | Card headings |
| `.type-h4` | Instrument Sans (600) | `1.125rem` (18px) | Normal | `1.4` | Form / block titles |
| `.type-body` | Instrument Sans (400) | `1rem` (16px) | Normal | `1.6` | Standard body paragraphs |
| `.type-small` | Instrument Sans (400) | `0.875rem` (14px) | Normal | `1.5` | Data tables, form hints |
| `.type-caption` | Instrument Sans (400) | `0.75rem` (12px) | `0.02em` | `1.4` | Timestamps, micro labels |
| `.section-eyebrow` | Instrument Sans (600) | `0.75rem` (12px) | `0.08em` | `1.0` | Small-caps / uppercase category kicker |

### Typographic Utilities
- **Prose Measure (`.prose-measure`)**: Caps reading line length at `65ch` (60 to 68 characters) for effortless reading and scannability.
- **Tabular Numerals (`.num-tabular`, `tabular-nums`)**: Sets `font-variant-numeric: tabular-nums lining-nums` for aligned pricing, page counts, statistics, and dates.
- **Monospace Stack**: Reserved exclusively for numbers, rates, and IDs. Never used for section labels or branding.

### Section Rhythm Scale (4px Grid)
- **`.section-tight`**: `py-10 md:py-14` (Compact blocks, metadata panels, micro-sections)
- **`.section-default`**: `py-16 md:py-24` (Standard informational sections)
- **`.section-loose`**: `py-20 md:py-32` (Major hero and closing conversion tiers)


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
- **Height Scale**: `.btn-sm` (32px / `h-8`), `.btn-md` (40px / `h-10`), `.btn-lg` (48px / `h-12`).
- **Tactile Feedback**: Active press state features an ergonomic `scale-[0.98]` micro-transform with smooth `transition-all duration-150`.
- **Focus Rings**: Consistent high-contrast keyboard outline with `focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2`.

```html
<!-- Primary CTA -->
<button class="btn btn-primary btn-md">
  Confirm Order <%- icon('arrow-right', { class: 'w-4 h-4' }) %>
</button>

<!-- Secondary Action -->
<button class="btn btn-secondary btn-md">Cancel</button>

<!-- Outline Action -->
<button class="btn btn-outline btn-md">View details</button>

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

### 3. Cards & Archival Docket Containers
- **Standard Card (`.card`)**: Rounded surface with subtle 1px border (`var(--border-color)`) and muted hover border.
- **Archival Ticket (`.card-ticket`)**: Architectural container featuring monospace header metadata, hairline divider, and distinct content compartment.

```html
<!-- Archival Ticket Card -->
<div class="card-ticket p-6">
  <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-3 mb-4">
    <span class="index-stamp">[01 // METRIC]</span>
    <span class="type-caption text-[var(--text-muted)]">Verified</span>
  </div>
  <h3 class="type-h3">Title</h3>
  <p class="type-body text-[var(--text-muted)] prose-measure">Archival body content.</p>
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

---

## 9. Security Hardening & System Patterns

### 9.1 Unified Error Page System
Error pages (`404`, `403`, `422`, `429`, `500`) share a single, consistent layout template (`views/error.ejs`) rendered inside the standard application shell with the header and footer intact:
- **Visual Design**: Uses the Paper & Ink Empty-State block pattern (`.card.border-dashed`).
- **Typography**: Clean eyebrow status badge (e.g. `404 Not Found`), serif H1 heading (`.type-h1`), and calm, unambiguous explanation paragraph.
- **Action Buttons**:
  - Primary button: "Go home" (`.btn-primary`)
  - Secondary button: "Browse writers" (`.btn-secondary`)
  - Status 500 context button: "Try again" (`.btn-outline`) pointing to the original requested URL.

### 9.2 Safe Authentication & POST Logout
- **Session Termination**: Logout MUST use `POST /logout` to prevent accidental pre-fetching logouts and CSRF attacks.
- **Navbar Implementation**: Both desktop user dropdown and mobile drawer implement logout as a semantic `<form method="post" action="/logout">` containing an unstyled button that inherits the dropdown item typography.
- **Safe Redirection**: All post-login and return-to redirects are validated via `utils/safeRedirect.js` preventing open redirect vulnerabilities (strictly blocking `//`, `/\`, absolute URLs, and control characters).

### 9.3 Asset Versioning & Caching
- **Content-Hash Cache Busting**: The server computes an 8-character MD5 hash of `public/css/app.css` at startup, exposing `res.locals.assetVersion`.
- **Cache-Control**: Static CSS, fonts, and images are served with `maxAge: '7d'`.
- **HTML References**: Core stylesheets are referenced as `/css/app.css?v=<assetVersion>`, guaranteeing instant cache invalidation upon redeployment.

### 9.4 Content Security Policy & Cryptographic Nonces
- **Report-Only Mode**: Helmet is configured with `contentSecurityPolicy: { reportOnly: true }` to avoid breaking third-party OAuth flows or extensions while reporting violations.
- **Per-Request Nonce**: A crypto-random nonce is generated per request (`crypto.randomBytes(16).toString('base64')`) and injected into `res.locals.cspNonce`.
- **Inline Scripts**: Inline scripts (such as the FOUC-prevention theme loader in `views/partials/head.ejs`) include the nonce attribute: `<script nonce="<%= cspNonce %>">`.

### 9.5 Complete Deal Lifecycle Stepper
The deal workflow follows a 4-step linear progression:
1. **Requested (Pending)**: Initial order created by student with attached PDF prompt.
2. **Accepted**: Writer reviews and confirms the assignment.
3. **Delivered**: Writer uploads the deliverable PDF (stored with clean S3 key `finals/<uuid>_<name>.pdf`).
4. **Completed**: Student confirms receipt and satisfaction via the accessible confirmation modal, unlocking the deal's final state and updating writer statistics.

---

## 10. Editorial Landing Page & Motion Patterns (Prompt 8.2)

### 10.1 Hero Tracked Changes Document Sheet (`.hero-doc-sheet`)
An authentic representation of physical editorial work built strictly with semantic HTML and CSS (zero images):
- **Visual Design**: Warm paper document sheet (`var(--bg-surface)`) featuring a ruled red margin line (`rgba(194, 59, 39, 0.15)`), header row (`report-draft.pdf`, 12 pages), neutral sample draft text with 3 deliberate editing errors, an inline margin note bubble (`.proof-comment-badge`), and an upfront calculation summary.
- **Fixed Dimensions**: Fixed container height (`440px`) across all responsive breakpoints ensuring exactly zero Cumulative Layout Shift (CLS = 0).
- **Animation Sequence**: 12-second loop (9 seconds animation + 3 seconds hold) animating only `transform` and `opacity`:
  1. Strikethrough drawn across deliberate errors (`hero-strike-draw` in `--mark`).
  2. Corrections inserted with caret symbol (`hero-insert-reveal` in `--mark`).
  3. Margin comment bubble reveals (`hero-comment-reveal` with "Shorter and clearer").
  4. Status transitions from "Pending" to "Delivered".
- **Accessibility & Controls**:
  - The document preview has `role="img"` with descriptive `aria-label="Sample paragraph showing an editor's tracked changes"`, and internal animated text elements are `aria-hidden="true"`.
  - Accessible controls bar beneath the sheet exposes dedicated `Replay` and `Pause/Play` buttons with high-contrast `:focus-visible` rings.
  - Pauses automatically on pointer hover and on keyboard `:focus-within`.
  - Under `prefers-reduced-motion` or when JavaScript is disabled, the sheet renders statically in the delivered/corrected state.

### 10.2 Scroll-Driven Sticky How-It-Works Pattern
Replaces generic 3-card grids with a dynamic editorial reader layout:
- **Desktop (1024px+)**: Two-column layout. Left column presents a vertical sequence of steps with prominent serif numerals (`01`, `02`, `03`). Right column features a sticky preview sheet that dynamically transitions between step states (Rate selection -> File upload & price -> Delivered status) as steps scroll into viewport.
- **Dynamic State**: Managed via native `IntersectionObserver` with a smooth 200ms transition. Active step is explicitly communicated to screen readers via `aria-current="step"`.
- **Mobile & Fallbacks**: Automatically stacks steps into vertical flow, each accompanied by its own self-contained static vignette. Operates with zero layout shift and 100% visibility when JavaScript is disabled.

### 10.3 Brand Intro Loader & Navigation Progress System
Three hand-written, zero-dependency performance and navigation components:
1. **Brand Intro Loader (`#brand-intro`)**:
   - Renders a full-viewport paper layer (`var(--bg-background)`) displaying the serif "P" brand mark and a self-drawing proofreader underline.
   - Visible for a maximum of 800ms on the first visit per session on the root landing page (`/`).
   - The page content is pre-rendered underneath in the DOM; after 800ms, the loader fades out (`opacity: 0`), disables pointer events (`pointer-events: none`), and is removed from the DOM.
   - **Bypass Conditions**: Automatically suppressed under `prefers-reduced-motion`, when JavaScript is disabled, on subsequent page visits via `sessionStorage.getItem('perpage_intro_seen')`, during automated test execution (`navigator.webdriver === true`), or when the URL contains `?noloader=1`.
2. **Top Navigation Progress Bar (`#nav-progress-bar`)**:
   - A 2px fixed bar (`var(--accent)`) anchored to the top of the viewport (`z-index: 9999`).
   - Initiated on internal navigation clicks and form submissions (ignoring external links, downloads, and `target="_blank"`).
   - Eases smoothly to 80% while awaiting response, and completes instantly to 100% on `pageshow`.
   - Transitions disabled under `prefers-reduced-motion`.
3. **Button Loading Spinners (`.is-loading`)**:
   - Primary and form submission buttons swap in an inline SVG spinner without changing button dimensions.

---

## 11. Deprecation & Removal of Mono Bracket Labels
The monospace bracket label convention (`[01 // OVERVIEW]`, `[02 // FEATURES]`, `[AUTH-01]`, `[WR-6AC9]`) has been permanently deprecated and purged from all views and templates:
- **Replacement**: Clean sans small-caps / uppercase `.section-eyebrow` kickers featuring plain numerals and a subtle hairline rule (e.g. `<div class="section-eyebrow"><span class="eyebrow-num">01</span><span class="eyebrow-rule"></span><span class="eyebrow-label">How it works</span></div>`).
- **Rule**: Templates must not introduce bracketed indexing or artificial `//` separators in user-facing views.



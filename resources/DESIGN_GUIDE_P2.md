# Altitut Design Guide

Consolidated design system for the Altitut web app. Use this when building a new
feature so it matches the existing platform. Values here are reconciled against the
actual shipped code (`tailwind.config.js`, `index.css`, `index.html`), not just the
in-repo `DESIGN_RULES.MD`, which is stale in a few spots (noted below).

Stack: React 19 + Vite, Tailwind CSS 3.4, TypeScript.

---

## 1. Design Tokens (source of truth: tailwind.config.js)

### Brand colors
```
deep-teal      #005A6A   Primary brand color
bright-coral   #FF6B6B   Accent / alert
darker-teal    #00424F   Hover/pressed teal, dark teal surfaces
light-grey     #E9ECEF   Background
dark-grey      #343A40   Primary text
white          #FFFFFF
midnight-gray  #1F2937
slate-gray     #4B5563
light-green    #E6F4EA
vivid-green    #00B86B
```

### Scoreboard / status colors
```
rank-gold        #FFD700
rank-silver      #C0C0C0
rank-bronze      #CD7F32
positive-change  #28A745
negative-change  #DC3545
```

> Discrepancy flag: `DESIGN_RULES.MD` lists `light-grey #F5F7FA` and `dark-grey #2D3748`.
> The actual config uses `#E9ECEF` and `#343A40`. Use the config values above.

### Semantic Tailwind scales
Use standard Tailwind color scales for state:
- Success: `green-50/100/500/600/700`
- Error: `red-50/100/500/600/700`
- Info: `blue-50/100/500/600/700`
- Warning: `amber-50/100/500/600/700`
- Neutral: `gray-50` through `gray-900`

### Usage rules
- Primary action: `bg-teal-600` / `hover:bg-teal-700` (the teal-600 Tailwind ramp is
  used in components; `deep-teal` is the exact brand hex for custom surfaces)
- Secondary action: `border border-gray-300` / `hover:bg-gray-50`
- Danger action: `bg-red-600` / `hover:bg-red-700`
- Success: `bg-green-600` or `text-green-600`
- Page backgrounds: `bg-gray-50` or `bg-light-grey`

---

## 2. Typography

### Fonts (source of truth: index.css)
Two Google Fonts are loaded. This overrides the "system fonts" claim in `DESIGN_RULES.MD`.
```
Inter       weights 500,600,700,800   Primary UI font
Montserrat  weights 600,700,800        Display / luxury tier headings
```

Utility classes for the display font:
- `.tier-luxury-font`   Montserrat, letter-spacing 0.02em
- `.font-tier-bar-heading`   Inter with `ss01` + `cv05` font features

Body has `-webkit-font-smoothing: antialiased` and ligature/contextual-alt features on.

### Sizes
- Headings: `text-2xl` to `text-4xl`, `font-semibold` or `font-bold`
- Body: `text-base` (desktop), `text-sm` (mobile)
- Small: `text-xs` / `text-sm`
- Labels: `text-sm font-medium`

### Text colors
- Primary: `text-gray-900` / `text-dark-grey`
- Secondary: `text-gray-600` / `text-gray-700`
- Disabled: `text-gray-400` / `text-gray-500`
- Link: `text-teal-600` / `hover:text-teal-700`

---

## 3. Spacing

Padding
- Buttons: `px-6 py-3` (lg), `px-4 py-2` (md), `px-3 py-1` (sm)
- Cards: `p-6` or `p-4`
- Inputs: `p-3` (standard), `p-2` (compact)
- Page containers: `p-4 md:p-6 lg:p-8`

Margins
- Section: `mb-8` / `mb-6`
- Element: `mb-4` / `mb-3`
- Inline: `ml-2`, `mr-2`, `gap-2`

---

## 4. Components

### Buttons
```jsx
// Primary
className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors"

// Secondary
className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"

// Danger
className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"

// Icon button
className="p-2 text-teal-600 hover:bg-teal-50 rounded-full transition-colors"

// Disabled
className="bg-gray-400 text-gray-200 px-6 py-3 rounded-lg cursor-not-allowed opacity-50"
```

### Text inputs
```jsx
// Standard input
className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"

// Textarea: same, add rows={3}

// Alternate focus treatment (used in some forms)
className="focus:bg-white focus:ring-1 focus:ring-deep-teal focus:shadow-inner"
```

### Tag inputs
```jsx
<span className="bg-{color}-100 text-{color}-700 px-3 py-1 rounded-full text-sm">
  {tagText}
  <button className="ml-2 text-{color}-500 hover:text-{color}-700">×</button>
</span>
```
Color coding convention:
- Passion/Love: `bg-red-100 text-red-700`
- Expertise/Skills: `bg-blue-100 text-blue-700`
- Mission/World Needs: `bg-green-100 text-green-700`
- Profession/Market: `bg-amber-100 text-amber-700`

Input field: `w-full p-2 border border-gray-300 rounded-lg`, add on Enter, cap at 10 tags.

### Cards & containers
```jsx
// Standard card
className="bg-white rounded-xl shadow-md p-6"

// Hover card
className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"

// Info box
className="bg-blue-50 border border-blue-200 rounded-lg p-3"
```

### Message boxes
```jsx
// Info
<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
  <div className="flex">
    <InformationCircleIcon className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-blue-800">{message}</p>
  </div>
</div>

// Success:  bg-green-50 border border-green-200 rounded-lg p-4 text-green-700
// Error:    bg-red-50   border border-red-200   rounded-lg p-4 text-red-600
```

---

## 5. Page Layout

### Detail / editor page header (clean, no border or shadow)
```jsx
<div className="min-h-screen bg-gray-50">
  <header className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
    <div className="flex items-center mb-6 md:mb-8">
      <button
        onClick={() => navigate('/previous-page')}
        className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors mr-3 md:mr-4"
        aria-label="Go back"
      >
        <ChevronLeftIcon className="w-6 h-6 text-gray-600" />
      </button>
      <div className="flex-1">
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-900">Page Title</h1>
        <p className="text-gray-600 mt-1 text-sm lg:text-base">Optional subtitle</p>
      </div>
      <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        Cancel
      </button>
    </div>
  </header>
  <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
    {/* content */}
  </main>
</div>
```

Header rules for detail/editor pages: no borders or shadows, inline (not sticky),
`max-w-7xl mx-auto`, responsive padding `p-4 md:p-6 lg:p-8`, `mb-6 md:mb-8` below.

### App-shell header (has border + shadow, distinct from detail headers)
```jsx
<header className="bg-white shadow-sm border-b border-gray-200">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{/* ... */}</div>
</header>
```

### Containers
- Max widths: `max-w-7xl` (full), `max-w-3xl` (content), `max-w-md` (narrow)
- Center with `mx-auto`, pad with `px-4 sm:px-6 lg:px-8`

### Grids
```jsx
// Two column
className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8"
// Three column
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
```

---

## 6. Shadows, Effects, Animations

### Custom shadows (tailwind.config.js)
```
shadow-modern      0 10px 25px rgba(0,90,106,0.1), 0 4px 10px rgba(0,90,106,0.05)
shadow-modern-lg   0 20px 40px rgba(0,90,106,0.12), 0 8px 16px rgba(0,90,106,0.08)
shadow-t-md        top-facing shadow, 0 -4px 6px -1px rgb(0 0 0 / 0.1)...
shadow-custom-subtle  0 4px 12px rgba(0,0,0,0.04)
```
Note: brand shadows are tinted with the teal brand color, not neutral black. Prefer
`shadow-modern` / `shadow-modern-lg` for elevated brand surfaces.

### Custom utility classes (index.css)
```
.gradient-text     teal→coral gradient clipped to text
.glass             glassmorphism: translucent white + blur(10px) + subtle border
.shimmer           loading shimmer sweep (1.5s infinite)
.hover-lift        translateY(-2px) + deeper teal shadow on hover
.backdrop-blur-subtle   blur(4px)
.scrollbar-modern  thin teal-on-grey scrollbar
.scrollbar-hide    hides scrollbar cross-browser
.line-clamp-1/2/3  multi-line truncation
```

### Animations / keyframes
```
animate-pulse-gentle   subtle scale+opacity pulse (2s) — also .pulse-gentle
fadeInUp               opacity + translateY(30px→0) entrance
animate-rain           falling/rotating rain effect
shimmer                loading sweep
home-startup-progress  scaleX(0→1) progress bar (6s linear)
```

### Transitions
- `transition-colors` for color changes
- `transition-shadow` for elevation
- `transition-all duration-200` when animating multiple props

---

## 7. Interaction Patterns

Auto-save
```javascript
// Debounced text save (2s after last change)
useEffect(() => {
  const t = setTimeout(() => { if (hasData) saveProgress(); }, 2000);
  return () => clearTimeout(t);
}, [formData]);

// Arrays (tags): near-immediate
setTimeout(() => saveProgress(), 100);

// Text inputs: also save onBlur
```

Required field
```jsx
<label className="block text-sm font-medium text-gray-700 mb-2">
  <span className="text-red-500">*</span> Field Label
</label>
```
Validation states: valid `border-green-500`, invalid `border-red-500`, neutral `border-gray-300`.

Step nav
```jsx
<div className="flex justify-between mt-8">
  <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Previous</button>
  <button className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700">Next</button>
</div>
```

---

## 8. Loading States

```jsx
// Spinner
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>

// Full-screen loader
<div className="min-h-screen bg-gray-50 flex items-center justify-center">
  <div className="text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
    <p className="text-gray-600">Loading...</p>
  </div>
</div>

// Skeleton
className="animate-pulse bg-gray-200 rounded"
// or the .shimmer utility for a sweep effect
```

---

## 9. Responsive

Breakpoints: mobile default (<640), `sm:` 640+, `md:` 768+, `lg:` 1024+, `xl:` 1280+.
Mobile-first: base styles for mobile, add `lg:` overrides.
```jsx
text-sm lg:text-base        // responsive body
text-2xl lg:text-3xl        // responsive heading
p-4 md:p-6 lg:p-8           // progressive padding
flex flex-col lg:flex-row   // stack then row
w-full lg:w-1/2             // full then half
```

---

## 10. Rules to follow when building a new feature

1. Tailwind classes only. Avoid inline styles.
2. Use the exact token values in section 1 (config), not the stale doc hexes.
3. Load/use Inter for UI text; Montserrat only for display/tier headings.
4. Detail/editor headers: clean, no border/shadow, back button + title + optional action.
5. App-shell headers: `shadow-sm border-b`.
6. Brand elevation uses teal-tinted `shadow-modern*`, not plain black shadows.
7. Buttons: teal primary, gray-bordered secondary, red danger. `rounded-lg`, `transition-colors`.
8. Cards: `bg-white rounded-xl shadow-md p-6`; hover cards use `rounded-lg shadow-sm hover:shadow-md`.
9. Forms: teal focus ring, `onBlur` + 2s debounced auto-save, red `*` for required.
10. Mobile-first, `max-w-7xl mx-auto`, `px-4 sm:px-6 lg:px-8` container padding.
11. If you introduce a new pattern, it should read as a natural extension of the above.

---

### Stale bits in the repo's DESIGN_RULES.MD (do not copy these)
- Says fonts are system-only. Actual: Inter + Montserrat via Google Fonts.
- Says `light-grey #F5F7FA` / `dark-grey #2D3748`. Actual: `#E9ECEF` / `#343A40`.
- Omits most brand colors (darker-teal, vivid-green, scoreboard colors) and all the
  `index.css` utilities (glass, gradient-text, hover-lift, shimmer, scrollbar-modern).
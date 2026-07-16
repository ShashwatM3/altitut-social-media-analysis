# DESIGN RULES

This document defines the comprehensive design system and standards for the Altitut web application. All new features, pages, and components must follow these specifications to maintain consistency across the platform.

## Table of Contents
1. [Color Palette](#color-palette)
2. [Typography](#typography)
3. [Spacing System](#spacing-system)
4. [Components](#components)
   - [Buttons](#buttons)
   - [Text Inputs](#text-inputs)
   - [Tag Inputs](#tag-inputs)
   - [Cards & Containers](#cards--containers)
   - [Tooltips & Info Boxes](#tooltips--info-boxes)
5. [Page Layout](#page-layout)
6. [Interaction Patterns](#interaction-patterns)
7. [Loading States](#loading-states)
8. [Responsive Design](#responsive-design)

---

## Color Palette

### Primary Colors
```css
/* Defined in tailwind.config.js */
deep-teal: #005A6A      /* Primary brand color */
bright-coral: #FF6B6B   /* Accent/Alert color */
light-grey: #F5F7FA     /* Background color */
dark-grey: #2D3748      /* Text color */
```

### Semantic Colors (Using Tailwind)
```css
/* Success States */
green-50, green-100, green-500, green-600, green-700

/* Error/Alert States */
red-50, red-100, red-500, red-600, red-700

/* Info States */
blue-50, blue-100, blue-500, blue-600, blue-700

/* Warning States */
amber-50, amber-100, amber-500, amber-600, amber-700

/* Neutral States */
gray-50, gray-100, gray-200, gray-300, gray-400, gray-500, gray-600, gray-700, gray-800, gray-900
```

### Usage Guidelines
- **Primary Actions**: `bg-teal-600` with `hover:bg-teal-700`
- **Secondary Actions**: `border border-gray-300` with `hover:bg-gray-50`
- **Danger Actions**: `bg-red-600` with `hover:bg-red-700`
- **Success Indicators**: `bg-green-600` or `text-green-600`
- **Page Backgrounds**: `bg-light-grey` or `bg-gray-50`

---

## Typography

### Font Stack
System fonts with fallbacks:
```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Text Sizes
- **Headings**: `text-2xl` to `text-4xl` with `font-semibold` or `font-bold`
- **Body Text**: `text-base` (desktop) or `text-sm` (mobile)
- **Small Text**: `text-xs` or `text-sm`
- **Labels**: `text-sm font-medium`

### Text Colors
- **Primary Text**: `text-gray-900` or `text-dark-grey`
- **Secondary Text**: `text-gray-600` or `text-gray-700`
- **Disabled Text**: `text-gray-400` or `text-gray-500`
- **Link Text**: `text-teal-600` with `hover:text-teal-700`

---

## Spacing System

### Padding
- **Buttons**: `px-6 py-3` (large), `px-4 py-2` (medium), `px-3 py-1` (small)
- **Cards**: `p-6` or `p-4`
- **Inputs**: `p-3` (standard), `p-2` (compact)
- **Page Containers**: `p-4 md:p-6 lg:p-8`

### Margins
- **Section Spacing**: `mb-8` or `mb-6`
- **Element Spacing**: `mb-4` or `mb-3`
- **Inline Spacing**: `ml-2`, `mr-2`, `gap-2`

---

## Components

### Buttons

#### Primary Button
```jsx
className="bg-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-teal-700 transition-colors"
```

#### Secondary Button
```jsx
className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
```

#### Danger Button
```jsx
className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
```

#### Icon Button
```jsx
className="p-2 text-teal-600 hover:bg-teal-50 rounded-full transition-colors"
```

#### Disabled State
```jsx
className="bg-gray-400 text-gray-200 px-6 py-3 rounded-lg cursor-not-allowed opacity-50"
```

### Text Inputs

#### Standard Input
```jsx
<input
  type="text"
  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
  placeholder="Enter text..."
/>
```

#### Textarea
```jsx
<textarea
  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
  rows={3}
  placeholder="Enter description..."
/>
```

#### Focus State
```jsx
className="focus:bg-white focus:ring-1 focus:ring-deep-teal focus:shadow-inner"
```

### Tag Inputs

#### Tag Display
```jsx
<span className="bg-{color}-100 text-{color}-700 px-3 py-1 rounded-full text-sm">
  {tagText}
  <button className="ml-2 text-{color}-500 hover:text-{color}-700">×</button>
</span>
```

#### Tag Input Field
```jsx
<input
  type="text"
  className="w-full p-2 border border-gray-300 rounded-lg"
  placeholder="Press Enter to add..."
  onKeyDown={(e) => {
    if (e.key === 'Enter' && e.currentTarget.value && tags.length < 10) {
      // Add tag logic
    }
  }}
/>
```

#### Color Coding
- **Passion/Love**: `bg-red-100 text-red-700`
- **Expertise/Skills**: `bg-blue-100 text-blue-700`
- **Mission/World Needs**: `bg-green-100 text-green-700`
- **Profession/Market**: `bg-amber-100 text-amber-700`

### Cards & Containers

#### Standard Card
```jsx
className="bg-white rounded-xl shadow-md p-6"
```

#### Hover Card
```jsx
className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
```

#### Info Box
```jsx
className="bg-blue-50 border border-blue-200 rounded-lg p-3"
```

### Tooltips & Info Boxes

#### Information Box
```jsx
<div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
  <div className="flex">
    <InformationCircleIcon className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-blue-800">{message}</p>
  </div>
</div>
```

#### Success Message
```jsx
className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700"
```

#### Error Message
```jsx
className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600"
```

---

## Page Layout

### Detail Page Headers

#### Standard Detail Header (for creation/editing screens)
```jsx
<div className="min-h-screen bg-gray-50">
  {/* Simple inline header - no border or shadow */}
  <header className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
    <div className="flex items-center mb-6 md:mb-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/previous-page')}
        className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors mr-3 md:mr-4"
        aria-label="Go back"
      >
        <ChevronLeftIcon className="w-6 h-6 text-gray-600" />
      </button>

      {/* Page Title and Subtitle */}
      <div className="flex-1">
        <h1 className="text-2xl lg:text-3xl font-semibold text-gray-900">
          Page Title
        </h1>
        <p className="text-gray-600 mt-1 text-sm lg:text-base">
          Optional subtitle or description
        </p>
      </div>

      {/* Optional Action Button */}
      <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        Cancel
      </button>
    </div>
  </header>

  {/* Main Content */}
  <main className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
    {/* Content here */}
  </main>
</div>
```

#### Back Button Specifications
- **Default**: `p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors`
- **Icon**: ChevronLeftIcon with `w-6 h-6 text-gray-600`
- **Spacing**: `mr-3 md:mr-4` for separation from title
- **Aria Label**: Always include for accessibility

#### Header Typography
- **Title**: `text-2xl lg:text-3xl font-semibold text-gray-900`
- **Subtitle**: `text-gray-600 mt-1 text-sm lg:text-base`
- **Single Line**: Keep title and subtitle on separate lines for clarity

#### Header Layout Rules
1. **No borders or shadows** for detail page headers (keep it clean)
2. **Inline header** - part of the page flow, not sticky
3. **Consistent max-width** - Use `max-w-7xl mx-auto` for alignment
4. **Responsive padding** - `p-4 md:p-6 lg:p-8`
5. **Bottom margin** - `mb-6 md:mb-8` for separation from content

### Container Structure
```jsx
<div className="min-h-screen bg-gray-50">
  <header className="bg-white shadow-sm border-b border-gray-200">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header content */}
    </div>
  </header>

  <main className="flex-1 max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
    {/* Main content */}
  </main>
</div>
```

### Section Containers
- **Max Width**: `max-w-7xl` (full width), `max-w-3xl` (content), `max-w-md` (narrow)
- **Centering**: `mx-auto`
- **Padding**: `px-4 sm:px-6 lg:px-8`

### Grid Layouts
```jsx
/* Two Column */
className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8"

/* Three Column */
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
```

---

## Interaction Patterns

### Auto-Save Behavior

#### Debounced Save (2 seconds)
```javascript
useEffect(() => {
  const saveTimeout = setTimeout(() => {
    if (hasData) {
      saveProgress();
    }
  }, 2000); // Save after 2 seconds of inactivity

  return () => clearTimeout(saveTimeout);
}, [formData]);
```

#### Immediate Save for Arrays
```javascript
// For tag additions/removals
setTimeout(() => saveProgress(), 100);
```

#### Text Input Save
```javascript
onBlur={() => {
  // Save on blur for text inputs
  saveProgress();
}}
```

### Form Validation

#### Required Field Indicator
```jsx
<label className="block text-sm font-medium text-gray-700 mb-2">
  <span className="text-red-500">*</span> Required Field Label
</label>
```

#### Validation States
- **Valid**: `border-green-500 text-green-600`
- **Invalid**: `border-red-500 text-red-600`
- **Neutral**: `border-gray-300 text-gray-600`

### Navigation Patterns

#### Step Navigation
```jsx
<div className="flex justify-between mt-8">
  <button
    onClick={handlePreviousStep}
    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
  >
    Previous
  </button>
  <button
    onClick={handleNextStep}
    className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700"
  >
    Next
  </button>
</div>
```

---

## Loading States

### Spinner
```jsx
<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
```

### Loading Screen
```jsx
<div className="min-h-screen bg-gray-50 flex items-center justify-center">
  <div className="text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
    <p className="text-gray-600">Loading...</p>
  </div>
</div>
```

### Skeleton Loading
```jsx
className="animate-pulse bg-gray-200 rounded"
```

---

## Responsive Design

### Breakpoints
- **Mobile**: Default (< 640px)
- **Tablet**: `sm:` (640px+), `md:` (768px+)
- **Desktop**: `lg:` (1024px+), `xl:` (1280px+)

### Responsive Text
```jsx
className="text-sm lg:text-base"  // Small on mobile, base on desktop
className="text-2xl lg:text-3xl"  // Responsive headings
```

### Responsive Spacing
```jsx
className="p-4 md:p-6 lg:p-8"     // Progressive padding
className="mb-4 lg:mb-6"          // Progressive margins
```

### Mobile-First Approach
Always design for mobile first, then add responsive classes:
```jsx
className="w-full lg:w-1/2"       // Full width mobile, half on desktop
className="flex flex-col lg:flex-row"  // Stack on mobile, row on desktop
```

---

## Shadows & Effects

### Shadow Classes
```css
/* Custom shadows from tailwind.config.js */
shadow-modern: 0 10px 25px rgba(0, 90, 106, 0.1), 0 4px 10px rgba(0, 90, 106, 0.05)
shadow-modern-lg: 0 20px 40px rgba(0, 90, 106, 0.12), 0 8px 16px rgba(0, 90, 106, 0.08)

/* Standard Tailwind shadows */
shadow-sm, shadow-md, shadow-lg, shadow-xl
```

### Transitions
```jsx
className="transition-colors"          // Color transitions
className="transition-shadow"          // Shadow transitions
className="transition-all duration-200" // All properties with duration
```

### Animations
```jsx
className="animate-pulse"              // Pulsing effect
className="animate-spin"               // Spinning effect
className="animate-pulse-gentle"       // Custom gentle pulse
```

---

## Best Practices

### Consistency Rules
1. **Always use Tailwind classes** - Avoid inline styles
2. **Follow color semantics** - Use appropriate colors for states
3. **Maintain spacing rhythm** - Use consistent spacing multiples
4. **Mobile-first design** - Start with mobile, add desktop overrides
5. **Accessible contrasts** - Ensure text is readable on backgrounds

### Component Guidelines
1. **Reuse existing patterns** - Check this document before creating new styles
2. **Keep it simple** - Avoid overly complex class combinations
3. **Document variations** - If creating new patterns, update this document
4. **Test responsiveness** - Check all breakpoints
5. **Consider dark mode** - Use colors that work in both themes

### Performance Considerations
1. **Lazy load images** - Use loading="lazy" attribute
2. **Optimize animations** - Use transform and opacity for animations
3. **Minimize reflows** - Batch DOM updates
4. **Use semantic HTML** - Proper elements improve accessibility

---

## Implementation Examples

### Complete Form Section
```jsx
<div className="max-w-3xl mx-auto">
  <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
    {/* Required Field */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <span className="text-red-500">*</span> Your Name
      </label>
      <input
        type="text"
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
        placeholder="Enter your name..."
        onChange={(e) => setName(e.target.value)}
        onBlur={() => saveProgress()}
      />
    </div>

    {/* Tag Input */}
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Skills (Max 10)
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        {skills.map((skill, index) => (
          <span key={index} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
            {skill}
            <button
              onClick={() => removeSkill(index)}
              className="ml-2 text-blue-500 hover:text-blue-700"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        className="w-full p-2 border border-gray-300 rounded-lg"
        placeholder="Press Enter to add skill..."
        onKeyDown={handleAddSkill}
      />
    </div>

    {/* Action Buttons */}
    <div className="flex justify-between mt-8">
      <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
        Back
      </button>
      <button className="bg-teal-600 text-white px-6 py-2 rounded-lg hover:bg-teal-700">
        Continue
      </button>
    </div>
  </div>
</div>
```

---

This document should be referenced when creating new features or modifying existing ones to ensure design consistency across the Altitut platform.
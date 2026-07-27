---
name: Askora
description: Private-by-default questions presented with an editorial purple-on-paper voice.
colors:
  background: "oklch(0.955 0.018 295)"
  foreground: "oklch(0.17 0.035 292)"
  card: "oklch(0.99 0.006 295)"
  primary: "oklch(0.36 0.12 296)"
  primary-foreground: "oklch(0.99 0.004 300)"
  secondary: "oklch(0.94 0.022 295)"
  muted-foreground: "oklch(0.42 0.035 286)"
  accent: "oklch(0.68 0.17 302)"
  destructive: "oklch(0.55 0.22 25)"
  border: "oklch(0.86 0.026 295)"
  ring: "oklch(0.62 0.14 300)"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, Cambria, Times New Roman, serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "Playfair Display, Georgia, Cambria, Times New Roman, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  sm: "0.25rem"
  md: "0.375rem"
  control: "0.75rem"
  card: "1.5rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.pill}"
    padding: "0.5rem 1rem"
    height: "2.5rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.card}"
    padding: "{spacing.xl}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.75rem"
    height: "2.5rem"
  navigation:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    padding: "0.375rem"
---

# Design System: Askora

## Overview

**Creative North Star: "The Private Editorial Desk"**

Askora should feel like a considered publication that happens to be
interactive. Paper-like surfaces, editorial questions, generous answer
leading, and restrained purple controls make privacy feel calm rather than
secretive. Familiar social-post structure is welcome when it improves
comprehension, but Askora keeps its own color, type, and voice.

The interface is deliberate and medium-density. Identity is legible when it is
public and completely neutral when it is anonymous. It rejects childish
anonymous-message aesthetics, direct copies of Facebook, generic SaaS chrome,
engagement pressure, and decorative motion.

**Key Characteristics:**

- Editorial questions paired with highly readable answers
- Privacy and attribution communicated in plain language
- Purple-on-paper surfaces with compact, familiar action hierarchy
- Responsive controls that keep full accessible names at every width

## Colors

The palette is a cool, softly violet paper system with one deep editorial
purple voice and semantic colors reserved for feedback.

### Primary

- **Editorial Purple** (`--primary`): primary actions, selected navigation,
  linked emphasis, and the strongest content hierarchy.
- **Violet Signal** (`--accent`): notifications and rare highlights; it does
  not compete with primary actions.

### Neutral

- **Violet Paper** (`--background`): the page ground.
- **Clean Sheet** (`--card`): cards, dialogs, inputs, and raised navigation.
- **Ink** (`--foreground`): primary text.
- **Quiet Ink** (`--muted-foreground`): metadata and supporting copy.
- **Hairline Violet** (`--border`): structural borders and dividers.

### Named Rules

**The One Voice Rule.** Editorial Purple is the only everyday accent. Semantic
red, green, and amber appear only for destructive, success, and warning states.

**The Token Rule.** Components consume the CSS custom properties in
`app/app.css`; they do not hard-code replacement color values.

## Typography

**Display Font:** Playfair Display (with Georgia and system serif fallbacks)

**Body Font:** Plus Jakarta Sans (with system sans-serif fallbacks)

**Label/Mono Font:** JetBrains Mono (with system monospace fallbacks)

**Character:** Playfair gives questions and editorial headings a human,
considered voice. Jakarta keeps controls and answers direct; JetBrains Mono
separates handles, dates, and counts without turning the product into a
developer tool.

### Hierarchy

- **Display** (800, 2.25rem, 1.15): page and profile headings.
- **Headline** (700, 1.875rem, 1.2): modal and workflow titles.
- **Title** (700, 1.5rem, 1.25): question text and card headings.
- **Body** (400, 1rem, 1.75): answers and explanatory content, normally kept
  within a comfortable 65–75 character measure.
- **Label** (600, 0.75rem, 1.5): handles, timestamps, counts, and compact
  metadata; uppercase only for short category labels.

### Named Rules

**The Question Voice Rule.** Public question wording uses the serif face,
usually bold italic. Answer bodies stay in the sans face with generous leading.

## Elevation

Askora uses a restrained hybrid of borders, tonal layering, and ambient
shadows. Cards are legible without shadow; shadows communicate a floating
surface such as navigation, a dialog, or a hoverable content card.

### Shadow Vocabulary

- **Card** (`var(--shadow-card)`): default content cards.
- **Card hover** (`var(--shadow-card-hover)`): dialogs and interactive raised
  states.
- **Floating navigation** (`var(--shadow-navbar)`): the persistent pill nav.

### Named Rules

**The Border-Before-Shadow Rule.** A one-pixel token border establishes every
surface first. Shadow supports hierarchy; it never replaces structure.

## Components

### Buttons

- **Shape:** fully rounded pill.
- **Primary:** Editorial Purple with high-contrast foreground and 40–44px
  height.
- **Hover / Focus:** subtle one-pixel lift, calibrated ambient glow, and a
  three-pixel token focus ring. Reduced-motion mode removes transforms.
- **Outline / Ghost:** quiet neutral surfaces for secondary and tertiary
  actions. Destructive actions always retain text or an explicit label.

### Chips

- **Style:** compact pill, token border, secondary surface, mono or bold sans
  label.
- **State:** selected chips use Primary; status chips pair color with text and
  never depend on color alone.

### Cards / Containers

- **Corner Style:** `rounded-3xl` (1.5rem).
- **Background:** `bg-card` over `bg-background`.
- **Shadow Strategy:** card shadow at rest; stronger shadow only for a floating
  or interactive state.
- **Border:** solid outer border, dashed internal section dividers.
- **Internal Padding:** 1.5rem by default, up to 2rem on wide layouts.

Content cards follow identity → question/answer → actions. Attributed avatars
and names link to the profile. Anonymous avatars are neutral and never hint at
the hidden account. The edited-question badge sits beside edited public
wording.

### Inputs / Fields

- **Style:** 0.75rem radius, card background, input-colored one-pixel border.
- **Focus:** ring plus border shift; placeholder text is never the only label.
- **Error / Disabled:** semantic border and referenced error text; disabled
  controls remain readable and cannot receive pointer actions.

### Navigation

The floating pill nav uses Lucide icons and typed destinations. Desktop shows
icon plus label. Mobile keeps the icons visible, visually hides the labels,
and preserves each accessible name. Targets are at least 44px on mobile. The
navigation remains mounted across top-level app routes so its active indicator
moves continuously, including when entering or leaving the profile route.

### Switches

Radix switches represent binary settings and the anonymous/profile choice.
Checked means anonymous where identity is being selected. The visible adjacent
label changes between “Anonymous” and “Your profile,” while a hidden input
serializes the existing form value.

### Thread Dialog

The thread popup is a compact, centered social card with an explicit 44px close
button, internal scrolling, viewport-safe mobile insets, and inline follow-up
composition. Overlay click and Escape remain supported. Direct links and
no-JavaScript visits keep the full-page route.

## Do's and Don'ts

### Do:

- **Do** preserve identity → content → actions on every Q&A card.
- **Do** use `--primary`, `--card`, and the other semantic tokens from
  `app/app.css`.
- **Do** keep mobile targets at least 44px and all focus rings visible.
- **Do** keep anonymous sender data absent from rendered and accessible output.
- **Do** mark owner-edited public question wording with “Edited question.”
- **Do** honor `prefers-reduced-motion` for every transition or animation.

### Don't:

- **Don't** use childish anonymous-message aesthetics.
- **Don't** make Askora a direct copy of Facebook; borrow hierarchy, not brand.
- **Don't** introduce generic SaaS chrome, algorithmic engagement pressure, or
  discovery-first patterns.
- **Don't** hard-code colors in feature components.
- **Don't** hide the only dialog dismissal behind overlay click or Escape.
- **Don't** use “item” where the domain term is “answer” or “question.”

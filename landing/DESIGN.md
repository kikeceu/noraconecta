---
name: NORA Conecta
colors:
  surface: '#101413'
  surface-dim: '#101413'
  surface-bright: '#363a39'
  surface-container-lowest: '#0b0f0e'
  surface-container-low: '#181c1b'
  surface-container: '#1c201f'
  surface-container-high: '#272b2a'
  surface-container-highest: '#313635'
  on-surface: '#e0e3e1'
  on-surface-variant: '#bec9c1'
  inverse-surface: '#e0e3e1'
  inverse-on-surface: '#2d3130'
  outline: '#88938c'
  outline-variant: '#3f4943'
  surface-tint: '#83d7b1'
  primary: '#83d7b1'
  on-primary: '#003826'
  primary-container: '#0b6e4f'
  on-primary-container: '#98edc6'
  inverse-primary: '#056c4d'
  secondary: '#b4ccc1'
  on-secondary: '#20342d'
  secondary-container: '#384d45'
  on-secondary-container: '#a6beb3'
  tertiary: '#ffb3af'
  on-tertiary: '#5a1a1a'
  tertiary-container: '#974946'
  on-tertiary-container: '#ffd1ce'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9ff4cc'
  primary-fixed-dim: '#83d7b1'
  on-primary-fixed: '#002115'
  on-primary-fixed-variant: '#005139'
  secondary-fixed: '#d0e8dc'
  secondary-fixed-dim: '#b4ccc1'
  on-secondary-fixed: '#0a1f18'
  on-secondary-fixed-variant: '#364b43'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#3d0508'
  on-tertiary-fixed-variant: '#77302e'
  background: '#101413'
  on-background: '#e0e3e1'
  surface-variant: '#313635'
typography:
  display-hero:
    fontFamily: DM Sans
    fontSize: 80px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: DM Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: DM Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: DM Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
  headline-md:
    fontFamily: DM Sans
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: DM Sans
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-bold:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 24px
  section-padding: 120px
  stack-gap: 16px
---

## Brand & Style

This design system is built on a "Dark Organic Minimalism" philosophy. It balances the high-impact urgency of a modern marketplace with the intimate, familiar atmosphere of a WhatsApp conversation. The aesthetic avoids corporate sterility in favor of a friendly, direct tone that feels approachable yet professional.

The style leverages **Minimalism** with a touch of **High-Contrast** elements. By utilizing deep, dark backgrounds paired with a vibrant signature green, the UI creates a focused environment where the content—specifically service cards and mockups—takes center stage. Breathing room is the primary tool for luxury and clarity, ensuring the user is never overwhelmed by the breadth of the marketplace.

## Colors

The palette is anchored by **NORA Green (#0B6E4F)**, used strategically for primary actions and brand identifiers. 

- **Primary Backgrounds:** A range of deep greens and blacks. The hero and high-impact sections use `#0A1F18`, while the deepest canvases use `#050D0A`.
- **Surface Neutrals:** For cards and information containers, use the dark backgrounds with subtle border definitions rather than lighter shades to maintain the "dark mode" impact.
- **Typography Colors:** Primary headers and body text should utilize the neutral `#F4F7F5` to ensure high legibility against the dark void.
- **Accents:** A secondary, brighter WhatsApp-inspired green (`#25D366`) can be used sparingly for status indicators or small UI details to reinforce the platform's utility.

## Typography

DM Sans is used exclusively to maintain a clean, geometric, and modern aesthetic. 

The typographic hierarchy is defined by extreme contrast in scale. Large "Display" roles are meant to dominate the viewport, creating a sense of authority and impact. Body text remains generous in line height to ensure maximum readability, avoiding the cramped feel of typical service directories. Labels are often set in all-caps with slight letter-spacing to distinguish them from narrative text.

## Layout & Spacing

This design system uses a **Fixed Grid** model for large screens, transitioning to a fluid model for mobile devices. 

- **Desktop:** 12-column grid with a 1280px max-width. Use massive 120px vertical padding between sections to create the "spacious" feel requested.
- **Mobile:** 4-column grid with 24px side margins.
- **Rhythm:** Spacing follows a base-8 scale (8, 16, 24, 32, 48, 64, 80, 120). 

Content should be centered with generous gutters to allow the dark background to "frame" the active components.

## Elevation & Depth

To maintain a minimalist profile, depth is communicated through **Tonal Layers** and **Low-contrast Outlines** rather than heavy drop shadows.

- **Primary Cards:** Use a slightly lighter surface color (e.g., `#142B23`) with a 1px solid border in `#1B3B30`.
- **Soft Depth:** When a shadow is necessary for interactivity (like a hovering card), use a large-radius, low-opacity green-tinted shadow: `0px 20px 40px rgba(0, 0, 0, 0.4)`.
- **The "Glass" Effect:** For WhatsApp mockups or floating notifications, use a backdrop blur (12px) with 10% white opacity to simulate a premium, translucent overlay that pops against the dark background.

## Shapes

The shape language is consistently **Rounded**, providing a "friendly" and "non-corporate" feel that mirrors the UI of modern mobile apps. 

- **Standard Elements:** 0.5rem (8px) corner radius for most cards and input fields.
- **Interactive Elements:** 1rem (16px) for buttons and prominent feature cards to make them feel more tactile and inviting.
- **Mockups:** Phone frames and chat bubbles should follow their native platform's corner radii (typically highly rounded) to ensure authenticity.

## Components

### Buttons
- **Primary:** Filled NORA Green (`#0B6E4F`) with white or neutral-light text. Bold weight. Rounded-lg (16px).
- **Secondary:** Outlined with a 2px stroke in NORA Green or Neutral-Light. Transparent background.
- **Hover States:** Primary buttons should shift slightly brighter; secondary buttons should gain a subtle semi-transparent background fill.

### Cards
- Generous internal padding (32px or 40px).
- Borders are preferred over shadows to keep the design "clean."
- Card headers should use `headline-md` for clarity.

### WhatsApp Mockups
- Custom-built SVGs or clean CSS layouts that mimic the WhatsApp interface.
- Use the brand primary green for the chat bubbles of the "service provider" to tie the marketplace identity to the conversation.

### Icons
- 24px line icons with a 1.5px or 2px stroke width.
- Color: Always NORA Green or a muted variation. Never use multi-colored icons or stock imagery.

### Input Fields
- Dark backgrounds with a subtle border. 
- Focus state: Border color changes to NORA Green with a soft outer glow.
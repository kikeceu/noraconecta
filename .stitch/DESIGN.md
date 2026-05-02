# Design System: NORA Simulator

## 1. Visual Theme & Atmosphere

A dense-yet-breathable developer console aesthetic. The atmosphere is clinical and precise — like a high-end terminal emulator crossed with a Linear project view. Dark mode only. Confident asymmetric layout with a single vertical workspace column anchored left. No sidebar chrome. No decorative flourishes.

**Density:** 6/10 — Balanced. Enough information density for productive debugging without feeling cramped.  
**Variance:** 4/10 — Subtle asymmetry. Message bubbles follow natural chat alignment. Controls are meticulously aligned but content flows organically.  
**Motion:** 4/10 — Restrained spring physics. No cinematic sequences. Perpetual micro-interactions only on active indicators (pulse dot on session status). Staggered message entry.

The reference is Linear's issue detail view, Raycast's command palette density, and Vercel's deployment log — a tool that feels fast, native, and distraction-free.

## 2. Color Palette & Roles

- **Bedrock Black** (#09090B) — Root background. Deepest layer. Never used for text.
- **Surface Charcoal** (#141416) — Primary workspace panel. The chat container background.
- **Elevated Slate** (#1C1C1F) — Message bubbles (NORA side), input bar, header bar.
- **Hover Ash** (#252529) — Subtle hover states on interactive elements.
- **Border Graphite** (rgba(255,255,255,0.06)) — Structural separators. Whisper-thin. Never opaque.
- **Steel Primary** (#ECEDEE) — Primary text. High-contrast against dark surfaces.
- **Muted Zinc** (#A1A1AA) — Secondary text, timestamps, metadata, placeholder copy.
- **Faded Iron** (#71717A) — Tertiary text, disabled states, empty state icons.
- **Emerald Signal** (#10B981) — Singular accent. User message bubbles, primary CTAs, active states, focus rings, session dot, send button. Saturation at 72%.
- **Emerald Depth** (#059669) — Accent hover/press states. Darker variant for active feedback.
- **Amber Pulse** (#F59E0B) — Warning/alert states only. Used sparingly for blocked-user indicators or error badges.
- **Ruby Alert** (#EF4444) — Error states, destructive actions, blocked status. Saturation at 65%.

**Banned:** Pure black (#000000), neon greens, AI purple/blue glows, gradient accents, warm-cool gray mixing.

## 3. Typography Rules

- **Display/Headlines:** Geist — Medium weight (500) for titles. Track-tight (-0.02em). Scale: 1.25rem for panel headers, 0.875rem for section labels. Hierarchy through weight and color contrast, never size alone.
- **Body:** Geist — Regular weight (400) for message text, content, descriptions. 0.9375rem base. Line-height 1.6. Max 65 characters per bubble.
- **Mono:** Geist Mono — For phone numbers, timestamps, session IDs, status codes, flow step labels. Track-normal. 0.8125rem.
- **Banned:** Inter, system fonts, generic serif fonts. No mixed font families within a single view.

## 4. Component Stylings

### Message Bubbles
- **User Messages (Right):** Emerald Signal (#10B981) fill. White text (#FFFFFF). Rounded corners 20px with bottom-right corner 6px (asymmetric bubble tail). Max-width 70% of container. Right-aligned within chat column.
- **NORA Messages (Left):** Elevated Slate (#1C1C1F) fill. Steel Primary (#ECEDEE) text. Rounded corners 20px with bottom-left corner 6px. Max-width 70%. Left-aligned.
- **Timestamps:** Geist Mono. 0.6875rem. Muted Zinc (#A1A1AA). Below each bubble. No bubble grouping — every message gets its own timestamp.
- **No bubble tails or triangles.** Asymmetric radii only.

### Header Bar
- Surface Charcoal (#141416) background. 52px height. No border-bottom — uses Border Graphite shadow inset as separator.
- Three-zone layout: Title (left, Geist Medium 1rem), Phone Selector (center, dropdown), Session Status (right, pill badge).
- Status pill: Elevated Slate fill, Border Graphite stroke. Emerald Signal dot (6px, pulsing via opacity loop). Geist Mono 0.75rem text for flow:step.

### Phone Selector Dropdown
- Elevated Slate (#1C1C1F) fill. Border Graphite stroke. 8px radius.
- Geist 0.875rem text. Chevron icon in Muted Zinc.
- Open state: Surface Charcoal dropdown panel with 8px radius. Option items with Hover Ash on hover.
- Label "Simular como:" in Faded Iron, 0.75rem, Geist Mono, above the dropdown.

### Input Bar
- Surface Charcoal (#141416) background. 56px height. Border Graphite top separator.
- Text input: Elevated Slate (#1C1C1F) fill, 12px radius. Geist 0.9375rem. Placeholder in Faded Iron.
- Icon buttons (Image, Audio): 36px square. Muted Zinc icons. Hover Ash on hover. No text labels — icons only.
- Send button: 36px circle. Emerald Signal fill when input has content, Faded Iron when empty. White arrow icon. Spring scale on press (0.96x).

### Empty State
- Centered in chat column. Composed composition: a 48px Geist Mono monochrome chat icon in Faded Iron (#71717A), a headline in Steel Primary, a description in Muted Zinc. No generic "empty folder" illustrations.
- Typography: "No messages yet" (Geist Medium, 1rem, Steel Primary) + "Select a phone number and start typing to simulate a conversation" (Geist Regular, 0.875rem, Muted Zinc).

### Loading / Typing Indicator
- Left-aligned. Elevated Slate (#1C1C1F) bubble containing three 6px dots in Emerald Signal (#10B981). Perpetual bounce animation with staggered 150ms delays.
- Below bubble: "Processing..." label in Geist Mono 0.75rem, Muted Zinc.
- Input bar: fully disabled. All controls in Faded Iron. Placeholder reads "NORA is typing...".

### Primary Button
- Emerald Signal (#10B981) fill. 12px radius. Geist Medium 0.875rem, white text.
- Hover: Emerald Depth (#059669).
- Active: translateY(1px) — tactile press. No outer glow. No ring expansion.
- Focus: 2px Emerald Signal ring at 40% opacity, offset 2px.

### Ghost Button
- Transparent fill. Border Graphite stroke. Steel Primary text.
- Hover: Hover Ash (#252529) fill.

## 5. Layout Principles

- **Single workspace column.** No sidebars. No left nav. No inspector panels. The chat is the entire interface.
- **Max-width containment:** 720px center column. Auto margins left and right (centered with Bedrock Black gutters).
- **Full viewport height:** `100dvh`. Header fixed top, input bar fixed bottom. Message area fills remaining space with overflow-y scroll.
- **Spacing:** 20px horizontal padding inside chat column. 16px vertical gap between message bubbles. 12px between bubble and timestamp.
- **Grid system:** CSS Grid for the three-zone header (1fr auto 1fr). Flexbox for message list and input row. No `calc()` hacks.
- **Mobile (< 768px):** Full-width container (no 720px cap). Chat column absorbs full viewport. Header compresses to single row. No sidebar anywhere.

## 6. Motion & Interaction

- **Spring Physics:** `stiffness: 120, damping: 18` for all interactive transitions (button presses, hover states, dropdown open). No linear or ease-in-out easing anywhere.
- **Message Entry:** New bubbles animate in via `translateY(12px)` + `opacity: 0` to natural position with 250ms spring. Cascade staggered by message index.
- **Session Status Dot:** Perpetual pulse — opacity oscillates between 1.0 and 0.4 over 2s infinite loop. Sinusoidal easing. Only active element with infinite animation.
- **Typing Dots:** Three dots in staggered bounce. Each dot delayed by 150ms. Bounce height: 4px. Duration: 600ms per dot cycle.
- **Hardware Acceleration:** All animations use `transform` and `opacity` exclusively. Never animate `width`, `height`, `top`, `left`, or any layout-inducing property.
- **Grain Overlay:** Subtle 0.5% opacity noise filter on a fixed pseudo-element over Bedrock Black areas. CSS `filter: url(#noise)` or SVG feTurbulence. Non-interactive, pure atmosphere.

## 7. Anti-Patterns (Banned)

- **No emojis** anywhere in the interface — not in messages, not in status, not in labels.
- **No Inter font.** Geist only.
- **No generic serif fonts** (Times, Georgia, Garamond, Palatino).
- **No pure black** (#000000). Use Bedrock Black (#09090B).
- **No neon/outer glow shadows.** No box-shadow with spread > 0 on accent colors.
- **No oversaturated accents** (>80% saturation). Emerald Signal is capped at 72%.
- **No gradient text** on headers or any UI element.
- **No custom mouse cursors.**
- **No overlapping elements.** Every element occupies its own clean spatial zone.
- **No 3-column equal card layouts.**
- **No generic placeholder names** ("John Doe", "Acme Corp", "Test User"). Use Argentine names: "Juan Pérez", "María Gómez", "Carlos López".
- **No fake metrics** ("99.98% uptime", "124ms response", "18.5k requests"). This is a simulator, not a monitoring dashboard.
- **No AI copywriting clichés** ("Elevate", "Seamless", "Unleash", "Next-Gen", "Revolutionize").
- **No filler UI text:** "Scroll to explore", "Swipe down", scroll arrows, bouncing chevrons.
- **No broken Unsplash links.** No stock photography. Icons only.
- **No green-on-green gradients.** The accent is solid Emerald Signal.
- **No WhatsApp background tile pattern.** Solid Bedrock Black or Surface Charcoal only.
- **No sidebars, inspector panels, or auxiliary columns.** Single column workspace.

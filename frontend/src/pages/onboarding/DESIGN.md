# Design System: NORA Professional Onboarding

## Configuration — Set Your Style

| Dial | Level | Description |
|------|-------|-------------|
| **Creativity** | `6` | Structured flow with personality. Professional but not sterile. Brand presence through typography and accent color, not decoration. |
| **Density** | `5` | Balanced. Enough breathing room for touch-friendly form fields on 375px mobile, but compact enough for progress visibility. |
| **Variance** | `3` | Predictable, linear flow. Each step has consistent layout, spacing, and positioning. The user should always know where they are and what to do next. |
| **Motion Intent** | `5` | Subtle step transitions, upload progress feedback, completion animations. Spring physics on step slides and progress bar. |

---

## 1. Visual Theme & Atmosphere

A focused, mobile-first (375px) verification flow that instills trust through restraint. The atmosphere is "secure simplicity" — like completing a sensitive document in a well-lit, professional office. Clean surfaces, deliberate spacing, and an always-visible progress bar prevent abandonment.

The primary emotion: confidence that their data is handled professionally and the process is legitimate.

- **Standalone page:** No system header, no navigation, no footer. The onboarding is the entire page.
- **Linear flow:** 8 steps in fixed sequence. No skipping around.
- **Progress always visible:** 4px top bar with step indicator and step count label.

## 2. Color Palette & Roles

- **Canvas Base** (#F9FAFB) — Page background. Warm-neutral, minimal eye strain on mobile.
- **Pure Surface** (#FFFFFF) — Card and input backgrounds. Clean contrast against canvas.
- **Ink Primary** (#111827) — Primary text. Near-black for maximum legibility at small sizes.
- **Steel Secondary** (#6B7280) — Body text, descriptions, helper text, placeholder values.
- **Muted Tertiary** (#9CA3AF) — Timestamps, "optional" badges, disabled states.
- **NORA Green** (#0B6E4F) — Sole accent. Progress bar fill, primary CTA, focus rings, success checkmarks, upload-complete border.
- **NORA Green Light** (#ECFDF5) — Success backgrounds, upload-complete backgrounds.
- **Whisper Border** (#E5E7EB) — Input borders, card dividers, upload zone dashed border.
- **Error Red** (#DC2626) — Error text, invalid input border, error state icon. No error backgrounds unless critical.
- **Error Red Light** (#FEF2F2) — Error backgrounds for inline validation messages.
- **Warning Amber** (#D97706) — "Optional" field indicators. Subtle, never alarming.
- **Diffused Shadow** (rgba(0,0,0,0.06)) — Card elevation. `0 1px 3px` for subtle lift.

### Accent Rules
- Single accent: NORA Green. No secondary accent.
- Saturation below 80%. No neon, no purple, no blue.
- Never pure black (#000000). Always Ink Primary (#111827).

## 3. Typography Rules

- **Display/Welcome:** `Outfit` — Weight 700 for the welcome heading. Controlled scale, brand personality without shouting. Used only on Welcome screen and Confirmation screen.
- **Body/Labels:** `DM Sans` — Weight 400 (regular), 500 (medium) for labels. All form labels, input text, helper text, step titles, button text. High legibility at 14px–16px. Clean geometric sans.
- **Mono/Data:** `JetBrains Mono` — DNI numbers, CUIL display, token display. Monospace instills data precision and security feel.
- **Scale:** Welcome headline at 28px. Step titles at 18px. Body/labels at 15px. Helper text at 13px. Mono data at 14px.
- **Banned:** `Inter`, generic serif fonts. No serif fonts in this onboarding flow.

## 4. Component Stylings

### Progress Bar
- Fixed at top of viewport, 4px height, full-width (100%).
- Track: Whisper Border (#E5E7EB).
- Fill: NORA Green (#0B6E4F), animated width transition with spring physics.
- Below the bar: step label showing "Paso X de 8" with current step title (13px, Steel Secondary).
- Background: Pure Surface (#FFFFFF) for the label strip, with subtle bottom border (Whisper Border, 1px).

### Buttons
- **Primary:** Full-width, NORA Green (#0B6E4F) background, white text (16px, DM Sans Medium). `border-radius: 12px`, `min-height: 48px`. Active state: `transform: translateY(1px)` for tactile press. Hover: slightly darker green (#095C41). Disabled: Muted Tertiary background, Steel Secondary text.
- **Secondary/Ghost:** Transparent background, Steel Secondary text, same dimensions. For "Back", "Skip", or secondary actions. Active: same translateY press.
- **Upload Trigger:** Dashed border (2px, #E5E7EB), 120px minimum height, rounded-lg (12px), Pure Surface background. Centered icon + instructional text. States: empty (dashed), uploading (pulsing animation), uploaded (solid green border + preview).

### Cards / Step Content Area
- Pure Surface (#FFFFFF) background.
- `border-radius: 16px`, `padding: 24px`.
- Subtle shadow: `0 1px 3px rgba(0,0,0,0.06)`.
- Single card per step containing all step content.
- Separated from progress bar and CTA by 16px gap.

### Input Fields
- **Structure:** Label above (14px, DM Sans Medium, Ink Primary), input (48px height, 15px DM Sans), helper text below (13px, Steel Secondary), error text below helper (13px, Error Red).
- **Border:** 1.5px solid Whisper Border (#E5E7EB), `border-radius: 8px`.
- **Padding:** 12px horizontal, 14px vertical inside input.
- **Focus:** Border becomes NORA Green (#0B6E4F). Subtle ring: `0 0 0 3px rgba(11,110,79,0.1)`.
- **Error:** Border becomes Error Red (#DC2626). Error text appears below with icon.
- **Disabled:** Background #F9FAFB, border #E5E7EB, text Muted Tertiary.
- **No floating labels.** Labels always visible above the input.

### File Upload Zones
- **Empty state:** Dashed border (2px, Whisper Border), centered camera/document SVG icon (24px, Steel Secondary), text "Tocá para subir" (14px, Steel Secondary). `min-height: 120px`. `border-radius: 12px`.
- **Loading state:** Border pulses (opacity animation: 0.6 ↔ 1.0, 1.5s cycle). Shimmer overlay across the dashed area. Text: "Subiendo..." (14px, Steel Secondary) with animated ellipsis.
- **Loaded state:** Solid border (1.5px, NORA Green). Background: NORA Green Light (#ECFDF5). Thumbnail preview of uploaded image (80px × 50px or scaled). Checkmark badge (circular, NORA Green, white checkmark). Text: "Cargado" (13px, NORA Green).
- **Error state:** Solid border (1.5px, Error Red). Background: Error Red Light (#FEF2F2). Error message text (13px, Error Red). Retry button (ghost style).

### DNI Photo Upload (2 photos: front + back)
- Two upload zones stacked vertically, 16px gap.
- Each zone labeled: "Frente del DNI" and "Dorso del DNI".
- Same states as File Upload Zones.

### Checkbox List (Zones of coverage — Paso 6)
- Vertical list of checkbox items, 12px gap between items.
- Each item: checkbox (20px × 20px, rounded 4px) + label (15px, DM Sans, Ink Primary).
- Checkbox unchecked: 1.5px border Whisper Border, Pure Surface fill.
- Checkbox checked: NORA Green fill, white checkmark SVG.
- Touch target: entire row clickable, min-height 44px.

### Textarea (References — Paso 4)
- Same style as input fields. `min-height: 120px`, `resize: vertical`.
- Placeholder: "Ej: Trabajé 3 años en..." (15px, Muted Tertiary).
- Optional badge: (Opcional) in Warning Amber, 12px, next to label.

### Summary Card (Paso 7)
- Compact key-value list, 16px gap between rows.
- Label (13px, DM Sans Medium, Steel Secondary) above value (15px, DM Sans, Ink Primary).
- Uploaded files: small thumbnail preview (40px × 30px, rounded 6px) inline with filename.
- Optional fields with no data: "—" in Muted Tertiary.
- Sections separated by 1px Whisper Border divider, 12px padding above/below.

### Confirmation Screen (Post-submit)
- Centered layout, vertically aligned to upper third of viewport.
- Animated success checkmark (circular, NORA Green fill, white checkmark, 64px).
- Success heading: "¡Listo, [Nombre]!" (24px, Outfit 700, Ink Primary).
- Subtitle: "Tu información fue enviada. Te avisaremos cuando sea revisada." (15px, DM Sans, Steel Secondary).
- Decorative subtle gradient: NORA Green Light (#ECFDF5) fading to Canvas Base at bottom.

### Error Screen (Token invalid/expired/used)
- Centered layout, vertically centered.
- Warning icon (circular, Error Red Light fill, Error Red icon, 64px).
- Heading: "Este enlace no es válido" (24px, Outfit 700, Ink Primary).
- Description varies by error type:
  - Expired: "El enlace de verificación expiró. Solicitá uno nuevo desde WhatsApp." (15px, Steel Secondary)
  - Used: "Este enlace ya fue utilizado. Si necesitás ayuda, contactanos." (15px, Steel Secondary)
  - Invalid: "El enlace no es válido. Verificá que sea correcto." (15px, Steel Secondary)
- Action: "Ir a WhatsApp" ghost button (only if applicable).

## 5. Layout Principles

- **Viewport:** `min-h-[100dvh]`, never `h-screen` (iOS Safari address bar jump).
- **Container:** `max-width: 480px`, `margin: 0 auto` for desktop. Full-width on mobile.
- **Single column only:** No multi-column layouts at any breakpoint. This is a mobile-first flow.
- **Fixed elements:**
  - Progress bar + step label: fixed at top. Height ~52px total.
  - CTA bar: fixed at bottom. `padding: 16px 20px`, contains primary + secondary buttons.
- **Scroll zone:** Content area between progress bar and CTA bar. `padding: 20px 16px`. Scrollable.
- **Bottom safe area:** `padding-bottom: env(safe-area-inset-bottom, 16px)` on CTA bar.
- **Spacing:** 24px gap between form fields. 16px gap within field label-input-helper stacks.
- **Desktop fallback:** At >480px, center the container with subtle shadow to distinguish from canvas background.

## 6. Motion & Interaction

> Stitch generates static screens. This section documents intended motion behavior for the coding agent.

- **Step transitions:** Slide-in from right (forward) or left (backward). Spring physics: `stiffness: 100, damping: 20`. 300ms duration. Content fades in with 50ms stagger on fields within the new step.
- **Progress bar fill:** Smooth width transition matching step transition duration. `transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1)`.
- **Upload border pulse:** `opacity` animation: 0.6 → 1.0 → 0.6, 1.5s cycle. Linear, infinite while uploading.
- **Upload shimmer:** Skeletal shimmer sweeping across upload zone. `background-position` animation.
- **Checkmark scale-in:** `scale(0) → scale(1.1) → scale(1)`, 400ms, spring physics. On upload complete and final confirmation.
- **Button press:** `transform: translateY(1px)`, 100ms ease-out.
- **Input focus:** Border color transition: 200ms ease.
- **Error shake:** Horizontal `translateX` oscillation (4px amplitude, 3 cycles), 300ms, on invalid submit.
- **Form field stagger:** Fields cascade in with `animation-delay: calc(var(--index) * 50ms)` on step mount.
- **Hardware acceleration:** Animate only `transform` and `opacity`. Never `top`, `left`, `width`, `height`.
- **Perpetual micro-loops:** None in this flow — onboarding is a deliberate, calm experience.

## 7. Anti-Patterns (Banned)

- No emojis anywhere in UI, code, or labels
- No `Inter` font — use DM Sans + Outfit + JetBrains Mono
- No generic serif fonts
- No pure black (#000000) — use Ink Primary (#111827)
- No neon/outer glow shadows or box-shadow glow effects
- No oversaturated accents above 80% saturation
- No purple or blue accents — NORA Green only
- No overlapping elements — every element has its own spatial zone
- No multi-column layouts at any breakpoint — single column always
- No centered hero sections beyond welcome and confirmation screens
- No 3-column card layouts
- No filler text: "Scroll to explore", "Swipe down", scroll arrows
- No fabricated data or statistics — use real professional data from token
- No generic names ("John Doe", "Juan Pérez") — use professional name from API
- No fake document images — real previews only from Cloudflare R2
- No AI copywriting clichés: "Elevate", "Seamless", "Next-Gen"
- No circular loading spinners — skeletal shimmer only
- No `h-screen` — always `min-h-[100dvh]`
- No horizontal scroll on mobile
- No system header, navigation, or footer — this is a standalone onboarding page
- No broken image links — use real R2 URLs or placeholder SVGs

## 8. Screen Specifications

### Screen 1: Welcome (Token Valid)
- Show professional name from API response
- Greeting: "Hola, [Nombre]" with Outfit 700 at 28px
- Subtitle: "Completá tus datos para activar tu perfil profesional en NORA." (DM Sans, 15px, Steel Secondary)
- CTA: "Comenzar" primary button
- Progress bar: Step 0 of 8 (empty bar)

### Screen 2: Datos Personales (Paso 1)
- DNI Number input (numeric, 8 digits max)
- CUIL input (numeric, 11 digits max, format: XX-XXXXXXXX-X)
- CTA: "Continuar" primary button
- Secondary: "Volver" ghost button (left-aligned)
- Progress bar: Step 1 of 8 (~12.5% filled)

### Screen 3: Foto DNI (Paso 2)
- Two upload zones: Frente, Dorso
- Each zone shows current state (empty/loading/loaded)
- CTA: "Continuar" (enabled when both loaded, or when one loaded and other is optional behavior TBD)
- Secondary: "Volver" ghost button
- Progress bar: Step 2 of 8 (~25% filled)

### Screen 4: Antecedentes Penales (Paso 3)
- Single upload zone for criminal record certificate
- CTA: "Continuar"
- Secondary: "Volver"
- Progress bar: Step 3 of 8 (~37.5% filled)

### Screen 5: Referencias (Paso 4)
- Textarea with placeholder
- "Opcional" badge
- CTA: "Continuar"
- Secondary: "Volver"
- Progress bar: Step 4 of 8 (~50% filled)

### Screen 6: Video Presentación (Paso 5)
- Upload zone for video (or skip)
- "Opcional" badge
- CTA: "Continuar"
- Secondary: "Volver"
- Ghost: "Omitir" link
- Progress bar: Step 5 of 8 (~62.5% filled)

### Screen 7: Zonas de Cobertura (Paso 6)
- Checkbox list of zones (from API: professional's registered zones)
- Multiple selection allowed
- CTA: "Continuar"
- Secondary: "Volver"
- Progress bar: Step 6 of 8 (~75% filled)

### Screen 8: Resumen (Paso 7)
- Summary of all entered data
- CTA: "Enviar" primary button
- Secondary: "Volver"
- Progress bar: Step 7 of 8 (~87.5% filled)

### Screen 9: Confirmación
- Success state after submit
- No progress bar (or full bar at 100%)
- No CTA bar (or single "Cerrar" ghost button)

### Screen 10: Error (Token Issues)
- Three variants: expired, used, invalid
- No progress bar
- No CTA bar (or "Ir a WhatsApp" ghost button for expired variant)

## 9. Responsive Rules

- **375px (iPhone SE):** Baseline. All elements must fit without horizontal scroll.
- **390px (iPhone 14):** Slightly more horizontal space. Same layout.
- **>480px:** Container centers with max-width: 480px. Subtle shadow on container edges.
- **<375px:** Graceful degradation. Inputs and buttons remain 100% width. Font sizes may reduce by 1px.
- **Touch targets:** All interactive elements minimum 44px height. Generous spacing between clickable items.
- **Safe areas:** Respect `safe-area-inset-*` for notched devices. Bottom CTA bar must clear home indicator.

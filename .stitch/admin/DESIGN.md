# Design System: NORA Admin Panel

## 1. Visual Theme & Atmosphere

A clean, dense operational dashboard for NORA administrators. Light mode. The interface is a high-agency operational tool: clear, information-rich, without decorative noise. The aesthetic references Linear's light mode, Vercel's dashboard density, and Notion's clarity. Consistent with the NORA professional onboarding (AUT-131) design system.

**Density:** 8/10 — Cockpit dense. Designed for operators who need to scan, filter, and act quickly.
**Variance:** 3/10 — Predictable and symmetrical. Grids, tables, and forms follow strict alignment for scanability.
**Motion:** 2/10 — Static restrained. Subtle hover transitions only. No decorative animations in an operational tool.

## 2. Color Palette & Roles

- **Canvas Gray** (#F9FAFB) — Page background. Subtle contrast against white surfaces.
- **Pure Surface** (#FFFFFF) — Cards, table rows, sidebar, form fields.
- **Ink Primary** (#111827) — Headings, key data, table content. Near-black for high legibility.
- **Steel Secondary** (#6B7280) — Metadata, timestamps, descriptions, helper text.
- **Whisper Border** (#E5E7EB) — Table dividers, card borders, input strokes. Subtle, never dominant.
- **NORA Green** (#0B6E4F) — Singular accent. Primary buttons, active nav states, focus rings, toggle switches, links.
- **Emerald Light** (#ECFDF5) — Active nav background, success badge background.
- **Emerald Text** (#059669) — Success badge text, positive trends.
- **Amber Light** (#FFFBEB) — Warning/pending badge background.
- **Amber Text** (#D97706) — Warning badge text, pending indicators.
- **Ruby Light** (#FEF2F2) — Error badge background, suspended/rejected states.
- **Ruby Text** (#DC2626) — Error badge text, destructive action text, critical indicators.
- **Ice Light** (#F3F4F6) — Neutral badge background, completed states.
- **Ice Text** (#6B7280) — Neutral badge text.

**Banned:** Pure black (#000000), neon greens, AI purple/blue glows, gradient accents, warm-cool gray mixing.

## 3. Typography Rules

- **Headlines & Titles:** DM Sans — Weight 600/700. Track-tight (-0.01em). Scale: 1.5rem for page headers, 1rem for section titles. Hierarchy through weight and color.
- **Body & Labels:** DM Sans — Weight 400/500. 0.875rem base for content, 0.75rem for metadata and badges. Line-height 1.5.
- **Numbers & Metrics:** JetBrains Mono — For dashboard metrics, table IDs, configuration values. Tabular figures for alignment. 2rem for metric cards, 0.875rem for table cells.
- **Banned:** Inter, generic system fonts, serif fonts of any kind.

## 4. Layout Principles

- **Desktop-first** responsive layout. Fixed left sidebar (240px) with navigation.
- **Main content:** scrolls independently, padded 32px, background #F9FAFB.
- **Max-width container:** 1400px for content within main area.
- **Full viewport:** `min-h-[100dvh]`, never `h-screen`.
- **Mobile (< 768px):** Sidebar collapses to hamburger menu. Single column layout. Table cards scroll horizontally if needed.
- **Grid system:** CSS Grid for metric cards (4-col desktop, 2-col tablet, 1-col mobile). Flexbox for form rows.

## 5. Component Stylings

### Sidebar
- White surface (#FFFFFF), right border 1px #E5E7EB. Full height.
- **Brand area:** "NORA" (DM Sans 700, 1.125rem, NORA Green #0B6E4F) + "Admin" label (DM Sans 400, 0.75rem, #6B7280).
- **Nav items:** 24px icon + DM Sans 500 text (0.875rem, #111827). 44px height per item. 12px horizontal padding.
- **Active state:** NORA Green left border (3px) + Emerald Light (#ECFDF5) background.
- **User area (bottom):** 32px avatar circle (initials in #0B6E4F bg, white text) + name (DM Sans 500, 0.875rem).

### Dashboard Cards (Metrics)
- White surface (#FFFFFF), 12px border radius, 1px border #E5E7EB. 20px internal padding.
- **Large number:** JetBrains Mono, 2rem, #111827.
- **Label below:** DM Sans 400, 0.75rem, #6B7280.
- **Trend indicator:** Arrow + percentage in DM Sans 500, 0.75rem. Green (#059669) for positive, red (#DC2626) for negative.

### Tables
- White surface (#FFFFFF), 12px border radius, 1px border #E5E7EB.
- **Header:** Sticky, DM Sans 600, 0.75rem, uppercase letter-spacing 0.05em, #6B7280, background #F9FAFB.
- **Rows:** 40–44px height, DM Sans 400, 0.875rem, #111827. Divider 1px #E5E7EB.
- **Hover state:** Background #F9FAFB.
- **Pagination:** DM Sans 400, 0.75rem, #6B7280, with Previous/Next buttons.

### Status Badges
- Pill shape (border-radius full). 6px vertical padding, 12px horizontal.
- DM Sans 500, 0.75rem.
- **Active/Approved/Completed:** #ECFDF5 bg, #059669 text.
- **Pending/In Review:** #FFFBEB bg, #D97706 text.
- **Suspended/Rejected/Critical:** #FEF2F2 bg, #DC2626 text.
- **Neutral/Completed:** #F3F4F6 bg, #6B7280 text.

### Buttons
- **Primary:** NORA Green (#0B6E4F) fill, white text. DM Sans 500, 0.875rem. 36–40px height, 8px border radius.
- **Secondary/Ghost:** Transparent fill, #E5E7EB border, #111827 text.
- **Danger:** Red outline (#DC2626), red text. For reject/suspend actions.
- **Link:** NORA Green text, no decoration. Hover: underline.
- **Toggle switches:** Green (#0B6E4F) when ON, gray when OFF.

### Forms
- **Label:** Above input. DM Sans 500, 0.875rem, #111827.
- **Input:** 40px height, 8px radius, 1px border #E5E7EB, white background.
- **Focus ring:** 2px NORA Green at 40% opacity, offset 1px.
- **Error state:** Red border (#DC2626) + red helper text below.

### Breadcrumb
- Back arrow + text. DM Sans 500, 0.875rem, NORA Green (#0B6E4F). Links to parent list view.

### Timeline (compact, in-table)
- Horizontal connected dots representing order/escalation progress.
- Green dots for completed steps, gray for pending, red for cancelled/failed.
- 3 dots per timeline (solicitado → asignado → completado/en progreso).

## 6. Motion & Interaction

- **Hover transitions:** 150ms background color shift on table rows and nav items.
- **No decorative animations.** This is an operational tool — speed and clarity first.
- **No spring physics, no staggered reveals, no perpetual micro-interactions.**
- **Focus states:** 2px NORA Green ring for inputs and buttons.

## 7. Screens

| # | Screen ID | Title | Description |
|---|-----------|-------|-------------|
| 1 | `ddd4bcff7aa6401e913b65b7118d11ca` | Login | Centered login form (email + password) |
| 2 | `c9fa495c9dbc408fa9ef1a5912537f57` | Dashboard | Metrics cards + recent activity + sidebar |
| 3 | `65b2b2c5039b467f829ef9ac01b8f72e` | Lista de Profesionales | Table with status filters and badges |
| 4 | `6104b3ebf0da492b90ca1fb2d7cee187` | Detalle de Profesional | Personal info, documentation, history, actions |
| 5 | `d75dd0bcb5c74bb9aa0837abfd6ad3fc` | Lista de Pedidos | Table with filters and timeline |
| 6 | `69fc2d23ad9d441eb8084330829b1cab` | Lista de Escaladas | Table with urgency indicators |
| 7 | `1f3046cdd454401396a29361c6db6547` | Configuración del Sistema | Parameter form with toggles and sections |
| 8 | `828ff5dd9f874d0390c1226dfe4a0329` | Lista de Usuarios | Table with phone, status, metrics footer, block/unblock actions |
| 9 | `8fb6da9d15bb45c68ccd85f48e0d0617` | Zonas | Hierarchical tree (Country → Province → Department) with toggles |
| 10 | `7fb02c1203314519a5d3e46c8d285669` | Categorías | Table with inline toggles + create/edit modal |
| 11 | `5e41c4840b964f5b80d7bfbf8ffa6338e` | Planes y Membresías | Plan cards (Básico/Profesional/Premium) + recent memberships table |

**Stitch Project:** `projects/1505486100227666482`
**Design System Asset:** `assets/9140616588152080241`

## 8. Anti-Patterns (Banned)

- No emojis anywhere in the interface
- No Inter font — DM Sans only
- No serif fonts of any kind
- No pure black (#000000) — use #111827
- No neon/outer glow shadows
- No oversaturated accents (>80% saturation)
- No gradient text or decorative gradients
- No custom mouse cursors
- No overlapping elements
- No 3-column equal card layouts (4-column dashboard, 2-column details)
- No fake metrics or fabricated data
- No AI copywriting clichés ("Elevate", "Seamless", "Next-Gen")
- No filler UI text
- No circular spinners — skeletal shimmer only when needed
- No generic placeholder names — use Argentine names (Carlos Mendoza, María Gutiérrez, etc.)

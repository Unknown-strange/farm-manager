---
name: Warm Commerce Minimal
colors:
  surface: '#fff8f3'
  surface-dim: '#dfd9d4'
  surface-bright: '#fff8f3'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f2ed'
  surface-container: '#f3ede7'
  surface-container-high: '#ede7e2'
  surface-container-highest: '#e7e1dc'
  on-surface: '#1d1b18'
  on-surface-variant: '#534437'
  inverse-surface: '#32302d'
  inverse-on-surface: '#f6f0ea'
  outline: '#867465'
  outline-variant: '#d8c3b1'
  surface-tint: '#8b5000'
  primary: '#884e00'
  on-primary: '#ffffff'
  primary-container: '#ab6300'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb871'
  secondary: '#1b6d24'
  on-secondary: '#ffffff'
  secondary-container: '#a0f399'
  on-secondary-container: '#217128'
  tertiary: '#005bb3'
  on-tertiary: '#ffffff'
  tertiary-container: '#2e74d0'
  on-tertiary-container: '#fefcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdcbe'
  primary-fixed-dim: '#ffb871'
  on-primary-fixed: '#2d1600'
  on-primary-fixed-variant: '#6a3c00'
  secondary-fixed: '#a3f69c'
  secondary-fixed-dim: '#88d982'
  on-secondary-fixed: '#002204'
  on-secondary-fixed-variant: '#005312'
  tertiary-fixed: '#d6e3ff'
  tertiary-fixed-dim: '#a9c7ff'
  on-tertiary-fixed: '#001b3d'
  on-tertiary-fixed-variant: '#00468c'
  background: '#fff8f3'
  on-background: '#1d1b18'
  surface-variant: '#e7e1dc'
typography:
  display-stat-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-stat-md:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  title-page:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  title-section:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-default:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-medium:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
  table-cell:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  table-header:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  helper-xs:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  currency-tabular:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is tailored for an operational inventory and sales tracking web platform operating in Ghana. The aesthetic balances agricultural warmth with rigorous financial clarity. The target users span two key operational profiles: frontline farm and retail workers performing fast, reliable ledger inputs, and administrators managing high-volume reconciliation, margins, and procurement.

The overall style combines **Tactile Warmth** and **Modern Functional Minimalism**:
- **Tone:** Grounded, trustworthy, orderly, and pragmatic.
- **Atmosphere:** Natural, farm-fresh warmth delivered via an egg-yolk amber and unbleached-paper off-white backdrop, avoiding cold sterile corporate tech motifs while maintaining zero visual clutter.
- **Emotional Response:** Confidence during fast ledger entry, immediate legibility for daily financial net values, and effortless auditability under high-traffic store conditions.

## Colors

The palette is engineered around agricultural bookkeeping, pairing high-contrast legibility with organic, warm neutrals.

### Surface & Neutral Architecture
- **Canvas / Page Background:** `#FAF8F3` (warm unbleached cream; reduces eye fatigue in high ambient light).
- **Surface / Card Background:** `#FFFFFF` (pure white for operational data density and clear card segmentation).
- **Divider & Structural Borders:** `#E4DFD3` (subtle sand border applied to card perimeters and the fixed sidebar edge).
- **Text Primary:** `#1F1D1A` (deep warm-tinted charcoal for maximum contrast without harsh jet-black starkness).
- **Text Secondary & Helper:** `#777777` (muted neutral for units, labels, and secondary calculation context).

### Brand & Operational Semantic System
- **Primary Brand Accent:** `#C2761A` (deep egg-yolk amber; reserved for primary actions, active navigation states, badge highlights, and critical focuses).
- **Positive / Inflow Semantic:** `#2E7D32` (growth green; used strictly for eggs sold, revenue collected, cash-in, and positive net margins).
- **Loss / Outflow Semantic:** `#C62828` / `#D32F2F` (deep scarlet / crimson; applied strictly to damaged/cracked crates, operating expenses, cash outflows, and negative margins).
- **Intake Semantic:** `#1565C0` (cobalt blue; reserved for logistical intake, daily farm delivery receipts, and pending batch arrivals).
- **Warning / Alert Tint:** `#F59E0B` (for stock threshold warnings and discrepancy flags).

## Typography

Inter is chosen for its geometric precision, superior numerical rendering, and rock-solid legibility across desktop screens.

### Number & Financial Formatting Principles
- **Currency Representation:** All financial metrics must be rendered with the Ghana Cedi symbol (`GH₵`), formatted with strict two-decimal precision (e.g., `GH₵ 1,450.00`).
- **Tabular Figures:** All ledger tables, transaction logs, crate counts, and summary metrics must enforce `font-variant-numeric: tabular-nums` to guarantee vertical decimal alignment across columns.
- **Scale Hierarchy:** Metric summaries use display sizes (28px to 36px bold) to communicate daily totals at a glance. Standard transaction lists rely on 14px for maximum vertical scan efficiency, while form controls and instructional copy use 15px.

## Layout & Spacing

The system is configured around an ergonomic 1440px desktop frame with a permanent structural split:

### Frame Model
- **Fixed Sidebar:** Occupies a rigid `240px` column anchored on the left. It runs full viewport height (`100vh`) with a continuous `1px` border-right (`#E4DFD3`) and pure white ground (`#FFFFFF`).
- **Workspace Canvas:** Fills the remaining viewport, set to the warm `#FAF8F3` tone.
- **Main Content Container:** Centered or anchored within the workspace with an optimal reading `max-width: 1100px` and constant `32px` (`space-xl`) internal padding.

### Grid & Spacing Rhythm
- **Rhythm Unit:** 4px baseline, utilizing `space-xs` (4px), `space-sm` (8px), `space-md` (16px), `space-lg` (24px), and `space-xl` (32px).
- **Data Grids:** Ledger lists and metric cards utilize a flexible 12-column layout with 24px (`1.5rem`) gutters. Metric summary cards typically span 3 or 4 columns (4-up or 3-up configurations).
- **Form Rows:** Dense form interactions for daily records use consistent 16px gaps between related input sets, with 24px between field groups.

## Elevation & Depth

This system intentionally eliminates deep, heavy cast shadows in favor of a clean, grounded tactile ledger style.

### Depth Mechanics
- **Structural Separation:** The system relies on 1px crisp borders (`#E4DFD3`) between panels and canvas rather than heavy shadows.
- **Subtle Surface Lift:** Card surfaces (`#FFFFFF`) floating over the canvas (`#FAF8F3`) use a very light, warm-diffused shadow:
  - `box-shadow: 0 1px 3px rgba(31, 29, 26, 0.04), 0 1px 2px rgba(31, 29, 26, 0.02);`
- **Active / Interactive Lift:** Cards with drill-down views or actionable ledger rows on hover:
  - `box-shadow: 0 4px 12px rgba(194, 118, 26, 0.06), 0 1px 3px rgba(31, 29, 26, 0.04);`
- **Modal / Flyout Elevation:** High-priority modals (such as End-of-Day Reconciliation Confirmation):
  - `box-shadow: 0 12px 32px rgba(31, 29, 26, 0.12), 0 2px 6px rgba(31, 29, 26, 0.04);`
  - Paired with an overlay backdrop: `rgba(31, 29, 26, 0.40)`.

## Shapes

The geometric personality is warm, soft, and approachable, avoiding harsh surgical sharp corners while avoiding overly informal round pills.

- **Cards & Data Panels:** Fixed corner radius of `12px` (`0.75rem`). This defines the primary container identity.
- **Buttons & Input Elements:** Standard corner radius of `8px` (`0.5rem`).
- **Badges, Tags, & Status Indicators:** Soft pill or rounded tag with `6px` (`roundedness: 2` variant) or full curve where indicating discrete counts.
- **Sidebar Active Indicator:** `8px` rounded pill marker enclosing navigation links.

## Components

### 1. Navigation Sidebar (Desktop 240px)
- **Container:** Background `#FFFFFF`, border-right `1px solid #E4DFD3`, padding `24px 16px`.
- **Brand Header:** App logo mark paired with "Egg Book", followed by an active badge indicating the current operational mode (`Worker Station` vs `Admin Suite`).
- **Nav Links:** Height 40px, padding `0 12px`, border-radius `8px`, font size 14px, weight 500.
  - *Default:* Text `#777777`, transparent background.
  - *Hover:* Background `#FAF8F3`, text `#1F1D1A`.
  - *Active:* Background `#C2761A` (or light amber tint `#FFF8ED` with `#C2761A` text and a 3px active amber pill indicator).

### 2. Metric & Key Stat Cards
- **Container:** Background `#FFFFFF`, border `1px solid #E4DFD3`, border-radius `12px`, padding `20px`.
- **Top Row:** Title in uppercase micro-label (`12px`, `#777777`, tracking +0.04em) alongside an icon tinted with semantic context.
- **Value:** `28px` to `36px` bold tabular font.
  - Total Revenue / Inflow: Color `#2E7D32`.
  - Expenses / Breakages: Color `#C62828`.
  - Intake / Batch Quantity: Color `#1565C0`.
  - Neutral / Stock Crate Inventory: Color `#1F1D1A`.
- **Bottom Helper:** 12px neutral `#777777` providing comparison (e.g., `+14 crates vs yesterday`).

### 3. Data Tables (Ledger & Daily Book)
- **Container:** White card wrapping, full width, border `1px solid #E4DFD3`, border-radius `12px`, overflow hidden.
- **Header:** Height 44px, background `#FAF8F3`, border-bottom `1px solid #E4DFD3`, text 12px uppercase semibold `#777777`.
- **Row:** Height 52px, border-bottom `1px solid #FAF8F3`, hover background `#FCFBF8`, text 14px regular `#1F1D1A`.
- **Numerical Alignment:** Right-aligned for all financial totals and crate tallies with `GH₵` token fixed.

### 4. Form Inputs & Number Steppers
- **Text & Numerical Inputs:** Height 44px, background `#FFFFFF`, border `1px solid #E4DFD3`, border-radius `8px`, padding `0 14px`, text 15px `#1F1D1A`.
  - *Focus state:* Border `1.5px solid #C2761A`, subtle box-shadow `0 0 0 3px rgba(194, 118, 26, 0.15)`.
- **Stepper Buttons for Crates:** Integrated - / + tactile buttons on numeric fields to enable quick, error-free logging on desktop terminals.

### 5. Buttons & Action Elements
- **Primary Action (Record Sale / Add Stock):** Background `#C2761A`, text `#FFFFFF`, border-radius `8px`, height 42px, padding `0 18px`, font 14px semibold. Hover: `#AC6412`. Active: `#96540B`.
- **Semantic Secondary Actions:**
  - *Record Expense:* Ghost or light scarlet background (`#FEECEB`), text `#C62828`, border `1px solid #F8CBC8`.
  - *Egg Intake:* Ghost blue background (`#EBF3FC`), text `#1565C0`, border `1px solid #C5DCF8`.
- **Neutral Outlined:** Background transparent, border `1px solid #E4DFD3`, text `#1F1D1A`. Hover: background `#FAF8F3`.

### 6. Badges & Chips
- **Income/Sale:** Background `#EAF5EA`, border `1px solid #C4E5C5`, text `#2E7D32`.
- **Cracked/Loss:** Background `#FEECEB`, border `1px solid #F8CBC8`, text `#C62828`.
- **Received:** Background `#EBF3FC`, border `1px solid #C5DCF8`, text `#1565C0`.
- **Status (Draft / Reconciled):** Background `#F5F2EB`, border `1px solid #E4DFD3`, text `#777777`.

### 7. Role-Based Views (Worker vs Admin Layouts)
- **Worker View:**
  - Strict privacy gating: Total revenue cards, expense breakdowns, net profits, and full stock balances are completely masked from the UI.
  - Interaction focuses purely on high-frequency operational tasks: *Record Eggs Sold*, *Record Eggs Received*, and *Log Damaged/Cracked*.
  - Simplified tabular log showing only entries submitted during their active shift.
- **Admin View:**
  - Complete Daily Book view with top-level financial KPIs: Gross Revenue, Crates Sold, Crates Broken/Lost, Gross Expenses, and Net Daily Margin.
  - End-of-day reconciliation modal calculating expected vs actual physical cash collected.
  - History archive with date range filtering and manager audit trail.
# UI Redesign: Premium Glassmorphism Ride-Sharing App

Redesign the entire UI using a premium, modern glassmorphism design system. Goal: an elegant, minimal, luxurious ride-sharing experience comparable to Apple's design language, Linear, Arc Browser, and modern AI applications — a premium 2026 luxury mobility platform, not a typical taxi app.

**Preserve all current functionality and business logic. Do not modify backend behavior or app logic unless necessary for the UI.**

## Step 1: Setup
Before making changes, analyze the existing application structure and identify all reusable UI components. Create a centralized design system (theme, colors, typography, spacing, radii, shadows, glass styles, animations) and refactor all screens to use these shared components instead of hardcoding styles. Every screen must follow the same visual language and design tokens. Do not leave any legacy styling behind. The final app should feel like it was designed as a single cohesive product, not a collection of individual screens.

## Design Philosophy
The UI should feel: premium, minimal, soft, spacious, luxurious, fast, elegant, high-end.

Avoid making it look like a typical taxi app with bright yellows or greens. Use subtle glassmorphism, not excessive blur. Prioritize readability, accessibility, and smooth interactions. Animations should feel natural and fluid.

## Light Mode
- Background: `#FAF8F6`, with an extremely subtle warm gradient rather than a flat color — `#FFFFFF → #FAF8F6 → #F3EDEA`
- Primary Accent: `#32292F`
- Text: Primary `#32292F` / Secondary `#6D6469` / Disabled `#B8B0B5`
- Cards: translucent white glass
- Glass properties: background `rgba(255,255,255,0.28)`; backdrop blur 24px; border `1px solid rgba(255,255,255,0.35)`; shadow very soft, large blur, low opacity

## Dark Mode
- Background: `#0D0D0D`, gradient `#0D0D0D → #151218 → #23171E`
- Primary Accent: `#F7A6C1`
- Primary CTA: slightly deeper pink `#E87BA5`
- Glass cards: background `rgba(247,166,193,0.10)`; blur 24px; border `rgba(247,166,193,0.15)`. Glass should naturally pick up background colors instead of looking like solid pink.

## Color Usage
The accent color should only occupy about 5–10% of the screen. Use accent for:
- Primary buttons
- Selected tabs
- Selected ride type
- Current location marker
- Driver marker
- ETA chips
- Search field focus
- Active icons
- Progress indicators

Do not use accent colors for entire screens. Maintain a mostly neutral UI.

## Glassmorphism
Use glass only where appropriate: search bar, bottom sheet, ride cards, driver card, navigation bar, floating panels, dialogs, modals. Avoid glass for every component. Glass corner radius: 20–28px.

## Buttons
- Primary: large pill shape, bold typography, soft shadow
- Secondary: glass style
- Icon buttons: circular, glass background

## Typography
Modern, clean typography with clear hierarchy: Large Hero → Section Titles → Body → Caption. Use generous spacing. Avoid cramped layouts.

## Cards
Cards should float above the background. Large corner radius. Subtle blur. Very soft shadows. Generous spacing.

## Icons
Clean, rounded icons. Consistent stroke width. Minimalistic.

## Animations
Every interaction should animate smoothly, using fade, scale, slide, and glass blur transitions. No flashy animations — everything should feel premium.

## Map
The map should remain mostly unobstructed: floating glass search bar, floating glass ride selector, floating driver information card, glass bottom sheet.

## Bottom Navigation
Floating glass navigation bar. Rounded. Blurred. Active icon uses accent color; inactive icons use secondary text color.

## Do Not Use
Material Design default colors, bright blue buttons, harsh shadows, square cards, flat UI, neon colors, oversaturated gradients, thick borders, cluttered layouts.

## Overall Style
A combination of Apple Human Interface Guidelines, Linear, Arc Browser, Nothing OS, and modern AI applications — subtle glassmorphism, excellent spacing, smooth animations, calm and sophisticated.

## Ride-Sharing UX Principles
- The map is the primary focus and should remain visible at all times — design the interface around the map, not behind it.
- During ride selection, the map should occupy ~70–80% of the visible screen area whenever possible.
- All interface elements should feel lightweight and float above the map rather than covering it.
- Keep overlays compact; expand them only when the user explicitly interacts with them.
- Use floating glass panels instead of large opaque containers.
- Search bar floats at the top.
- Ride selection appears as a compact floating bottom sheet that expands only when necessary.
- Driver information appears as a floating glass card.
- Navigation controls remain unobtrusive.
- Avoid large permanent panels that hide the map.
- The user should always feel connected to their surroundings and the driver's live location.
- Transitions between screens should preserve map continuity whenever possible instead of abruptly replacing the entire screen.
- The map should always feel like the canvas; the UI acts as a lightweight overlay.

## User Experience Goals
Priority order: 1) Simplicity 2) Readability 3) Speed 4) Accessibility 5) Premium visual polish.

Every screen should answer the user's primary question immediately without overwhelming them. Reduce visual clutter wherever possible. Maintain generous spacing, clear hierarchy, and consistent alignment throughout. Every component should have a clear purpose — if a UI element isn't necessary, remove it. Design with a "less but better" philosophy. Think like Apple, not Material Design. The UI should feel effortless, calm, luxurious, and highly intuitive.

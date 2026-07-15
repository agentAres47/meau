# Home Screen Redesign — Map-First Passenger Flow

Redesign the home screen to follow a modern ride-sharing interaction flow similar to Ola, Uber, and Google Maps — **adopt only the UX philosophy, not the visual design**. Preserve our own visual identity (glassmorphism design system). The map becomes the primary background, visible immediately on app open.

## Layout
On app open:
- Auto-detect and center on the user's current location.
- Display the map immediately, full screen.
- Interface floats above the map using glassmorphism — layered floating panels, not a form-first layout.
- Remove the current form-first layout entirely.

## Top Section
Floating glass search card showing:
- Current Location
- "Where would you like to go?" (destination field = primary CTA)

Include a profile avatar/menu button top-right, and a hamburger/menu button if appropriate. Everything floats above the map.

## Bottom Sheet
**Collapsed state:**
- Destination preview
- Quick actions
- Recent locations
- Saved places

**Expanded state:**
- Ride options
- Seat selection
- Fare
- Time selection
- Additional options

Sheet expands naturally when the user interacts with the destination field.

## Map Experience
The map is the product — never cover most of it. User should always feel connected to their surroundings. Preserve map continuity during navigation, animate camera smoothly, avoid unnecessary full-screen transitions.

## Map Style
Modern dark-themed map, elegant rather than high-contrast. Reduce unnecessary road labels but keep important roads visible. Map should complement the luxury UI, not compete with it.

## Custom Map Markers
Replace default Google Maps pins entirely — no bright red pins.

- **Current Location:** soft glowing circle with small filled center, accent color per theme.
- **Pickup Marker:** small elegant circle with subtle glow.
- **Destination Marker:** minimal pin, rounded geometry.
  - Light mode accent: `#32292F`
  - Dark mode accent: `#F7A6C1`
- **Driver Marker:** small premium vehicle icon inside a glass capsule; vehicle movement animates smoothly.

All markers: rounded, minimal, on-brand.

## Map Details
Roads clearly visible, minimal POIs, subtle colors, reduced visual clutter. Map should not overpower the UI.

## Interactions
- Tapping the destination field smoothly expands the bottom sheet.
- Selecting a destination animates the map to fit both pickup and destination.
- Pins animate into place.
- Bottom sheet resizes in place instead of replacing the screen.
- All transitions feel fluid.

## Visual Feel
The experience should feel like **Apple Maps + Uber + Nothing OS + our premium glassmorphism design language.** Map is the canvas; UI floats naturally above it. Calm, premium, effortless.

---

## Fare Slider Flow Change

Remove the "offer per seat" fare slider (see reference screenshot — ₹ amount with min/max slider, e.g. ₹20–₹300) from its current placement on the home/passenger screen.

Instead:
1. Passenger selects destination and taps **Find Rides**.
2. This opens a **new drawer** (bottom sheet/modal) showing the fare slider to confirm the offered price per seat.
3. Passenger confirms the price in this drawer, then proceeds to **Find Rides** from there.
4. After confirming, passenger sees and selects from available ride options as before.

So the fare slider moves from a static home-screen element to a confirmation step that appears only after the user initiates a ride search, right before ride options are shown.

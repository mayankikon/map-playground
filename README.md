# Map Playground

Inventory map prototype built with Next.js and Mapbox GL. Place vehicles, keys and installation exceptions on a map, draw geofences by plotting points, and see markers change style with zoom. Marker artwork comes from the Figma "Inventory Management → Map Assets" sheet.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` with a Mapbox public token:

   ```bash
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token
   ```

3. Run the dev server and open http://localhost:3000:

   ```bash
   npm run dev
   ```

## How the map behaves

- **Clusters:** vehicles within 10 m of each other form a group. A group of 5 or more stays a numbered cluster until zoom 18. Vehicles on their own show individually.
- **Markers:** individual assets show as Figma map markers below zoom 19.
- **Images:** from zoom 19, every asset shows its image marker.
- **Base map:** satellite by default.
- **Vehicles / Keys:** the toggle at the top right switches which assets the map shows.
- **Map / Satellite:** the switch at the bottom right changes the base map.

All thresholds are adjustable in the **Display** tab. Assets, geofences and settings are saved in the browser's localStorage.

## Code map

- `src/components/MapView.tsx`: Mapbox setup, clustering, marker tiers, drawing and drag and drop
- `src/components/Sidebar.tsx`: left panel (Assets, Geofences, Display)
- `src/components/markers.tsx`: Figma marker and preview components
- `src/lib/catalog.ts`: asset types, defaults and settings validation
- `src/lib/geo.ts`: geometry helpers and distance grouping
- `src/lib/seed.ts`: demo data around Grapevine, TX

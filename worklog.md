---
Task ID: 1
Agent: main
Task: Investigate and fix position precision not being set to maximum when pushing preset to device

Work Log:
- Read all relevant source files: types.ts, builtin-presets.ts, settings-presets-tab.tsx, device-setup-tab.tsx, techo-bridge.py, API routes
- Searched official Meshtastic documentation (meshtastic.org, buf.build/protobufs, deepwiki)
- Discovered the root cause: Meshtastic 2.7.x has TWO separate position precision fields:
  1. `Config.PositionConfig.position_flags` (bitmask) - controls WHICH data fields are included
  2. `ChannelSettings.ModuleSettings.position_precision` (0-32 bits) - controls coordinate OBFUSCATION
- The bridge was only setting position_flags, NEVER setting module_settings.position_precision
- Default firmware value for position_precision is 14 (~1.5km radius) - this is why user saw "2km radius"
- Fixed by separating the two concepts across all layers

Stage Summary:
- **Root cause**: `ChannelSettings.ModuleSettings.position_precision` was never set, defaulting to 14 (~1.5km)
- **Fix applied across 7 files**:
  1. `prisma/schema.prisma` - Added `positionFlags Int @default(943)`, changed `positionPrecision` default to 32
  2. `src/lib/builtin-presets.ts` - Added `positionFlags` to interface and all presets, changed `positionPrecision` to 32
  3. `techo-bridge.py` - Maps `positionFlags` → `position_flags`, maps `positionPrecision` → `ch.settings.module_settings.position_precision` on channel 0, always writes channel 0
  4. `src/app/api/presets/route.ts` - Added `positionFlags` to create/update
  5. `src/app/api/meshtastic/config/route.ts` - Added `positionFlags` to config payload
  6. `src/components/dashboard/settings-presets-tab.tsx` - Separated UI for coordinate precision and data flags
  7. `src/components/dashboard/device-setup-tab.tsx` - Same separation of UI controls
- Key value mappings:
  - `positionPrecision=32` → channel position_precision=32 → full precision (~1m)
  - `positionPrecision=14` → channel position_precision=14 → ~1.5km (firmware default)
  - `positionFlags=943` → position_flags=943 → all data (ALT+MSL+GEO+DOP+HVDOP+SAT+SEQ+TS+HEADING+SPEED)

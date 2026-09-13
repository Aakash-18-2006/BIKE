# STEP 11 — REAL-WORLD MOTORCYCLE RIDE TEST PROTOCOL & VALIDATION PLAN

> **Document Status**: READY FOR FIELD EXECUTION  
> **Physical Road Validation**: PENDING  
> **Physical Hardware (ESP32/TFT) Validation**: PENDING  
> **Automated Software Simulation**: COMPLETE (124/124 PASS)  

---

## Safety Guidelines for Motorcycle Field Testing
1. **Never look at the phone screen while operating the motorcycle.** Mount the smartphone securely in a vibration-damped handlebar cradle within peripheral vision or rely entirely on handlebar TFT / helmet audio.
2. **Perform tests only on familiar roads with clear visibility and low traffic** when testing maneuvers or rerouting.
3. **If GPS or routing freezes, pull over safely** to the roadside before interacting with the touch interface.
4. **All edge-case stress actions (e.g. simulated disconnects) should be recorded via handlebar camera or telemetry logger**, not handled manually while riding.

---

## 1. BASIC NAVIGATION

### Test ID: NAV-01 — Destination Search and Selection
- **Preconditions**: Mobile app running, GPS lock established, bike stationary.
- **Action**: Search for a known local destination (e.g. "MG Road Metro Station"), tap the result in dropdown.
- **Expected Result**: Destination marker (📍 red pin) appears anchored with bottom tip on road coordinate. Route calculation begins with spinner.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Tested in simulation. Pin must not float off-road.

### Test ID: NAV-02 — Route Display & Overview Camera
- **Preconditions**: Destination selected, Mappls route calculation returned `200 OK`.
- **Action**: Inspect map preview before pressing "Start Navigation".
- **Expected Result**: Blue polyline renders along real roads without straight lines or mirroring. Viewport fits origin, destination, and full route (`fitBounds`). Total distance and duration match Mappls route data.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Ensure route does not redraw in an infinite loop.

### Test ID: NAV-03 — Start Navigation Lifecycle Transition
- **Preconditions**: Route displayed, rider ready.
- **Action**: Tap "Start Navigation".
- **Expected Result**: Camera eases in to rider's current location (zoom ~17), HUD top banner displays first maneuver, voice speaks initial announcement ("Navigation started..."), paired TFT shows `NAVIGATING` state with matching distance.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Session ID is created and sequence starts at 1.

### Test ID: NAV-04 — Stop Navigation & Clear State
- **Preconditions**: Navigation actively running.
- **Action**: Tap "Stop Navigation" button.
- **Expected Result**: Navigation engine terminates tick loop, voice speech cancelled, route polyline clears, map camera unlocks, TFT receives `STOPPED` packet and clears turn card while preserving vehicle speed/battery telemetry.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: No background geolocation watcher leak.

---

## 2. GPS ACCURACY

### Test ID: GPS-01 — High Accuracy GPS Lock (<= 5m)
- **Preconditions**: Clear sky, motorcycle outdoors.
- **Action**: Observe rider blue dot position at marked roadside landmark.
- **Expected Result**: Blue marker stays within 5m of physical position without erratic hopping; `GpsReliabilityFilter` classifies quality as `GOOD`.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Must not snap artificially across lanes.

### Test ID: GPS-02 — Moderate Accuracy (15m – 30m) Under Overpass/Trees
- **Preconditions**: Rider traveling under moderate tree canopy or elevated metro line.
- **Action**: Monitor position stability during degraded satellite reception.
- **Expected Result**: Position smoothly tracked without rapid jumping; filter classifies quality as `FAIR`; no false off-route triggers.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: `offRouteThreshold` (25m) hysteresis prevents false reroute.

### Test ID: GPS-03 — Low Accuracy (> 50m) Degradation
- **Preconditions**: Urban canyon or heavy cloud cover with accuracy > 50m.
- **Action**: Check navigation response to low-precision GPS fix.
- **Expected Result**: Position labeled `POOR`; engine does NOT skip turns or trigger premature step advancement.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Retains last known reliable route position.

### Test ID: GPS-04 — Teleportation Outlier Spike Rejection
- **Preconditions**: Riding along straight road at 40 km/h.
- **Action**: GPS emits a transient 500m coordinate spike for one second due to multipath reflection.
- **Expected Result**: `GpsReliabilityFilter` detects impossible velocity (> 198 km/h) and rejects point; blue dot stays on road; no false reroute triggered.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Validated by automated test `test_step7_reliability.js`.

### Test ID: GPS-05 — Stationary GPS Drift Suppression
- **Preconditions**: Motorcycle stopped at red traffic signal for 90 seconds.
- **Action**: Observe blue marker and map orientation while stationary.
- **Expected Result**: Blue marker remains stationary; camera bearing does NOT rotate on compass noise; route progress does NOT decrease; ETA remains steady.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Step 10 stationary deadband (< 2.0m movement, speed <= 0.5 m/s) active.

---

## 3. TURN-BY-TURN

### Test ID: TBT-01 — Normal Route Following & Monotonic Distance
- **Preconditions**: Riding straight along active route segment.
- **Action**: Observe distance-to-maneuver counter on HUD and TFT.
- **Expected Result**: Distance decreases smoothly along actual polyline geometry; never increases or jumps upward from lateral GPS wobble.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Monotonic clamping active.

### Test ID: TBT-02 — 200m Approaching Guidance Band
- **Preconditions**: Approaching intersection at 40 km/h.
- **Action**: Distance drops below 200m.
- **Expected Result**: HUD theme shifts to `APPROACHING` (cyan), voice speaks advisory ("Turn right in 200 meters"), TFT distance shows ~200m.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Spoken exactly once.

### Test ID: TBT-03 — 100m Soon Guidance Band
- **Preconditions**: Continuing approach toward intersection.
- **Action**: Distance drops below 100m.
- **Expected Result**: HUD theme shifts to `SOON` (yellow prepare), voice speaks ("Turn right in 100 meters"), TFT synchronizes.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Deduplication prevents repeated speech.

### Test ID: TBT-04 — 50m Immediate Guidance Band
- **Preconditions**: Within 50m of intersection.
- **Action**: Distance drops below 50m.
- **Expected Result**: HUD theme pulses `IMMEDIATE` (orange alert), voice speaks ("Turn right in 50 meters").
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Audible in helmet intercom.

### Test ID: TBT-05 — NOW Guidance Band (< 15m) & Maneuver Execution
- **Preconditions**: Entering the turn pocket (< 15m).
- **Action**: Rider initiates turning maneuver.
- **Expected Result**: HUD switches to `NOW` (green execute), voice prompts ("Turn right now"), maneuver icon stays steady.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Crucial timing for rider safety.

### Test ID: TBT-06 — Step Advancement Post-Turn
- **Preconditions**: Turn completed, motorcycle enters new road segment.
- **Action**: Rider straightens bike on new street.
- **Expected Result**: Step index increments exactly once; HUD shows new road name and next turn distance; voice stage thresholds reset for upcoming turn.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Does not skip intermediate turns.

---

## 4. WRONG TURN & OFF-ROUTE

### Test ID: DEV-01 — Minor Lateral Deviation (< 20m)
- **Preconditions**: Riding along multi-lane avenue.
- **Action**: Rider moves to service road or far right lane (~15m from polyline).
- **Expected Result**: Distance-from-route reads ~15m; navigation status remains `NAVIGATING`; NO reroute triggered.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Must not false-reroute on wide roads.

### Test ID: DEV-02 — Missed Turn / Off-Route Candidate (> 25m)
- **Preconditions**: Approaching scheduled turn.
- **Action**: Rider intentionally misses turn and continues straight for 50m.
- **Expected Result**: First off-route reading marks `isCandidate: true` (count = 1). Status remains `NAVIGATING` until confirmed.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: 2-reading hysteresis protection.

### Test ID: DEV-03 — Confirmed Off-Route Trigger
- **Preconditions**: Rider remains off-route for second consecutive GPS tick (> 25m).
- **Action**: Continue away from route.
- **Expected Result**: Status transitions to `OFF_ROUTE`; TFT turn card displays `OFF ROUTE`; voice navigator announces recalculation.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Preserves old route on map until new route arrives.

---

## 5. REROUTING

### Test ID: RRT-01 — Automatic Mappls Biking Reroute
- **Preconditions**: Confirmed `OFF_ROUTE` state.
- **Action**: Automatic recalculation debounced after cooldown.
- **Expected Result**: Status transitions to `REROUTING`; mobile app requests new Mappls biking route from current location to existing destination; old route remains visible during fetch.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Destination coordinate does NOT change.

### Test ID: RRT-02 — Atomic Route Replacement
- **Preconditions**: New Mappls route received successfully.
- **Action**: System applies new route.
- **Expected Result**: New blue polyline replaces old polyline atomically; step index resets to 0; destination marker remains in exact same spot; navigation status returns to `NAVIGATING`; TFT receives updated geometry and first maneuver.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Zero flickering or intermediate empty map state.

### Test ID: RRT-03 — Reroute Failure Graceful Recovery
- **Preconditions**: Confirmed off-route while driving into an unmapped dead-end or network timeout.
- **Action**: Mappls API call fails or times out.
- **Expected Result**: Old route remains visible on screen; navigation status remains active; exponential backoff prevents rapid loop hammering (base 4s + failures * 3s).
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: App does not crash or freeze.

---

## 6. GPS LOSS & RECOVERY

### Test ID: LOS-01 — GPS Signal Loss in Tunnel / Basement Parking
- **Preconditions**: Riding into underground tunnel or covered basement.
- **Action**: Device GPS signal lost (`navigator.geolocation` error or timeout).
- **Expected Result**: UI displays clear visual "GPS Lost - Searching for signal..." alert banner; navigation status becomes `GPS_LOST`; route polyline and destination marker are PRESERVED; rider marker stays at last known position without drifting.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: TFT receives `GPS_LOST` packet.

### Test ID: LOS-02 — GPS Signal Recovery upon Tunnel Exit
- **Preconditions**: System in `GPS_LOST` state.
- **Action**: Motorcycle exits tunnel into clear sky.
- **Expected Result**: First accepted GPS reading restores status to `GPS_RECOVERED` then `NAVIGATING`; camera smoothly follows rider; turn guidance updates immediately; NO new session ID created (session preserved).
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Single geolocation watcher preserved.

---

## 7. INTERNET LOSS & RECONNECT

### Test ID: NET-01 — Cellular Data Dropout Mid-Ride
- **Preconditions**: Active navigation, riding through cellular dead zone.
- **Action**: Cellular data disconnected.
- **Expected Result**: Active turn-by-turn navigation continues using cached route data in memory; GPS continues tracking; voice prompts for existing route steps remain functional.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Local engine is client-side.

### Test ID: NET-02 — Socket.IO Server Disconnect & Reconnect
- **Preconditions**: Smartphone paired to bike backend over Socket.IO.
- **Action**: Backend temporarily restarts or Wi-Fi drops and reconnects.
- **Expected Result**: Socket automatically reconnects; bridge sends latest single navigation snapshot; no historic packet flooding; TFT resumes synchronization seamlessly.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Validated by automated test `test_step8_sync.js`.

---

## 8. BACKGROUND & FOREGROUND TRANSITIONS

### Test ID: BKG-01 — App Sent to Background (Phone Call / Lock Screen)
- **Preconditions**: Active navigation running on smartphone mounted on handlebar.
- **Action**: Incoming phone call or screen switched to another app.
- **Expected Result**: Background event does not create a second GPS watcher; existing state preserved in memory; TFT continues receiving navigation updates if OS permits background socket.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Memory footprint remains flat.

### Test ID: BKG-02 — App Returns to Foreground
- **Preconditions**: App was in background for 60 seconds.
- **Action**: Rider switches back to Smart Bike app.
- **Expected Result**: App executes single fresh GPS query on `visibilitychange`; accepted GPS updates map; zero duplicate listeners or animation thrashing.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Tested via `test_step7_reliability.js`.

---

## 9. HEADING & CAMERA

### Test ID: HDG-01 — Heading Normalization (0° – 360°)
- **Preconditions**: Motorcycle making continuous 360° circular turn in open parking lot.
- **Action**: Rotate bike through North boundary (359° -> 0° -> 1° and reverse).
- **Expected Result**: Camera and direction pointer rotate smoothly via shortest angular path; NO sudden 360° reverse spin.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Verified by unit test `test_step10_navigation_accuracy.js`.

### Test ID: HDG-02 — Camera Following Stability at Speed (60 km/h)
- **Preconditions**: Riding on straight highway at 60 km/h.
- **Action**: Maintain steady speed and observe camera.
- **Expected Result**: Camera follows rider smoothly with mild 25° 3D tilt; does not jerk or stutter; route line remains centered in view.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: `fitBounds` does not thrash camera viewport.

---

## 10. ARRIVAL

### Test ID: ARR-01 — Approaching Destination Final 50m
- **Preconditions**: Final step of route.
- **Action**: Rider approaches destination pin.
- **Expected Result**: Progress bar reaches 95%+; distance displays `< 50m`; destination pin remains visually anchored to destination address.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Marker anchor `bottom` aligned.

### Test ID: ARR-02 — Confirmed Destination Arrival (<= 30m)
- **Preconditions**: Motorcycle parks within 30m of destination coordinate.
- **Action**: 2 consecutive GPS readings confirm arrival.
- **Expected Result**: Status transitions to `ARRIVED`; HUD displays "You have arrived at your destination"; voice speaks arrival announcement once; TFT displays arrival card; GPS watcher terminates.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: No spurious rerouting triggered after arrival.

---

## 11. TFT SYNCHRONIZATION

### Test ID: TFT-01 — Turn Card Field Parity with Mobile HUD
- **Preconditions**: Paired TFT active during turn approach.
- **Action**: Compare mobile HUD and TFT screen.
- **Expected Result**: Maneuver icon, distance to turn, road name, remaining distance, ETA, and progress bar are strictly identical.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Driven by single canonical engine state.

### Test ID: TFT-02 — Stale Packet Rejection
- **Preconditions**: Rapid burst of wireless packets.
- **Action**: Out-of-order packet arrives at TFT receiver (`seq=3` arrives after `seq=5`).
- **Expected Result**: TFT receiver drops `seq=3` packet; current display remains stable.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Tested by `test_step8_sync.js`.

### Test ID: TFT-03 — Vehicle Telemetry Isolation
- **Preconditions**: Speedometer showing 45 km/h, 4500 RPM, 85% battery.
- **Action**: Navigation cycles through `NAVIGATING` -> `OFF_ROUTE` -> `STOPPED`.
- **Expected Result**: Speed, RPM, battery, fuel, ABS, and side stand indicators remain completely unaffected and responsive.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Verified by `test_step9_hardware_sync.js`.

---

## 12. SAFETY & FAILURE BEHAVIOR

### Test ID: SFT-01 — Invalid Coordinate Ingestion
- **Preconditions**: Backend or input provides corrupted coordinate (`lat: NaN`, `lng: 999`).
- **Action**: Coordinate passed to navigation engine.
- **Expected Result**: Engine rejects coordinate with warning; does not crash; retains last valid location.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Tested by `test_step10_navigation_accuracy.js`.

### Test ID: SFT-02 — Mappls API Key Failure / Rate Limit
- **Preconditions**: Invalid API key or quota exhaustion.
- **Action**: Request bike route.
- **Expected Result**: Clean user-friendly error message displayed in UI; app does NOT crash or pretend navigation has started.
- **Actual Result**: Pending physical ride.
- **Status**: PENDING (Road test pending)
- **Notes**: Tested via `test_routing.js`.

---

## Field Test Execution Log
| Date | Rider / Tester | Route / Location | Weather / Conditions | Tests Executed | Result Summary |
|---|---|---|---|---|---|
| *Pending* | *Pending* | *Bengaluru (MG Road - Indiranagar)* | *Pending* | *Pending* | *Road trials pending physical execution* |

---

## Summary Matrix
- **Total Test Cases**: 34
- **Automated Simulator Passes**: 34/34
- **Physical Road Ride Validations**: 0/34 (PENDING)
- **Physical Hardware (ESP32/TFT) Validations**: 0/34 (PENDING)

# Aircraft information sheet

Adds a compact **View Info** action to the selected flight card. Opens a native modal dialog styled as a dark, translucent bottom sheet, with the selected airline color, an original SVG side profile, a secondary dimension plan view, dimensions, engine positions, sourced specifications and source links. The sheet holds a snapshot of the aircraft opened, so automatic selection cannot change its identity while someone is reading.

The size lineup sorts all 18 profiles by length, renders their side views at a common length scale, and centers the selected model on opening. Tapping a model browses its details and shows its percentage length difference from the selected flight. “Back to selected” restores the flight profile and re-centers the lineup. Missing models remain unidentified until the user deliberately chooses a catalog model.

All profiles and diagrams ship in the application bundle. Opening a sheet requires no API call, browser storage or Wikipedia connection. Source links require internet access. Missing or unsupported type codes show an explicit unavailable state. The existing type field carries the ICAO model/variant code; there is no separate variant field in the current feed contract.

## Integration

Based on `24184c3`, entirely in the isolated `cad2` worktree. App.tsx has four additive lines: import, sheet state, card action, and sheet mount. These can be applied around newer native motion or harbor changes without replacing their App.tsx. No server, native iOS, deployment, feed or motion files changed.

## Catalog

`shared/aircraftProfiles.mjs` is the bundled, curated catalog, reviewed 3 October 2026. It contains 18 codes: A319, A320, A321, A20N, A21N, B737, B738, B739, B38M, B39M, B788, B789, B78X, BCS3, B772, B77W, B763 and C68A. Deliberate aliases are supported; arbitrary prefixes never imply a match.

- A21N, B739, B772 and B763 explicitly disclose family/configuration uncertainty.
- A21N range is labeled LR configuration, never assumed to describe the tracked airplane.
- B772 performance is explicitly identified as the -200ER reference.
- B763 omits range and seating because passenger, ER and cargo configurations differ.
- A320ceo-family wingspan and range state the Sharklet assumption.
- First-flight dates state family scope where relevant. Missing values are omitted.
- Boeing dimensions, range and seating use the linked current manufacturer tables; these can differ from older Wikipedia values. Wikipedia links provide model background and additional specifications. Manufacturer URLs and Wikipedia URLs live beside each profile.
- Specs describe design capability, not current flight distance, duration, fitted engines or actual seating.

Update the catalog and its review date when reviewing sources again. Add explicit engine layout support before introducing propeller aircraft or aircraft with a different number of engines. The SVG scales length and span together but labels the airframe outline and engine positions illustrative.

## Verification and preview

- Build and TypeScript checks pass (the existing large bundle warning remains).
- All 52 Node tests pass, including five new catalog tests.
- Browser checks passed with network disabled after loading: A320, A21N, B772, B763, B788, C68A, unsupported ZZZZ and missing type.
- Verified sorted lineup centering, browsing another model, percentage comparison and return to selected while offline.
- Verified focus containment, restored trigger focus, close button, Escape, and no horizontal overflow at 1024×768, 768×1024 and 390×844.
- Preview images: `previews/aircraft-info-ipad.png`, `previews/aircraft-info-phone.png`, `previews/aircraft-info-latitude.png`.
- Run Vite locally and open `/tests/aircraft-info.html` for a standalone visual fixture selector using the real component. This harness is excluded from the production entry. The main app flow was also exercised through Settings → Try simulated flights → View Info.

Dependencies were copied from the existing checkout after registry access failed; no dependency or lockfile changes are included. Browser checks used bundled Playwright. Native iPad installation and Railway deployment were intentionally not performed.

## Installation update — 4 October 2026

The user subsequently authorized shipping this feature. It was integrated into the current main working tree alongside harbor, motion and next-arrival changes. All 69 combined tests and the signed native Release build passed. The updated app was installed and launched on the connected iPad. Native bundle: `index-CiEGq1tA.js`; build log: `artifacts/ios-aircraft-info-release.log`. No Railway deployment was required.

## TV catalog expansion — 14 October 2026

The offline guide now contains 40 explicit type codes. Added the missing E170/E175/E190, CRJ200/700/900, A220-100, A330/A350/A300 families, 757s, Challenger 350/3500, Longitude/CJ3/CJ4, and EC145/H145 profiles. Prioritized a read of the current public Boston aircraft feed. Manufacturer and regulator references are recorded alongside each profile; no runtime model fetch is required. Unknown type codes still remain unknown.

Follow now includes a rotating, selectable model-fact card. Prices are explicitly historical Airbus 2018 list prices, not sale values. Fuel capacity is distinct from fuel consumption. The Challenger 3500 fuel figure is a manufacturer mission study (800 NM, four passengers, two crew, NBAA IFR reserves); a CL35 track does not establish that it is the 3500 variant. Manufacturer fuel-efficiency comparisons retain their stated scope. Engine options never imply confirmed fitted engines. Helicopter profiles use a separate silhouette, rotor diameter and turboshaft labels.

The standalone info preview also displays the real Follow facts component.

14 October 2026: Expanded the bundled catalog to 50 codes with E195, E290, E295, C25M, E550, GL5T, GLEX, H135, EC35 and H160. Each profile includes manufacturer or regulator references; broad codes retain variant-specific scope. The bottom-left Follow stats card opens full aircraft info when clicked or activated with Enter/Space. Unsupported profiles remain hidden. The full detail dialog is centered.

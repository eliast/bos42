import type { StyleSpecification } from 'maplibre-gl';

// OpenMapTiles layers from OpenFreeMap. All geography and building footprints
// come from the basemap; runway locations are never drawn from invented points.
export const airportStyle: StyleSpecification = {
  version: 8,
  name: 'BOS42 Airspace',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    world: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>' },
  },
  light: { anchor: 'viewport', color: '#d4e6e5', intensity: .52, position: [1.5, 210, 40] },
  sky: { 'sky-color': '#1f3643', 'horizon-color': '#8da9b0', 'fog-color': '#64818b', 'sky-horizon-blend': .55, 'horizon-fog-blend': .5, 'fog-ground-blend': .65 },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#263638' } },
    { id: 'landcover', type: 'fill', source: 'world', 'source-layer': 'landcover', paint: { 'fill-color': '#314a43', 'fill-opacity': .65 } },
    { id: 'parks', type: 'fill', source: 'world', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['park', 'grass', 'cemetery', 'recreation_ground']]], paint: { 'fill-color': '#3b5147' } },
    { id: 'airport-land', type: 'fill', source: 'world', 'source-layer': 'landuse', filter: ['==', ['get', 'class'], 'aerodrome'], paint: { 'fill-color': '#42524a' } },
    { id: 'water', type: 'fill', source: 'world', 'source-layer': 'water', paint: { 'fill-color': '#153b4b', 'fill-antialias': true } },
    { id: 'waterway', type: 'line', source: 'world', 'source-layer': 'waterway', paint: { 'line-color': '#153b4b', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 15, 6] } },
    { id: 'airfield', type: 'fill', source: 'world', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'class'], 'aerodrome']], paint: { 'fill-color': '#3c5148' } },
    { id: 'aprons', type: 'fill', source: 'world', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['in', ['get', 'class'], ['literal', ['apron', 'runway', 'taxiway', 'helipad']]]], paint: { 'fill-color': '#53605e', 'fill-opacity': .95 } },
    { id: 'roads', type: 'line', source: 'world', 'source-layer': 'transportation', filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'], ['!', ['in', ['get', 'class'], ['literal', ['rail', 'ferry']]]]], paint: { 'line-color': '#526363', 'line-opacity': .5, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, .25, 15, 3] } },
    { id: 'taxiways', type: 'line', source: 'world', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'taxiway']], paint: { 'line-color': '#738177', 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 10, .4, 14, 6, 18, 60] } },
    { id: 'runways', type: 'line', source: 'world', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'runway']], paint: { 'line-color': '#aab5af', 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 10, 1, 14, 10, 18, 140] } },
    { id: 'runway-asphalt', type: 'line', source: 'world', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'runway']], paint: { 'line-color': '#414d4b', 'line-width': ['interpolate', ['exponential', 2], ['zoom'], 10, .6, 14, 8.5, 18, 130] } },
    { id: 'runway-centerlines', type: 'line', minzoom: 12, source: 'world', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'runway']], paint: { 'line-color': '#e0e5d9', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, .8, 17, 2], 'line-dasharray': [4, 4] } },
    { id: 'buildings', type: 'fill-extrusion', minzoom: 11, source: 'world', 'source-layer': 'building', filter: ['!=', ['get', 'hide_3d'], true], paint: { 'fill-extrusion-color': '#718386', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .96, 'fill-extrusion-vertical-gradient': true } },
    { id: 'places', type: 'symbol', minzoom: 10, maxzoom: 16, source: 'world', 'source-layer': 'place', filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'neighbourhood']]], layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 15, 14], 'text-letter-spacing': .12, 'text-transform': 'uppercase', 'text-max-width': 8 }, paint: { 'text-color': '#cad8d7', 'text-halo-color': '#263d44', 'text-halo-width': 1.5, 'text-opacity': .8 } },
    { id: 'runway-names', type: 'symbol', minzoom: 13.4, source: 'world', 'source-layer': 'aeroway', filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'class'], 'runway']], layout: { 'text-field': ['get', 'ref'], 'symbol-placement': 'line-center', 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-letter-spacing': .15, 'text-offset': [0, 1.1] }, paint: { 'text-color': '#e6e5d8', 'text-halo-color': '#263d44', 'text-halo-width': 2 } },
    { id: 'airport-name', type: 'symbol', minzoom: 9, maxzoom: 14, source: 'world', 'source-layer': 'aerodrome_label', filter: ['==', ['get', 'iata'], 'BOS'], layout: { 'text-field': ['get', 'iata'], 'text-font': ['Noto Sans Bold'], 'text-size': 18, 'text-letter-spacing': .3 }, paint: { 'text-color': '#eef1df', 'text-halo-color': '#263d44', 'text-halo-width': 2 } },
  ],
};

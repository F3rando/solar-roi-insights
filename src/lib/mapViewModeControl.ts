import type { IControl, Map } from "maplibre-gl";

/** Matches initial map tilt in GeoMapLibreView. */
const DEFAULT_3D = { pitch: 52, bearing: -17 } as const;

/** Treat pitch at or below this as “flat / 2D” for toggle state. */
const FLAT_PITCH_MAX = 12;

/** Shown when flat — means “switch to 3D” (isometric box). */
const SVG_3D_ACTION = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

/** Shown when tilted — means “switch to 2D” (stacked layers / top-down). */
const SVG_2D_ACTION = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.83 2.18 8.56 3.9a1 1 0 0 1 0 1.83l-8.56 3.91a2 2 0 0 1-1.66 0l-8.58-3.91a1 1 0 0 1 0-1.83l8.58-3.9a2 2 0 0 1 1.66 0Z"/><path d="M2 12.5V20a1 1 0 0 0 .6.9l8.4 3.6a1 1 0 0 0 .6.1V12.4"/><path d="M22 12.5V20a1 1 0 0 1-.6.9l-8.4 3.6a1 1 0 0 1-.6.1V12.4"/></svg>`;

/**
 * Toggle between flat top-down (resetNorthPitch) and the dashboard’s default 3D camera.
 * Replaces relying on NavigationControl’s compass with visualizePitch, which always flattens
 * and cannot restore tilt on a second click.
 */
export class MapViewModeToggleControl implements IControl {
  _map: Map | undefined;
  _container: HTMLDivElement | undefined;
  _sync: (() => void) | undefined;

  onAdd(map: Map): HTMLElement {
    this._map = map;
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "maplibregl-ctrl-map-view-mode";

    const iconEl = document.createElement("span");
    iconEl.className = "maplibregl-ctrl-map-view-mode__icon";

    const labelEl = document.createElement("span");
    labelEl.className = "maplibregl-ctrl-map-view-mode__label";

    const subEl = document.createElement("span");
    subEl.className = "maplibregl-ctrl-map-view-mode__sub";

    const textCol = document.createElement("span");
    textCol.className = "maplibregl-ctrl-map-view-mode__text";

    button.appendChild(iconEl);
    textCol.appendChild(labelEl);
    textCol.appendChild(subEl);
    button.appendChild(textCol);

    const sync = () => {
      const flat = map.getPitch() <= FLAT_PITCH_MAX;
      iconEl.innerHTML = flat ? SVG_3D_ACTION : SVG_2D_ACTION;
      labelEl.textContent = flat ? "Go 3D" : "Go 2D";
      subEl.textContent = flat ? "Tilted terrain view" : "Top-down map";
      const label = flat
        ? "Switch to tilted 3D terrain view"
        : "Switch to flat top-down 2D map";
      button.title = label;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", flat ? "false" : "true");
    };

    button.addEventListener("click", () => {
      const flat = map.getPitch() <= FLAT_PITCH_MAX;
      if (flat) {
        map.easeTo({
          pitch: DEFAULT_3D.pitch,
          bearing: DEFAULT_3D.bearing,
          duration: 900,
        });
      } else {
        map.resetNorthPitch({ duration: 900 });
      }
    });

    map.on("pitch", sync);
    map.on("pitchend", sync);
    map.on("rotate", sync);

    this._sync = sync;
    sync();

    container.appendChild(button);
    this._container = container;
    return container;
  }

  onRemove(): void {
    const map = this._map;
    const sync = this._sync;
    if (map && sync) {
      map.off("pitch", sync);
      map.off("pitchend", sync);
      map.off("rotate", sync);
    }
    this._container?.remove();
    this._map = undefined;
    this._container = undefined;
    this._sync = undefined;
  }
}

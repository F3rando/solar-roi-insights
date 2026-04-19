/** Shared HTML for zone centroid popups (Leaflet + MapLibre). */
export function mapZonePopupHtml(
  name: string,
  score: number,
  n: number,
  m: {
    rankOneBased: number;
    payback: number;
    paybackStrength: number;
    adoptionStrength: number;
  },
  adoptionPct: string,
  sun: number | undefined,
): string {
  return `
          <div class="map-popup-glass font-sans antialiased">
            <div class="map-popup-glass-title">${name}</div>
            <div class="map-popup-glass-body">
              <strong>Heat score:</strong> ${(score * 100).toFixed(0)}% (50% modeled payback · 50% permit adoption vs other zones)<br/>
              <strong>Payback rank:</strong> ${m.rankOneBased} of ${n}<br/>
              <strong>Payback (scenario):</strong> ${m.payback.toFixed(1)} yr · model strength ${(m.paybackStrength * 100).toFixed(0)}%<br/>
              <strong>Adoption strength:</strong> ${(m.adoptionStrength * 100).toFixed(0)}% · idx ${adoptionPct}%<br/>
              ${sun != null ? `<strong>Google Solar sun:</strong> ${Math.round(sun)} h/yr<br/>` : ""}
            </div>
          </div>
        `;
}

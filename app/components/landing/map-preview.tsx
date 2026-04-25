export function MapPreview() {
  return (
    <div className="lp-shot-frame">
      <div className="lp-shot-toolbar">
        <div>
          <p className="lp-eyebrow text-[#f0c170]">Démo produit</p>
          <h3 className="mt-2 text-2xl font-black text-[#f8f4ed]">
            Carte humanitaire web
          </h3>
        </div>

        <div className="lp-shot-pill">
          Sénégal • priorisation régionale • couches OSM
        </div>
      </div>

      <div className="lp-shot-canvas">
        <div className="lp-shot-image-shell">
          <img
            alt="Capture de la démo OHM, Open Humanitarian Map, montrant les régions prioritaires, les points d'eau et les couches terrain."
            className="lp-shot-image"
            src="/demo-senegal.png"
          />
        </div>

        <div className="lp-shot-badge lp-shot-badge-right">
          IPC • population • routes • eau • villages
        </div>
      </div>
    </div>
  );
}

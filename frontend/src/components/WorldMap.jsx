import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { Globe, MapPin } from "lucide-react";
import COUNTRY_COORDS from "../data/countryCoordinates";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function WorldMap({ vpnConnections = [] }) {
  const [tooltip, setTooltip] = useState(null);

  // Group connections by country (deduplicate overlapping markers)
  const markers = useMemo(() => {
    const byCountry = {};
    for (const conn of vpnConnections) {
      const country = conn.country || conn.location;
      if (!country) continue;
      const coords = COUNTRY_COORDS[country];
      if (!coords) continue;
      const key = country;
      if (!byCountry[key]) {
        byCountry[key] = {
          country,
          coords: [coords[1], coords[0]], // [lng, lat] for react-simple-maps
          connections: [],
        };
      }
      byCountry[key].connections.push(conn);
    }
    return Object.values(byCountry);
  }, [vpnConnections]);

  return (
    <div className="bg-vpn-card border border-vpn-border rounded-xl p-5 relative">
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-4 h-4 text-vpn-primary" />
        <h3 className="text-sm font-semibold text-white">VPN Connection Map</h3>
        <span className="text-xs text-vpn-muted bg-vpn-input px-2 py-0.5 rounded-full ml-auto">
          {markers.length} {markers.length === 1 ? "location" : "locations"}
        </span>
      </div>

      <div className="rounded-lg overflow-hidden bg-vpn-bg/50 border border-vpn-border/50">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 130,
            center: [10, 30],
          }}
          width={900}
          height={420}
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#1a1a2e"
                    stroke="#2a2a3e"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#252540", outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Connection markers */}
            {markers.map((m) => (
              <Marker
                key={m.country}
                coordinates={m.coords}
                onMouseEnter={() => setTooltip(m)}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Outer pulse ring */}
                <circle
                  r={10}
                  fill="rgba(216, 237, 24, 0.15)"
                  className="animate-ping"
                  style={{ animationDuration: "2s" }}
                />
                {/* Middle glow */}
                <circle r={6} fill="rgba(216, 237, 24, 0.25)" />
                {/* Inner dot */}
                <circle
                  r={3.5}
                  fill="#d8ed18"
                  stroke="#030303"
                  strokeWidth={1}
                  className="cursor-pointer"
                />
                {/* Connection count badge */}
                {m.connections.length > 1 && (
                  <>
                    <circle
                      cx={7}
                      cy={-7}
                      r={6}
                      fill="#030303"
                      stroke="#d8ed18"
                      strokeWidth={0.8}
                    />
                    <text
                      x={7}
                      y={-4.5}
                      textAnchor="middle"
                      style={{
                        fontSize: "7px",
                        fill: "#d8ed18",
                        fontWeight: 700,
                      }}
                    >
                      {m.connections.length}
                    </text>
                  </>
                )}
              </Marker>
            ))}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 bg-vpn-card border border-vpn-border rounded-lg shadow-xl p-3 min-w-[200px]">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-3.5 h-3.5 text-vpn-primary" />
            <span className="text-sm font-semibold text-white">
              {tooltip.country}
            </span>
          </div>
          <div className="space-y-1.5">
            {tooltip.connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between gap-4 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      conn.vpnStatus === "running"
                        ? "bg-emerald-400"
                        : "bg-red-400"
                    }`}
                  />
                  <span className="text-vpn-text truncate">{conn.name}</span>
                </div>
                <span className="text-vpn-primary font-mono flex-shrink-0">
                  {conn.publicIp || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {markers.length > 0 && (
        <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-vpn-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-vpn-primary" />
            <span>Active VPN</span>
          </div>
          <span className="text-vpn-border">|</span>
          <span>Hover markers for details</span>
        </div>
      )}
    </div>
  );
}

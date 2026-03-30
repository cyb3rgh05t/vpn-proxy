import { useState, useMemo, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Line,
} from "react-simple-maps";
import { Globe, MapPin, Shield, Wifi, Server } from "lucide-react";

// Country name → [latitude, longitude] centroid mapping
const COUNTRY_COORDS = {
  Germany: [51.1657, 10.4515],
  Deutschland: [51.1657, 10.4515],
  France: [46.6034, 1.8883],
  "United Kingdom": [55.3781, -3.436],
  UK: [55.3781, -3.436],
  Netherlands: [52.1326, 5.2913],
  Belgium: [50.8503, 4.3517],
  Switzerland: [46.8182, 8.2275],
  Austria: [47.5162, 14.5501],
  Spain: [40.4637, -3.7492],
  Portugal: [39.3999, -8.2245],
  Italy: [41.8719, 12.5674],
  Sweden: [60.1282, 18.6435],
  Norway: [60.472, 8.4689],
  Denmark: [56.2639, 9.5018],
  Finland: [61.9241, 25.7482],
  Poland: [51.9194, 19.1451],
  "Czech Republic": [49.8175, 15.473],
  Czechia: [49.8175, 15.473],
  Hungary: [47.1625, 19.5033],
  Romania: [45.9432, 24.9668],
  Bulgaria: [42.7339, 25.4858],
  Greece: [39.0742, 21.8243],
  Ireland: [53.1424, -7.6921],
  Iceland: [64.9631, -19.0208],
  Luxembourg: [49.8153, 6.1296],
  Croatia: [45.1, 15.2],
  Serbia: [44.0165, 21.0059],
  Slovakia: [48.669, 19.699],
  Slovenia: [46.1512, 14.9955],
  Estonia: [58.5953, 25.0136],
  Latvia: [56.8796, 24.6032],
  Lithuania: [55.1694, 23.8813],
  Ukraine: [48.3794, 31.1656],
  Moldova: [47.4116, 28.3699],
  Albania: [41.1533, 20.1683],
  "North Macedonia": [41.5122, 21.7453],
  "Bosnia and Herzegovina": [43.9159, 17.6791],
  Montenegro: [42.7087, 19.3744],
  Malta: [35.9375, 14.3754],
  Cyprus: [35.1264, 33.4299],
  Belarus: [53.7098, 27.9534],
  "United States": [37.0902, -95.7129],
  US: [37.0902, -95.7129],
  USA: [37.0902, -95.7129],
  Canada: [56.1304, -106.3468],
  Mexico: [23.6345, -102.5528],
  "Costa Rica": [9.7489, -83.7534],
  Panama: [8.538, -80.7821],
  Brazil: [-14.235, -51.9253],
  Argentina: [-38.4161, -63.6167],
  Chile: [-35.6751, -71.543],
  Colombia: [4.5709, -74.2973],
  Peru: [-9.19, -75.0152],
  Venezuela: [6.4238, -66.5897],
  Ecuador: [-1.8312, -78.1834],
  Uruguay: [-32.5228, -55.7658],
  Japan: [36.2048, 138.2529],
  "South Korea": [35.9078, 127.7669],
  China: [35.8617, 104.1954],
  "Hong Kong": [22.3193, 114.1694],
  Taiwan: [23.6978, 120.9605],
  Singapore: [1.3521, 103.8198],
  India: [20.5937, 78.9629],
  Thailand: [15.87, 100.9925],
  Vietnam: [14.0583, 108.2772],
  Malaysia: [4.2105, 101.9758],
  Indonesia: [-0.7893, 113.9213],
  Philippines: [12.8797, 121.774],
  Pakistan: [30.3753, 69.3451],
  Bangladesh: [23.685, 90.3563],
  "Sri Lanka": [7.8731, 80.7718],
  Cambodia: [12.5657, 104.991],
  Myanmar: [21.9162, 95.956],
  Nepal: [28.3949, 84.124],
  Kazakhstan: [48.0196, 66.9237],
  Uzbekistan: [41.3775, 64.5853],
  Georgia: [42.3154, 43.3569],
  Armenia: [40.0691, 45.0382],
  Azerbaijan: [40.1431, 47.5769],
  Mongolia: [46.8625, 103.8467],
  Israel: [31.0461, 34.8516],
  Turkey: [38.9637, 35.2433],
  Türkiye: [38.9637, 35.2433],
  "United Arab Emirates": [23.4241, 53.8478],
  UAE: [23.4241, 53.8478],
  "Saudi Arabia": [23.8859, 45.0792],
  Qatar: [25.3548, 51.1839],
  Bahrain: [26.0667, 50.5577],
  Kuwait: [29.3117, 47.4818],
  Oman: [21.4735, 55.9754],
  Jordan: [30.5852, 36.2384],
  Lebanon: [33.8547, 35.8623],
  Iraq: [33.2232, 43.6793],
  Iran: [32.4279, 53.688],
  "South Africa": [-30.5595, 22.9375],
  Egypt: [26.8206, 30.8025],
  Nigeria: [9.082, 8.6753],
  Kenya: [-0.0236, 37.9062],
  Morocco: [31.7917, -7.0926],
  Tunisia: [33.8869, 9.5375],
  Algeria: [28.0339, 1.6596],
  Ghana: [7.9465, -1.0232],
  Ethiopia: [9.145, 40.4897],
  Tanzania: [-6.369, 34.8888],
  Australia: [-25.2744, 133.7751],
  "New Zealand": [-40.9006, 174.886],
  Russia: [61.524, 105.3188],
  "Russian Federation": [61.524, 105.3188],
};

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export default function WorldMap({ vpnConnections = [] }) {
  const [activeMarker, setActiveMarker] = useState(null);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  // Group connections by country
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
          coords: [coords[1], coords[0]],
          connections: [],
        };
      }
      byCountry[key].connections.push(conn);
    }
    return Object.values(byCountry);
  }, [vpnConnections]);

  // Set of active country names for highlighting
  const activeCountries = useMemo(() => {
    const set = new Set();
    markers.forEach((m) => {
      set.add(m.country);
      // Add common name variants
      if (m.country === "United States") set.add("United States of America");
      if (m.country === "US" || m.country === "USA")
        set.add("United States of America");
      if (m.country === "UK" || m.country === "United Kingdom")
        set.add("United Kingdom");
      if (m.country === "Czech Republic") set.add("Czechia");
      if (m.country === "Czechia") set.add("Czech Republic");
      if (m.country === "Russia") set.add("Russian Federation");
      if (m.country === "Türkiye") set.add("Turkey");
    });
    return set;
  }, [markers]);

  const isCountryActive = useCallback(
    (geo) => {
      const name = geo.properties?.name || geo.properties?.NAME || "";
      return activeCountries.has(name);
    },
    [activeCountries],
  );

  // Total unique IPs
  const uniqueIps = useMemo(() => {
    const ips = new Set();
    vpnConnections.forEach((c) => c.publicIp && ips.add(c.publicIp));
    return ips.size;
  }, [vpnConnections]);

  if (markers.length === 0) {
    return (
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-vpn-primary" />
          <h3 className="text-sm font-semibold text-white">
            VPN Connection Map
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-vpn-muted">
          <Globe className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No active VPN connections</p>
          <p className="text-xs mt-1 opacity-60">
            Start a container to see connections on the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-vpn-card border border-vpn-border rounded-2xl overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-vpn-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-vpn-primary/10 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-vpn-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white leading-none">
              VPN Connection Map
            </h3>
            <p className="text-[10px] text-vpn-muted mt-0.5">
              Real-time connection overview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-vpn-bg/80 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-vpn-muted font-medium">
              {markers.length} {markers.length === 1 ? "location" : "locations"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-vpn-bg/80 rounded-full">
            <Shield className="w-2.5 h-2.5 text-vpn-primary" />
            <span className="text-[10px] text-vpn-muted font-medium">
              {uniqueIps} {uniqueIps === 1 ? "IP" : "IPs"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-vpn-bg/80 rounded-full">
            <Server className="w-2.5 h-2.5 text-vpn-muted" />
            <span className="text-[10px] text-vpn-muted font-medium">
              {vpnConnections.length}{" "}
              {vpnConnections.length === 1 ? "tunnel" : "tunnels"}
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative">
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 pointer-events-none z-10">
          <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-vpn-card/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-vpn-card/80 to-transparent" />
          <div className="absolute top-0 left-0 bottom-0 w-6 bg-gradient-to-r from-vpn-card/60 to-transparent" />
          <div className="absolute top-0 right-0 bottom-0 w-6 bg-gradient-to-l from-vpn-card/60 to-transparent" />
        </div>

        <div className="bg-[#050510]">
          <ComposableMap
            projection="geoNaturalEarth1"
            projectionConfig={{
              scale: 120,
              center: [10, 10],
            }}
            width={960}
            height={420}
            style={{ width: "100%", height: "auto" }}
          >
            {/* SVG Defs for gradients and filters */}
            <defs>
              <radialGradient id="markerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#d8ed18" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#d8ed18" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#d8ed18" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="markerGlowHover" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#d8ed18" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#d8ed18" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#d8ed18" stopOpacity="0" />
              </radialGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d8ed18" stopOpacity="0" />
                <stop offset="50%" stopColor="#d8ed18" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#d8ed18" stopOpacity="0" />
              </linearGradient>
              {/* Grid pattern */}
              <pattern
                id="gridPattern"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="rgba(216, 237, 24, 0.03)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>

            {/* Background grid */}
            <rect width="960" height="420" fill="url(#gridPattern)" />

            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const active = isCountryActive(geo);
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={active ? "rgba(216, 237, 24, 0.12)" : "#0d0d1a"}
                      stroke={active ? "rgba(216, 237, 24, 0.35)" : "#1a1a2e"}
                      strokeWidth={active ? 0.8 : 0.3}
                      style={{
                        default: { outline: "none" },
                        hover: {
                          fill: active ? "rgba(216, 237, 24, 0.18)" : "#111125",
                          stroke: active
                            ? "rgba(216, 237, 24, 0.5)"
                            : "#252540",
                          strokeWidth: active ? 1 : 0.5,
                          outline: "none",
                        },
                        pressed: { outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>

            {/* Connection markers */}
            {markers.map((m) => {
              const isActive = activeMarker === m.country;
              const connCount = m.connections.length;

              return (
                <Marker
                  key={m.country}
                  coordinates={m.coords}
                  onMouseEnter={() => setActiveMarker(m.country)}
                  onMouseLeave={() => setActiveMarker(null)}
                >
                  {/* Outer radar sweep */}
                  <circle
                    r={isActive ? 22 : 16}
                    fill={
                      isActive ? "url(#markerGlowHover)" : "url(#markerGlow)"
                    }
                    style={{
                      transition: "r 0.3s ease",
                    }}
                  />

                  {/* Pulse ring animation */}
                  <circle
                    r={12}
                    fill="none"
                    stroke="rgba(216, 237, 24, 0.2)"
                    strokeWidth={0.5}
                    className="animate-ping"
                    style={{
                      animationDuration: "3s",
                      transformOrigin: "center",
                    }}
                  />

                  {/* Middle ring */}
                  <circle
                    r={isActive ? 7 : 5.5}
                    fill="rgba(216, 237, 24, 0.08)"
                    stroke="rgba(216, 237, 24, 0.3)"
                    strokeWidth={0.5}
                    style={{ transition: "r 0.2s ease" }}
                  />

                  {/* Core dot */}
                  <circle
                    r={isActive ? 4 : 3}
                    fill="#d8ed18"
                    filter="url(#glow)"
                    className="cursor-pointer"
                    style={{ transition: "r 0.2s ease" }}
                  />

                  {/* Inner bright spot */}
                  <circle
                    r={1.2}
                    fill="#fff"
                    opacity={isActive ? 0.9 : 0.6}
                    style={{ transition: "opacity 0.2s ease" }}
                  />

                  {/* Connection count badge */}
                  {connCount > 1 && (
                    <g transform="translate(8, -10)">
                      <rect
                        x={-7}
                        y={-6}
                        width={14}
                        height={12}
                        rx={4}
                        fill="#0a0a0a"
                        stroke="#d8ed18"
                        strokeWidth={0.6}
                      />
                      <text
                        textAnchor="middle"
                        y={2.5}
                        style={{
                          fontSize: "7px",
                          fill: "#d8ed18",
                          fontWeight: 700,
                          fontFamily: "monospace",
                        }}
                      >
                        {connCount}
                      </text>
                    </g>
                  )}
                </Marker>
              );
            })}
          </ComposableMap>
        </div>

        {/* Tooltip Overlay */}
        {activeMarker && (
          <div className="absolute top-4 right-4 z-20">
            {markers
              .filter((m) => m.country === activeMarker)
              .map((m) => (
                <div
                  key={m.country}
                  className="bg-vpn-card/95 backdrop-blur-md border border-vpn-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden min-w-[220px]"
                >
                  {/* Tooltip header */}
                  <div className="px-3.5 py-2.5 bg-vpn-primary/5 border-b border-vpn-border/50">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-vpn-primary" />
                      <span className="text-sm font-semibold text-white">
                        {m.country}
                      </span>
                    </div>
                    <p className="text-[10px] text-vpn-muted mt-0.5 ml-5.5">
                      {m.connections.length}{" "}
                      {m.connections.length === 1
                        ? "connection"
                        : "connections"}
                    </p>
                  </div>

                  {/* Connection list */}
                  <div className="p-2.5 space-y-1.5 max-h-[200px] overflow-y-auto">
                    {m.connections.map((conn) => (
                      <div
                        key={conn.id}
                        className="flex items-center gap-2.5 px-2.5 py-2 bg-vpn-bg/50 rounded-lg"
                      >
                        <div className="relative flex-shrink-0">
                          <span
                            className={`block w-2 h-2 rounded-full ${
                              conn.vpnStatus === "running"
                                ? "bg-emerald-400"
                                : "bg-red-400"
                            }`}
                          />
                          {conn.vpnStatus === "running" && (
                            <span className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-40" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white truncate leading-none">
                            {conn.name}
                          </p>
                          <p className="text-[10px] text-vpn-muted mt-0.5 capitalize">
                            {conn.provider} · {conn.vpnType || "—"}
                          </p>
                        </div>
                        <span className="text-[11px] text-vpn-primary font-mono flex-shrink-0">
                          {conn.publicIp || "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Bottom Stats Bar */}
      <div className="px-5 py-2.5 border-t border-vpn-border/50 bg-vpn-bg/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {markers.slice(0, 6).map((m) => (
              <button
                key={m.country}
                onMouseEnter={() => setActiveMarker(m.country)}
                onMouseLeave={() => setActiveMarker(null)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all ${
                  activeMarker === m.country
                    ? "bg-vpn-primary/10 text-vpn-primary"
                    : "text-vpn-muted hover:text-vpn-text hover:bg-vpn-input"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeMarker === m.country
                      ? "bg-vpn-primary"
                      : "bg-vpn-muted"
                  }`}
                />
                <span className="font-medium">{m.country}</span>
                {m.connections.length > 1 && (
                  <span className="text-[9px] opacity-60">
                    ×{m.connections.length}
                  </span>
                )}
              </button>
            ))}
            {markers.length > 6 && (
              <span className="text-[10px] text-vpn-muted">
                +{markers.length - 6} more
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-vpn-muted">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>All tunnels secured</span>
          </div>
        </div>
      </div>
    </div>
  );
}

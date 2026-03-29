import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { Globe, MapPin } from "lucide-react";

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
    <div className="bg-vpn-card border border-vpn-border rounded-xl p-4 relative">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-3.5 h-3.5 text-vpn-primary" />
        <h3 className="text-xs font-semibold text-white">VPN Connection Map</h3>
        <span className="text-[10px] text-vpn-muted bg-vpn-input px-1.5 py-0.5 rounded-full ml-auto">
          {markers.length} {markers.length === 1 ? "location" : "locations"}
        </span>
      </div>

      <div className="rounded-lg overflow-hidden bg-vpn-bg/50 border border-vpn-border/50">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 90,
            center: [10, 45],
          }}
          width={900}
          height={200}
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
                  r={8}
                  fill="rgba(216, 237, 24, 0.15)"
                  className="animate-ping"
                  style={{ animationDuration: "2s" }}
                />
                {/* Middle glow */}
                <circle r={5} fill="rgba(216, 237, 24, 0.25)" />
                {/* Inner dot */}
                <circle
                  r={3}
                  fill="#d8ed18"
                  stroke="#030303"
                  strokeWidth={0.8}
                  className="cursor-pointer"
                />
                {/* Connection count badge */}
                {m.connections.length > 1 && (
                  <>
                    <circle
                      cx={6}
                      cy={-6}
                      r={5}
                      fill="#030303"
                      stroke="#d8ed18"
                      strokeWidth={0.7}
                    />
                    <text
                      x={6}
                      y={-3.8}
                      textAnchor="middle"
                      style={{
                        fontSize: "6px",
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
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 bg-vpn-card border border-vpn-border rounded-lg shadow-xl p-2.5 min-w-[180px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MapPin className="w-3 h-3 text-vpn-primary" />
            <span className="text-xs font-semibold text-white">
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
        <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-vpn-muted">
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

export const APP_TEMPLATES = [
  {
    id: "qbittorrent",
    title: "qBittorrent",
    subtitle: "Torrent client behind VPN",
    image: "linuxserver/qbittorrent:latest",
    suggestedName: "app-qbittorrent",
    restartPolicy: "unless-stopped",
    envVars: [
      { key: "PUID", value: "1000" },
      { key: "PGID", value: "1000" },
      { key: "TZ", value: "Europe/Berlin" },
      { key: "WEBUI_PORT", value: "8080" },
    ],
    ports: [{ host: "8080", container: "8080", protocol: "tcp" }],
    volumes: [
      { source: "", target: "/config", mode: "rw" },
      { source: "", target: "/downloads", mode: "rw" },
    ],
  },
  {
    id: "prowlarr",
    title: "Prowlarr",
    subtitle: "Indexer manager",
    image: "linuxserver/prowlarr:latest",
    suggestedName: "app-prowlarr",
    restartPolicy: "unless-stopped",
    envVars: [
      { key: "PUID", value: "1000" },
      { key: "PGID", value: "1000" },
      { key: "TZ", value: "Europe/Berlin" },
    ],
    ports: [{ host: "9696", container: "9696", protocol: "tcp" }],
    volumes: [{ source: "", target: "/config", mode: "rw" }],
  },
  {
    id: "sonarr",
    title: "Sonarr",
    subtitle: "TV library manager",
    image: "linuxserver/sonarr:latest",
    suggestedName: "app-sonarr",
    restartPolicy: "unless-stopped",
    envVars: [
      { key: "PUID", value: "1000" },
      { key: "PGID", value: "1000" },
      { key: "TZ", value: "Europe/Berlin" },
    ],
    ports: [{ host: "8989", container: "8989", protocol: "tcp" }],
    volumes: [
      { source: "", target: "/config", mode: "rw" },
      { source: "", target: "/tv", mode: "rw" },
      { source: "", target: "/downloads", mode: "rw" },
    ],
  },
  {
    id: "radarr",
    title: "Radarr",
    subtitle: "Movie library manager",
    image: "linuxserver/radarr:latest",
    suggestedName: "app-radarr",
    restartPolicy: "unless-stopped",
    envVars: [
      { key: "PUID", value: "1000" },
      { key: "PGID", value: "1000" },
      { key: "TZ", value: "Europe/Berlin" },
    ],
    ports: [{ host: "7878", container: "7878", protocol: "tcp" }],
    volumes: [
      { source: "", target: "/config", mode: "rw" },
      { source: "", target: "/movies", mode: "rw" },
      { source: "", target: "/downloads", mode: "rw" },
    ],
  },
  {
    id: "jellyfin",
    title: "Jellyfin",
    subtitle: "Media server",
    image: "linuxserver/jellyfin:latest",
    suggestedName: "app-jellyfin",
    restartPolicy: "unless-stopped",
    envVars: [
      { key: "PUID", value: "1000" },
      { key: "PGID", value: "1000" },
      { key: "TZ", value: "Europe/Berlin" },
    ],
    ports: [
      { host: "8096", container: "8096", protocol: "tcp" },
      { host: "8920", container: "8920", protocol: "tcp" },
    ],
    volumes: [
      { source: "", target: "/config", mode: "rw" },
      { source: "", target: "/data/media", mode: "rw" },
    ],
  },
  {
    id: "plex",
    title: "Plex Media Server",
    subtitle: "Stream your media library behind VPN (blocks analytics)",
    image: "linuxserver/plex:latest",
    suggestedName: "app-plex",
    restartPolicy: "unless-stopped",
    envVars: [
      { key: "PUID", value: "1000" },
      { key: "PGID", value: "1000" },
      { key: "TZ", value: "Europe/Berlin" },
      { key: "VERSION", value: "docker" },
    ],
    ports: [{ host: "32400", container: "32400", protocol: "tcp" }],
    volumes: [
      { source: "", target: "/config", mode: "rw" },
      { source: "", target: "/tv", mode: "ro" },
      { source: "", target: "/movies", mode: "ro" },
    ],
    devices: ["/dev/dri:/dev/dri"],
  },
];

export const getTemplateById = (id) =>
  APP_TEMPLATES.find(
    (tpl) =>
      tpl.id ===
      String(id || "")
        .trim()
        .toLowerCase(),
  );

# VPN Proxy Manager

Web UI Dashboard zum Erstellen und Verwalten von [Gluetun](https://github.com/qdm12/gluetun) VPN Docker Containern.

## Features

- **Login System** — Erster Benutzer wird automatisch Admin
- **VPN Container erstellen** — Gluetun Container per Klick anlegen
- **11 VPN Provider** — AirVPN, Cyberghost, ExpressVPN, IVPN, Mullvad, NordVPN, PIA, ProtonVPN, Surfshark, Windscribe, Custom
- **OpenVPN & WireGuard** — Beide Protokolle unterstützt
- **Container verwalten** — Start, Stop, Restart, Löschen, Logs anzeigen
- **Docker Compose Export** — Compose-YAML für jeden Container generieren
- **Passwort ändern** — Über die Settings-Seite

## Architektur

Alles läuft in **einem einzigen Docker Container** auf Port `8000`:

```
┌──────────────────────────────────────┐
│          VPN Proxy Manager           │
│              Port 8000               │
│                                      │
│  ┌──────────┐    ┌────────────────┐  │
│  │ FastAPI   │    │  React SPA     │  │
│  │ Backend   │    │  (Static)      │  │
│  │ /api/*    │    │  /*            │  │
│  └──────────┘    └────────────────┘  │
│       │                              │
│  ┌──────────┐    ┌────────────────┐  │
│  │ SQLite   │    │ Docker Socket  │  │
│  │ Database │    │ (Container     │  │
│  │          │    │  Management)   │  │
│  └──────────┘    └────────────────┘  │
└──────────────────────────────────────┘
         │
         ▼
┌─────────────────┐  ┌─────────────────┐
│ gluetun-vpn1    │  │ gluetun-vpn2    │
│ :8888 HTTP Proxy│  │ :8889 HTTP Proxy│
│ :8388 SOCKS     │  │ :8389 SOCKS     │
│ :8001 Control   │  │ :8002 Control   │
└─────────────────┘  └─────────────────┘
```

### Tech Stack

| Komponente | Technologie                                         |
| ---------- | --------------------------------------------------- |
| Backend    | Python 3.13, FastAPI, SQLAlchemy, python-jose (JWT) |
| Frontend   | React 18, Vite, TailwindCSS, Lucide Icons           |
| Datenbank  | SQLite                                              |
| Container  | Docker SDK for Python                               |
| Auth       | JWT (HS256) + bcrypt                                |

## Installation

### Docker (empfohlen)

```yaml
version: "3"
services:
  vpn-proxy:
    hostname: "vpn-proxy"
    container_name: "vpn-proxy"
    environment:
      - "PGID=${ID}"
      - "PUID=${ID}"
      - "TZ=${TZ}"
      - "SECRET_KEY=${SECRET_KEY}"
      - "DATABASE_URL=sqlite:///./data/vpnproxy.db"
      - "GLUETUN_IMAGE=qmcgaw/gluetun:latest"
    image: "ghcr.io/cyb3rgh05t/vpn-proxy:latest"
    restart: "${RESTARTAPP}"
    networks:
      - ${DOCKERNETWORK}
    ports:
      - "8000:8000"
    security_opt:
      - "${SECURITYOPS}:${SECURITYOPSSET}"
    volumes:
      - "${APPFOLDER}/vpn-proxy/data:/app/data"
      - "/var/run/docker.sock:/var/run/docker.sock"
    labels:
      - "dockupdater.enable=true"
networks:
  proxy:
    driver: bridge
    external: true
```

### Docker (einfach)

```yaml
services:
  vpn-proxy:
    image: ghcr.io/cyb3rgh05t/vpn-proxy:latest
    container_name: vpn-proxy
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - SECRET_KEY=dein-geheimer-schlüssel
    restart: unless-stopped
```

```bash
docker compose up -d
```

Dann öffne **http://localhost:8000**.

### Lokal (Entwicklung)

#### Voraussetzungen

- Python 3.10+
- Node.js 18+
- Docker (muss laufen)

#### Setup

**PowerShell:**

```powershell
./setup.ps1
```

**Linux/Mac:**

```bash
chmod +x setup.sh
./setup.sh
```

#### Starten

**PowerShell:**

```powershell
./start.ps1
```

**Linux/Mac:**

```bash
chmod +x start.sh
./start.sh
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Erster Start

1. Öffne die WebUI (http://localhost:8000)
2. Du wirst zur **Registrierung** weitergeleitet
3. Erstelle den ersten Benutzer — dieser wird automatisch **Admin**
4. Nach dem Login siehst du das **Dashboard**

## Benutzung

### VPN Container erstellen

1. Klick auf **"Create Container"** im Dashboard
2. **Name** vergeben (z.B. `mullvad-de`)
3. **VPN Provider** wählen (z.B. Mullvad)
4. **Protokoll** wählen (OpenVPN oder WireGuard)
5. **Zugangsdaten** eingeben (je nach Provider unterschiedlich)
6. **Server Land/Region** optional angeben
7. **Ports** anpassen falls nötig:
   - HTTP Proxy: Standard `8888`
   - Shadowsocks: Standard `8388`
   - Control: Standard `8001`
8. **Create** klicken — der Gluetun Container wird erstellt und gestartet

### Container verwalten

Auf der **Detailseite** eines Containers kannst du:

- **Status** sehen (running, stopped, etc.)
- **IP-Adresse** des VPN-Tunnels sehen
- **Start / Stop / Restart** — Container steuern
- **Logs** anzeigen — Die letzten 200 Zeilen
- **Compose Export** — Docker-Compose YAML kopieren
- **Löschen** — Container und Konfiguration entfernen

### Einstellungen

Unter **Settings** kannst du dein Passwort ändern.

## Unterstützte VPN Provider

| Provider                | OpenVPN | WireGuard |
| ----------------------- | ------- | --------- |
| AirVPN                  | ✅      | ✅        |
| Cyberghost              | ✅      | ❌        |
| ExpressVPN              | ✅      | ❌        |
| IVPN                    | ✅      | ✅        |
| Mullvad                 | ✅      | ✅        |
| NordVPN                 | ✅      | ✅        |
| Private Internet Access | ✅      | ✅        |
| ProtonVPN               | ✅      | ✅        |
| Surfshark               | ✅      | ✅        |
| Windscribe              | ✅      | ✅        |
| Custom                  | ✅      | ✅        |

## Ports

| Port   | Dienst                     | Beschreibung              |
| ------ | -------------------------- | ------------------------- |
| `8000` | VPN Proxy Manager          | WebUI + API               |
| `8888` | Gluetun HTTP Proxy         | Pro Container (anpassbar) |
| `8388` | Gluetun Shadowsocks/SOCKS5 | Pro Container (anpassbar) |
| `8001` | Gluetun API                | Pro Container (anpassbar) |

> **Wichtig:** Jeder Gluetun Container braucht eigene Ports. Bei mehreren Containern die Ports hochzählen (8888, 8889, 8890...).

## Environment Variables

| Variable                      | Standard                       | Beschreibung                                 |
| ----------------------------- | ------------------------------ | -------------------------------------------- |
| `SECRET_KEY`                  | —                              | JWT Signierungsschlüssel (unbedingt setzen!) |
| `DATABASE_URL`                | `sqlite:///./data/vpnproxy.db` | Datenbank-Pfad                               |
| `GLUETUN_IMAGE`               | `qmcgaw/gluetun:latest`        | Gluetun Docker Image                         |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24h)                   | Token-Gültigkeit                             |
| `TZ`                          | —                              | Zeitzone (z.B. `Europe/Berlin`)              |

## API Endpunkte

| Methode  | Pfad                           | Beschreibung              |
| -------- | ------------------------------ | ------------------------- |
| `POST`   | `/api/auth/register`           | Benutzer registrieren     |
| `POST`   | `/api/auth/login`              | Einloggen (JWT Token)     |
| `GET`    | `/api/auth/setup-status`       | Prüfen ob Setup nötig     |
| `POST`   | `/api/auth/change-password`    | Passwort ändern           |
| `GET`    | `/api/containers`              | Alle Container auflisten  |
| `POST`   | `/api/containers`              | Neuen Container erstellen |
| `GET`    | `/api/containers/{id}`         | Container-Details         |
| `PUT`    | `/api/containers/{id}`         | Container aktualisieren   |
| `DELETE` | `/api/containers/{id}`         | Container löschen         |
| `POST`   | `/api/containers/{id}/start`   | Container starten         |
| `POST`   | `/api/containers/{id}/stop`    | Container stoppen         |
| `POST`   | `/api/containers/{id}/restart` | Container neustarten      |
| `GET`    | `/api/containers/{id}/logs`    | Container Logs            |
| `GET`    | `/api/containers/{id}/status`  | Container Status          |
| `GET`    | `/api/containers/{id}/compose` | Compose YAML exportieren  |
| `GET`    | `/api/providers`               | VPN Provider auflisten    |
| `GET`    | `/api/providers/{key}`         | Provider-Details + Felder |
| `GET`    | `/api/health`                  | Health Check              |

Interaktive API Docs: http://localhost:8000/docs

## Projektstruktur

```
vpn-proxy/
├── Dockerfile              # Multi-Stage Build (Frontend + Backend)
├── docker-compose.yml      # Production Compose
├── .dockerignore
├── .github/workflows/
│   └── release.yaml        # CI/CD → ghcr.io
├── setup.ps1 / setup.sh    # Dev Setup Scripts
├── start.ps1 / start.sh    # Dev Start Scripts
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # FastAPI App + Static File Serving
│       ├── config.py        # Settings (Pydantic)
│       ├── database.py      # SQLAlchemy + SQLite
│       ├── models/          # DB Models (User, VPNContainer)
│       ├── schemas/         # Pydantic Schemas (Request/Response)
│       ├── routers/         # API Routes (Auth, Containers)
│       ├── services/        # Business Logic (Docker, Auth, Providers)
│       └── utils/           # Security (JWT, bcrypt)
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx          # React Router Setup
        ├── context/         # AuthContext (Login State)
        ├── components/      # Layout, Sidebar, Cards, StatusBadge
        ├── pages/           # Login, Dashboard, CreateContainer, Detail, Settings
        └── services/        # Axios API Client
```

## Volumes

| Container-Pfad         | Beschreibung                             |
| ---------------------- | ---------------------------------------- |
| `/app/data`            | SQLite Datenbank + Gluetun Configs       |
| `/var/run/docker.sock` | Docker Socket (für Container-Management) |

## Lizenz

MIT

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Shield,
  Boxes,
  Activity,
  Settings,
  LayoutDashboard,
  Globe,
  ArrowRight,
} from "lucide-react";

const sections = [
  {
    id: "getting-started",
    icon: BookOpen,
    title: "Getting Started",
    subsections: [
      {
        id: "first-login",
        title: "First Login & Setup",
        content: [
          {
            type: "text",
            value:
              "When you open the VPN Proxy Manager for the first time, you'll be guided through the initial setup process.",
          },
          {
            type: "steps",
            items: [
              "Open the VPN Proxy Manager in your browser.",
              'The system automatically detects it\'s a fresh install and shows the "Setup" screen.',
              "Choose a username and a strong password for your admin account.",
              'Click "Create Account" to create the initial admin user.',
              "You'll be automatically logged in and redirected to the Dashboard.",
            ],
          },
          {
            type: "tip",
            value:
              "Keep your admin credentials safe. You can change them later in Settings.",
          },
        ],
      },
      {
        id: "login",
        title: "Logging In",
        content: [
          {
            type: "steps",
            items: [
              "Navigate to the VPN Proxy Manager URL in your browser.",
              "Enter your username and password.",
              'Click "Login" to access the dashboard.',
            ],
          },
        ],
      },
      {
        id: "navigation",
        title: "Navigation Overview",
        content: [
          {
            type: "text",
            value:
              "The sidebar on the left provides access to all sections of the application:",
          },
          {
            type: "list",
            items: [
              {
                bold: "Dashboard",
                text: "— System overview with stats, maps, and provider summaries.",
              },
              {
                bold: "VPN-Proxy",
                text: "— Manage all Gluetun VPN containers.",
              },
              { bold: "O11", text: "— Manage O11 application containers." },
              {
                bold: "Monitoring",
                text: "— Real-time stream and network monitoring.",
              },
              { bold: "New VPN-Proxy", text: "— Create a new VPN container." },
              { bold: "New O11", text: "— Create a new O11 container." },
              {
                bold: "Settings",
                text: "— System settings, users, API keys, and monitoring config.",
              },
            ],
          },
          {
            type: "tip",
            value:
              "On mobile devices, tap the menu icon (☰) in the top-left corner to open the sidebar.",
          },
        ],
      },
    ],
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    subsections: [
      {
        id: "dashboard-overview",
        title: "Understanding the Dashboard",
        content: [
          {
            type: "text",
            value:
              "The Dashboard gives you a comprehensive overview of your entire VPN infrastructure at a glance.",
          },
          {
            type: "list",
            items: [
              {
                bold: "Gluetun VPN Stats",
                text: "— Total, running, connected, disconnected, unhealthy, and stopped container counts.",
              },
              {
                bold: "O11 Stats",
                text: "— Total, running, and stopped O11 container counts (if any exist).",
              },
              {
                bold: "World Map",
                text: "— Geographic visualization of all active VPN connections.",
              },
              {
                bold: "Provider Overview",
                text: "— Detailed breakdown per VPN provider with connection status, countries, proxy count, and more.",
              },
              {
                bold: "Active Connections",
                text: "— List of all running containers with VPN details, IPs, proxy URLs, and dependent containers.",
              },
            ],
          },
        ],
      },
      {
        id: "dashboard-actions",
        title: "Dashboard Actions",
        content: [
          {
            type: "list",
            items: [
              {
                bold: "Discover",
                text: "— Automatically scan Docker for unregistered containers and add them to the manager.",
              },
              {
                bold: "Refresh",
                text: "— Manually refresh all container data and VPN status information.",
              },
              {
                bold: "New VPN-Proxy",
                text: "— Quick shortcut to create a new VPN container.",
              },
              {
                bold: "New O11",
                text: "— Quick shortcut to create a new O11 container.",
              },
            ],
          },
          {
            type: "tip",
            value:
              "Click on a VPN provider card to navigate directly to the VPN-Proxy page filtered by that provider.",
          },
        ],
      },
    ],
  },
  {
    id: "vpn-proxy",
    icon: Shield,
    title: "VPN-Proxy Containers",
    subsections: [
      {
        id: "vpn-create",
        title: "Creating a VPN Container",
        content: [
          {
            type: "text",
            value:
              'Navigate to "New VPN-Proxy" from the sidebar or dashboard to create a new Gluetun VPN container.',
          },
          {
            type: "steps",
            items: [
              "Enter a container name (lowercase, numbers, hyphens, underscores only).",
              "Select a Docker network (or use default).",
              "Choose your VPN provider from the dropdown.",
              "Select the VPN type: OpenVPN or WireGuard.",
              "Fill in the required provider-specific configuration fields (credentials, server, etc.).",
              "Optionally enable HTTP Proxy (default port 8888) with custom authentication.",
              "Optionally enable Shadowsocks (default port 8388) with a password.",
              "Expand Advanced Settings to configure additional Gluetun environment variables if needed.",
              "Add extra port mappings if your setup requires them.",
              "Upload any configuration files (e.g., .conf files) if needed.",
              'Click "Create Container" to deploy.',
            ],
          },
          {
            type: "tip",
            value:
              "The form dynamically loads provider-specific fields. Required fields are marked and validated before submission.",
          },
        ],
      },
      {
        id: "vpn-browse",
        title: "Browsing & Filtering Containers",
        content: [
          {
            type: "text",
            value:
              "The VPN-Proxy page shows all your Gluetun VPN containers with powerful search and filtering.",
          },
          {
            type: "list",
            items: [
              {
                bold: "Search",
                text: "— Type to search by container name, provider, VPN type, or description.",
              },
              {
                bold: "Provider Tabs",
                text: '— Click provider tabs (e.g., "Surfshark", "NordVPN") to filter by specific provider.',
              },
              {
                bold: "Status Filter",
                text: "— Click any stat card (Running, Connected, Stopped, etc.) to filter by that status.",
              },
            ],
          },
          {
            type: "text",
            value:
              'Containers are grouped into "Proxy-enabled Containers" (with HTTP Proxy or Shadowsocks) and "VPN-only Containers".',
          },
        ],
      },
      {
        id: "vpn-detail",
        title: "Container Detail & Management",
        content: [
          {
            type: "text",
            value:
              "Click on any container card to open its detail page with full management capabilities.",
          },
          {
            type: "subtitle",
            value: "Container Actions",
          },
          {
            type: "list",
            items: [
              {
                bold: "Start / Stop / Restart",
                text: "— Control the container's running state.",
              },
              {
                bold: "Edit & Redeploy",
                text: "— Modify environment variables, ports, proxy settings, then redeploy the container.",
              },
              {
                bold: "Export Compose",
                text: "— Download a docker-compose.yml file for the container configuration.",
              },
              {
                bold: "Delete",
                text: "— Permanently remove the container (with confirmation dialog).",
              },
            ],
          },
          {
            type: "subtitle",
            value: "Information Tab",
          },
          {
            type: "list",
            items: [
              {
                bold: "VPN Status",
                text: "— Connection status, public IP, geographic location, port forwarding.",
              },
              {
                bold: "Proxy URLs",
                text: "— HTTP Proxy and Shadowsocks URLs with copy-to-clipboard buttons.",
              },
              {
                bold: "Dependent Containers",
                text: "— All containers routed through this VPN with individual actions.",
              },
              {
                bold: "Environment Variables",
                text: "— Full list of container environment configuration.",
              },
            ],
          },
          {
            type: "subtitle",
            value: "Files Tab",
          },
          {
            type: "list",
            items: [
              {
                bold: "Upload",
                text: "— Upload configuration files to the container.",
              },
              {
                bold: "View / Delete",
                text: "— Manage uploaded configuration files.",
              },
            ],
          },
          {
            type: "subtitle",
            value: "Logs Tab",
          },
          {
            type: "text",
            value:
              "View real-time container logs. Logs auto-refresh when you switch to this tab.",
          },
        ],
      },
      {
        id: "vpn-description",
        title: "Adding a Description",
        content: [
          {
            type: "steps",
            items: [
              "Open the container detail page.",
              'Click the description field below the container name (it shows "Add a description..." as placeholder).',
              "Type your description.",
              "Click outside the field or press Tab — the description is saved automatically.",
              "To remove a description, clear the text and click outside the field.",
            ],
          },
        ],
      },
      {
        id: "vpn-redeploy",
        title: "Editing & Redeploying",
        content: [
          {
            type: "text",
            value:
              "The Edit & Redeploy feature lets you modify a container's configuration and redeploy it with the new settings.",
          },
          {
            type: "steps",
            items: [
              'Click "Edit & Redeploy" in the container detail page.',
              "In the modal, you can modify:",
              "  • Container name (renaming is supported)",
              "  • Environment variables (add, edit, or remove)",
              "  • Extra port mappings",
              "  • HTTP Proxy and Shadowsocks settings",
              "  • Upload new configuration files",
              'Click "Redeploy" to apply changes.',
              "The container will be recreated with the new configuration.",
            ],
          },
          {
            type: "warning",
            value:
              "Redeploying a VPN container will briefly interrupt connectivity for all dependent containers.",
          },
        ],
      },
      {
        id: "vpn-export",
        title: "Exporting Container Config",
        content: [
          {
            type: "steps",
            items: [
              "Open the container detail page.",
              'Click the "Export Compose" button.',
              "A docker-compose.yml file will be downloaded to your device.",
              "You can use this file to recreate the container on another system.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "o11",
    icon: Boxes,
    title: "O11 Containers",
    subsections: [
      {
        id: "o11-create",
        title: "Creating an O11 Container",
        content: [
          {
            type: "text",
            value:
              'Navigate to "New O11" from the sidebar or dashboard to create a new O11 application container.',
          },
          {
            type: "steps",
            items: [
              "Enter a container name.",
              "Specify the Docker image to use.",
              "Configure environment variables as needed.",
              "Set up port mappings (host port → container port with protocol).",
              "Add volume mounts if needed.",
              "Set a restart policy.",
              "Optionally provide a startup command.",
              'Click "Create" to deploy the container.',
            ],
          },
        ],
      },
      {
        id: "o11-browse",
        title: "Browsing O11 Containers",
        content: [
          {
            type: "text",
            value:
              "The O11 page displays all your O11 application containers with filtering options.",
          },
          {
            type: "list",
            items: [
              {
                bold: "Search",
                text: "— Filter by name, image, or VPN parent.",
              },
              {
                bold: "Status Filters",
                text: "— Click stat cards to filter by Running, Stopped, VPN Routed, Proxy Connected, or Proxied.",
              },
            ],
          },
          {
            type: "text",
            value:
              "Each card shows the container's name, description badge, image, network mode, VPN status (if routed), and port mappings.",
          },
        ],
      },
      {
        id: "o11-network",
        title: "Changing Network Mode (VPN Routing)",
        content: [
          {
            type: "text",
            value:
              "You can route an O11 container's traffic through a VPN container or connect it to a specific Docker network.",
          },
          {
            type: "steps",
            items: [
              "Open the O11 container detail page.",
              'Click "Change Network Mode".',
              "In the modal, choose one of:",
              "  • A Gluetun VPN container — routes all traffic through that VPN",
              "  • A Docker network — connects the container to that network",
              "Confirm the change.",
              "The container will be restarted with the new network configuration.",
            ],
          },
          {
            type: "tip",
            value:
              "When routed through a VPN, the O11 container detail page shows the VPN status, public IP, and location information.",
          },
        ],
      },
      {
        id: "o11-redeploy",
        title: "Editing & Redeploying O11 Containers",
        content: [
          {
            type: "steps",
            items: [
              'Click "Edit & Redeploy" in the O11 container detail page.',
              "In the modal you can modify:",
              "  • Docker image",
              "  • Startup command",
              "  • Restart policy (no, always, unless-stopped, on-failure)",
              "  • Environment variables (add/remove key-value pairs)",
              "  • Port mappings (add/remove host→container with protocol)",
              "  • Volume mounts (add/remove source→target with mode)",
              'Click "Redeploy" to recreate the container with new settings.',
            ],
          },
          {
            type: "warning",
            value:
              "Redeploying recreates the container. The old container is removed and a new one is created. Network mode and labels are preserved.",
          },
        ],
      },
      {
        id: "o11-detail",
        title: "O11 Container Detail",
        content: [
          {
            type: "text",
            value:
              "The O11 container detail page provides full management similar to VPN containers.",
          },
          {
            type: "subtitle",
            value: "Available Tabs",
          },
          {
            type: "list",
            items: [
              {
                bold: "Information",
                text: "— Container details, network config, VPN routing info, ports, volumes, and environment variables.",
              },
              {
                bold: "Files",
                text: "— Upload files to the container specifying a target path, list and delete uploaded files.",
              },
              {
                bold: "Logs",
                text: "— View real-time container logs with auto-refresh.",
              },
            ],
          },
          {
            type: "subtitle",
            value: "Available Actions",
          },
          {
            type: "list",
            items: [
              {
                bold: "Start / Stop / Restart",
                text: "— Control the container state.",
              },
              {
                bold: "Change Network Mode",
                text: "— Route through VPN or connect to a network.",
              },
              {
                bold: "Edit & Redeploy",
                text: "— Modify and recreate the container.",
              },
              { bold: "Delete", text: "— Permanently remove the container." },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "monitoring",
    icon: Activity,
    title: "Monitoring",
    subsections: [
      {
        id: "monitoring-setup",
        title: "Setting Up Monitoring",
        content: [
          {
            type: "text",
            value:
              "Before using the Monitoring page, you need to configure at least one O11 instance.",
          },
          {
            type: "steps",
            items: [
              "Go to Settings → Monitoring tab.",
              'Click "Add Instance".',
              "Enter the instance name, O11 panel URL, username, and password.",
              "Select the Provider ID for this instance.",
              'Click "Add" to save the instance.',
              'Click "Test" to verify the connection.',
              "Navigate to the Monitoring page — your data will now appear.",
            ],
          },
        ],
      },
      {
        id: "monitoring-instances",
        title: "Managing Multiple Instances",
        content: [
          {
            type: "text",
            value:
              "You can configure multiple O11 instances for monitoring. When more than one instance is configured, a tab selector appears at the top of the Monitoring page.",
          },
          {
            type: "list",
            items: [
              {
                bold: "Switch Instance",
                text: "— Click an instance tab to view its data.",
              },
              {
                bold: "Edit Instance",
                text: "— Go to Settings → Monitoring, click the edit button on an instance.",
              },
              {
                bold: "Delete Instance",
                text: "— Click the delete button (with confirmation) to remove an instance.",
              },
            ],
          },
        ],
      },
      {
        id: "monitoring-network",
        title: "Network Usage Tab",
        content: [
          {
            type: "text",
            value:
              "The Network Usage tab shows real-time bandwidth consumption per proxy URL.",
          },
          {
            type: "list",
            items: [
              {
                bold: "Category Filter",
                text: "— Filter by Script, Manifest, Media, or show All.",
              },
              { bold: "Search", text: "— Search proxy URLs." },
              {
                bold: "Bandwidth Indicator",
                text: "— Color-coded: green (good), yellow (moderate), orange (high), red (critical).",
              },
              {
                bold: "Stream Count",
                text: "— Shows active streams vs. max streams per proxy.",
              },
              {
                bold: "Quick Restart",
                text: "— Restart the parent VPN container directly from the bandwidth card.",
              },
            ],
          },
        ],
      },
      {
        id: "monitoring-streams",
        title: "Stream Monitoring Tab",
        content: [
          {
            type: "text",
            value:
              "The Stream Monitoring tab displays all active streams in real-time.",
          },
          {
            type: "list",
            items: [
              {
                bold: "Stream Name",
                text: "— The name/title of the active stream.",
              },
              { bold: "Provider", text: "— The streaming provider." },
              { bold: "User", text: "— The user watching the stream." },
              { bold: "IP Address", text: "— The viewer's IP address." },
              { bold: "Search", text: "— Filter streams by any column." },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings",
    subsections: [
      {
        id: "settings-docker",
        title: "Docker Connection",
        content: [
          {
            type: "text",
            value:
              "The System tab shows the Docker socket connection status and system information.",
          },
          {
            type: "list",
            items: [
              {
                bold: "Connection Status",
                text: "— Green banner if connected, red with error details if failed.",
              },
              {
                bold: "Test Connection",
                text: "— Click to re-test the Docker socket connection.",
              },
              {
                bold: "Docker Info",
                text: "— Server version, API version, OS/Architecture, container and image counts.",
              },
            ],
          },
        ],
      },
      {
        id: "settings-apikeys",
        title: "API Keys",
        content: [
          {
            type: "text",
            value:
              "API keys allow external tools and scripts to interact with the VPN Proxy Manager API.",
          },
          {
            type: "steps",
            items: [
              'In the System tab, find the "API Keys" section.',
              'Click "New Key".',
              "Enter a name for the key.",
              'Click "Generate".',
              "Copy the generated key immediately — it will not be shown again!",
              "A usage example (curl command) is displayed for convenience.",
            ],
          },
          {
            type: "subtitle",
            value: "Managing API Keys",
          },
          {
            type: "list",
            items: [
              {
                bold: "View",
                text: "— All keys are listed with name, preview (masked), and status.",
              },
              {
                bold: "Revoke",
                text: "— Click the revoke button to disable a key. This cannot be undone.",
              },
            ],
          },
          {
            type: "warning",
            value:
              "API keys are shown only once after creation. Store them securely!",
          },
        ],
      },
      {
        id: "settings-account",
        title: "Account Management",
        content: [
          {
            type: "subtitle",
            value: "Change Username",
          },
          {
            type: "steps",
            items: [
              'In the System tab, find "Change Username".',
              "Enter your new username.",
              "Confirm with your current password.",
              'Click "Change Username".',
            ],
          },
          {
            type: "subtitle",
            value: "Change Password",
          },
          {
            type: "steps",
            items: [
              'Find "Change Password".',
              "Enter your current password.",
              "Enter and confirm your new password.",
              'Click "Change Password".',
            ],
          },
        ],
      },
      {
        id: "settings-users",
        title: "User Management (Admin)",
        content: [
          {
            type: "text",
            value: "Admins can create and manage user accounts.",
          },
          {
            type: "steps",
            items: [
              'In the System tab, find "User Management".',
              'Click "Create User".',
              "Enter username, password, and toggle admin role if needed.",
              'Click "Create".',
            ],
          },
          {
            type: "list",
            items: [
              {
                bold: "User List",
                text: "— Shows all users with role (Admin/User).",
              },
              {
                bold: "Delete User",
                text: "— Remove a user account (with confirmation).",
              },
            ],
          },
        ],
      },
      {
        id: "settings-monitoring",
        title: "Monitoring Configuration",
        content: [
          {
            type: "text",
            value:
              "Configure O11 monitoring instances in the Monitoring tab of Settings.",
          },
          {
            type: "steps",
            items: [
              "Switch to the Monitoring tab.",
              'Click "Add Instance".',
              "Fill in: Instance Name, O11 Panel URL, Username, Password, Provider ID.",
              'Click "Add" to save.',
              'Use "Test" to verify the connection.',
              "Edit or delete instances as needed.",
            ],
          },
          {
            type: "tip",
            value:
              "You can add multiple O11 instances. Each instance will appear as a separate tab on the Monitoring page.",
          },
        ],
      },
    ],
  },
  {
    id: "tips",
    icon: Globe,
    title: "Tips & Tricks",
    subsections: [
      {
        id: "tips-discover",
        title: "Auto-Discover Containers",
        content: [
          {
            type: "text",
            value:
              "If you already have Gluetun or O11 containers running in Docker, use the Discover button on the Dashboard or VPN-Proxy page to automatically detect and register them.",
          },
        ],
      },
      {
        id: "tips-copy",
        title: "Quick Copy URLs",
        content: [
          {
            type: "text",
            value:
              "All proxy URLs, Shadowsocks URLs, and API keys have a copy button. Click it to copy the value to your clipboard instantly.",
          },
        ],
      },
      {
        id: "tips-refresh",
        title: "Data Auto-Refresh",
        content: [
          {
            type: "text",
            value:
              "Container status, VPN info, and monitoring data refresh automatically every 5-10 seconds. You can also click the Refresh button at any time for an immediate update.",
          },
        ],
      },
      {
        id: "tips-mobile",
        title: "Mobile Access",
        content: [
          {
            type: "text",
            value:
              "The interface is fully responsive. On mobile devices, the sidebar collapses and can be opened with the hamburger menu (☰) button.",
          },
        ],
      },
      {
        id: "tips-dependent",
        title: "Dependent Containers",
        content: [
          {
            type: "text",
            value:
              'In the VPN container detail page, the "Dependent Containers" section shows all containers that route traffic through this VPN. You can start, stop, restart, or delete dependent containers directly from there.',
          },
        ],
      },
    ],
  },
];

function RenderContent({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        if (item.type === "text") {
          return (
            <p key={idx} className="text-vpn-text text-sm leading-relaxed">
              {item.value}
            </p>
          );
        }
        if (item.type === "subtitle") {
          return (
            <h4
              key={idx}
              className="text-vpn-text font-semibold text-sm mt-4 mb-1"
            >
              {item.value}
            </h4>
          );
        }
        if (item.type === "steps") {
          return (
            <ol key={idx} className="space-y-1.5 pl-1">
              {item.items.map((step, si) => (
                <li key={si} className="flex gap-3 text-sm">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-vpn-primary/20 text-vpn-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {si + 1}
                  </span>
                  <span className="text-vpn-text leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          );
        }
        if (item.type === "list") {
          return (
            <ul key={idx} className="space-y-1.5 pl-1">
              {item.items.map((li, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <ArrowRight className="w-4 h-4 text-vpn-primary shrink-0 mt-0.5" />
                  <span className="text-vpn-text leading-relaxed">
                    <strong className="text-vpn-text font-semibold">
                      {li.bold}
                    </strong>{" "}
                    {li.text}
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        if (item.type === "tip") {
          return (
            <div
              key={idx}
              className="flex gap-2 p-3 rounded-lg bg-vpn-primary/10 border border-vpn-primary/30"
            >
              <span className="text-vpn-primary text-sm font-semibold shrink-0">
                Tip:
              </span>
              <span className="text-vpn-text text-sm leading-relaxed">
                {item.value}
              </span>
            </div>
          );
        }
        if (item.type === "warning") {
          return (
            <div
              key={idx}
              className="flex gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"
            >
              <span className="text-red-400 text-sm font-semibold shrink-0">
                Warning:
              </span>
              <span className="text-vpn-text text-sm leading-relaxed">
                {item.value}
              </span>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function HowTo() {
  const [activeTab, setActiveTab] = useState(sections[0].id);
  const [expandedSubs, setExpandedSubs] = useState(
    () =>
      new Set(
        sections[0].subsections.length ? [sections[0].subsections[0].id] : [],
      ),
  );

  const toggleSub = (id) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeSection = sections.find((s) => s.id === activeTab);

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="inline-flex gap-1 bg-vpn-card border border-vpn-border rounded-xl p-1 flex-wrap">
        {sections.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setActiveTab(id);
              const sec = sections.find((s) => s.id === id);
              setExpandedSubs(
                new Set(sec?.subsections.length ? [sec.subsections[0].id] : []),
              );
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-vpn-primary text-black"
                : "text-vpn-muted hover:text-vpn-primary"
            }`}
          >
            <Icon className="w-4 h-4" />
            {title}
          </button>
        ))}
      </div>

      {/* Active Section Content */}
      {activeSection && (
        <div className="space-y-3">
          {activeSection.subsections.map((sub) => {
            const isSubExpanded = expandedSubs.has(sub.id);
            return (
              <div
                key={sub.id}
                className="bg-vpn-card border border-vpn-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleSub(sub.id)}
                  className="w-full flex items-center gap-2 px-5 py-3.5 hover:bg-vpn-primary/5 transition-colors"
                >
                  {isSubExpanded ? (
                    <ChevronDown className="w-4 h-4 text-vpn-primary shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-vpn-primary shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-vpn-text text-left flex-1">
                    {sub.title}
                  </span>
                </button>
                {isSubExpanded && (
                  <div className="px-5 pb-4 pt-1 border-t border-vpn-border">
                    <RenderContent items={sub.content} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

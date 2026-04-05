import { useState, useEffect } from "react";
import {
  Github,
  Heart,
  Shield,
  Server,
  Globe,
  Boxes,
  Activity,
  Code2,
  ExternalLink,
  Package,
} from "lucide-react";
import api from "../services/api";

const techStack = [
  {
    category: "Backend",
    items: [
      { name: "Python", detail: "FastAPI" },
      { name: "SQLAlchemy", detail: "ORM" },
      { name: "Docker SDK", detail: "Container Management" },
      { name: "Uvicorn", detail: "ASGI Server" },
    ],
  },
  {
    category: "Frontend",
    items: [
      { name: "React", detail: "UI Framework" },
      { name: "Tailwind CSS", detail: "Styling" },
      { name: "Vite", detail: "Build Tool" },
      { name: "Lucide", detail: "Icons" },
    ],
  },
  {
    category: "Infrastructure",
    items: [
      { name: "Docker", detail: "Containerization" },
      { name: "Gluetun", detail: "VPN Client" },
      { name: "SQLite", detail: "Database" },
      { name: "Nginx", detail: "Reverse Proxy" },
    ],
  },
];

const features = [
  {
    icon: Shield,
    title: "VPN Management",
    description:
      "Create, configure, and manage Gluetun VPN containers with full provider support.",
  },
  {
    icon: Boxes,
    title: "O11 Containers",
    description:
      "Deploy and manage application containers with VPN routing capabilities.",
  },
  {
    icon: Activity,
    title: "Real-time Monitoring",
    description:
      "Monitor network bandwidth, active streams, and container health in real-time.",
  },
  {
    icon: Globe,
    title: "Geographic Overview",
    description:
      "Visualize VPN connections worldwide with an interactive map dashboard.",
  },
  {
    icon: Server,
    title: "Docker Integration",
    description:
      "Deep Docker integration with auto-discovery, compose export, and container lifecycle management.",
  },
  {
    icon: Code2,
    title: "REST API",
    description:
      "Full REST API with API key authentication for automation and external integrations.",
  },
];

export default function About() {
  const [dockerInfo, setDockerInfo] = useState(null);

  useEffect(() => {
    api
      .get("/system/docker-status")
      .then((res) => setDockerInfo(res.data))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-vpn-primary/20 border border-vpn-primary/30 flex items-center justify-center">
            <Shield className="w-8 h-8 text-vpn-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">
          VPN Proxy Manager
        </h2>
        <p className="text-vpn-primary font-semibold text-sm mb-3">v1.0.0</p>
        <p className="text-vpn-muted text-sm max-w-lg mx-auto leading-relaxed">
          A powerful, self-hosted Docker management platform for VPN containers,
          proxy services, and application deployment with real-time monitoring.
        </p>
        <div className="flex items-center justify-center gap-4 mt-5">
          <a
            href="https://github.com/cyb3rgh05t/vpn-proxy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text text-sm font-medium rounded-lg transition-all"
          >
            <Github className="w-4 h-4" />
            GitHub
            <ExternalLink className="w-3 h-3 text-vpn-muted" />
          </a>
        </div>
      </div>

      {/* Features */}
      <div>
        <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
          Features
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-vpn-card border border-vpn-border rounded-xl p-4 hover:border-vpn-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-vpn-primary/15 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-vpn-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-vpn-text">
                    {feature.title}
                  </h4>
                </div>
                <p className="text-xs text-vpn-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tech Stack */}
      <div>
        <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
          Tech Stack
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {techStack.map((group) => (
            <div
              key={group.category}
              className="bg-vpn-card border border-vpn-border rounded-xl p-4"
            >
              <h4 className="text-xs font-semibold text-vpn-primary uppercase tracking-wider mb-3">
                {group.category}
              </h4>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-vpn-text font-medium">
                      {item.name}
                    </span>
                    <span className="text-xs text-vpn-muted">
                      {item.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Info */}
      {dockerInfo && (
        <div>
          <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
            System
          </h3>
          <div className="bg-vpn-card border border-vpn-border rounded-xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {dockerInfo.server_version && (
                <div>
                  <p className="text-xs text-vpn-muted mb-0.5">Docker</p>
                  <p className="text-sm text-vpn-text font-medium">
                    {dockerInfo.server_version}
                  </p>
                </div>
              )}
              {dockerInfo.api_version && (
                <div>
                  <p className="text-xs text-vpn-muted mb-0.5">API Version</p>
                  <p className="text-sm text-vpn-text font-medium">
                    {dockerInfo.api_version}
                  </p>
                </div>
              )}
              {dockerInfo.os && (
                <div>
                  <p className="text-xs text-vpn-muted mb-0.5">OS</p>
                  <p className="text-sm text-vpn-text font-medium">
                    {dockerInfo.os}
                  </p>
                </div>
              )}
              {dockerInfo.architecture && (
                <div>
                  <p className="text-xs text-vpn-muted mb-0.5">Architecture</p>
                  <p className="text-sm text-vpn-text font-medium">
                    {dockerInfo.architecture}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-vpn-muted flex items-center justify-center gap-1.5">
          Made with <Heart className="w-3 h-3 text-red-400" /> by
          <a
            href="https://github.com/cyb3rgh05t"
            target="_blank"
            rel="noopener noreferrer"
            className="text-vpn-primary hover:underline"
          >
            cyb3rgh05t
          </a>
        </p>
      </div>
    </div>
  );
}

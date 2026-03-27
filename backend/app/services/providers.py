VPN_PROVIDERS = {
    "airvpn": {
        "name": "AirVPN",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": True,
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
                {
                    "key": "WIREGUARD_PRESHARED_KEY",
                    "label": "Preshared Key",
                    "type": "password",
                    "required": False,
                },
                {
                    "key": "WIREGUARD_ADDRESSES",
                    "label": "Addresses",
                    "type": "text",
                    "required": True,
                    "placeholder": "10.x.x.x/32",
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_COUNTRIES",
                "label": "Server Countries",
                "type": "text",
                "required": False,
                "placeholder": "e.g. Netherlands",
            },
        ],
    },
    "cyberghost": {
        "name": "Cyberghost",
        "vpn_types": ["openvpn"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": True,
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_COUNTRIES",
                "label": "Server Countries",
                "type": "text",
                "required": False,
                "placeholder": "e.g. Germany",
            },
        ],
    },
    "expressvpn": {
        "name": "ExpressVPN",
        "vpn_types": ["openvpn"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": True,
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_COUNTRIES",
                "label": "Server Countries",
                "type": "text",
                "required": False,
                "placeholder": "e.g. USA",
            },
        ],
    },
    "ivpn": {
        "name": "IVPN",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": True,
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
                {
                    "key": "WIREGUARD_ADDRESSES",
                    "label": "Addresses",
                    "type": "text",
                    "required": True,
                    "placeholder": "10.x.x.x/32",
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_COUNTRIES",
                "label": "Server Countries",
                "type": "text",
                "required": False,
            },
        ],
    },
    "mullvad": {
        "name": "Mullvad",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Account Number",
                    "type": "text",
                    "required": True,
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
                {
                    "key": "WIREGUARD_ADDRESSES",
                    "label": "Addresses",
                    "type": "text",
                    "required": True,
                    "placeholder": "10.x.x.x/32",
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_COUNTRIES",
                "label": "Server Countries",
                "type": "text",
                "required": False,
                "placeholder": "e.g. Sweden",
            },
            {
                "key": "SERVER_CITIES",
                "label": "Server Cities",
                "type": "text",
                "required": False,
                "placeholder": "e.g. Gothenburg",
            },
        ],
    },
    "nordvpn": {
        "name": "NordVPN",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username / Token",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": True,
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_COUNTRIES",
                "label": "Server Countries",
                "type": "text",
                "required": False,
                "placeholder": "e.g. Netherlands",
            },
        ],
    },
    "private internet access": {
        "name": "Private Internet Access",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": True,
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_REGIONS",
                "label": "Server Regions",
                "type": "text",
                "required": False,
                "placeholder": "e.g. DE Berlin",
            },
        ],
    },
    "protonvpn": {
        "name": "ProtonVPN",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "OpenVPN Username",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "OpenVPN Password",
                    "type": "password",
                    "required": True,
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_COUNTRIES",
                "label": "Server Countries",
                "type": "text",
                "required": False,
                "placeholder": "e.g. Netherlands",
            },
        ],
    },
    "surfshark": {
        "name": "Surfshark",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": True,
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_COUNTRIES",
                "label": "Server Countries",
                "type": "text",
                "required": False,
                "placeholder": "e.g. Netherlands",
            },
        ],
    },
    "windscribe": {
        "name": "Windscribe",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username",
                    "type": "text",
                    "required": True,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": True,
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
                {
                    "key": "WIREGUARD_ADDRESSES",
                    "label": "Addresses",
                    "type": "text",
                    "required": True,
                    "placeholder": "10.x.x.x/32",
                },
            ],
        },
        "common_fields": [
            {
                "key": "SERVER_CITIES",
                "label": "Server Cities",
                "type": "text",
                "required": False,
                "placeholder": "e.g. Amsterdam",
            },
        ],
    },
    "custom": {
        "name": "Custom",
        "vpn_types": ["openvpn", "wireguard"],
        "fields": {
            "openvpn": [
                {
                    "key": "OPENVPN_USER",
                    "label": "Username",
                    "type": "text",
                    "required": False,
                },
                {
                    "key": "OPENVPN_PASSWORD",
                    "label": "Password",
                    "type": "password",
                    "required": False,
                },
                {
                    "key": "OPENVPN_CUSTOM_CONFIG",
                    "label": "Custom Config Path",
                    "type": "text",
                    "required": False,
                    "placeholder": "/gluetun/custom.ovpn",
                },
            ],
            "wireguard": [
                {
                    "key": "WIREGUARD_PRIVATE_KEY",
                    "label": "Private Key",
                    "type": "password",
                    "required": True,
                },
                {
                    "key": "WIREGUARD_ADDRESSES",
                    "label": "Addresses",
                    "type": "text",
                    "required": True,
                    "placeholder": "10.x.x.x/32",
                },
                {
                    "key": "WIREGUARD_PUBLIC_KEY",
                    "label": "Public Key",
                    "type": "text",
                    "required": False,
                },
                {
                    "key": "VPN_ENDPOINT_IP",
                    "label": "VPN Endpoint IP",
                    "type": "text",
                    "required": False,
                },
                {
                    "key": "VPN_ENDPOINT_PORT",
                    "label": "VPN Endpoint Port",
                    "type": "text",
                    "required": False,
                    "placeholder": "51820",
                },
            ],
        },
        "common_fields": [],
    },
}


def get_provider_list():
    return [
        {"key": k, "name": v["name"], "vpn_types": v["vpn_types"]}
        for k, v in VPN_PROVIDERS.items()
    ]


# All Gluetun environment variables organized by category
GLUETUN_ENV_VARIABLES = {
    "Server Selection": [
        {
            "key": "SERVER_COUNTRIES",
            "label": "Server Countries",
            "placeholder": "e.g. Netherlands,Germany",
            "default": "",
        },
        {
            "key": "SERVER_CITIES",
            "label": "Server Cities",
            "placeholder": "e.g. Amsterdam",
            "default": "",
        },
        {
            "key": "SERVER_REGIONS",
            "label": "Server Regions",
            "placeholder": "e.g. Europe",
            "default": "",
        },
        {
            "key": "SERVER_HOSTNAMES",
            "label": "Server Hostnames",
            "placeholder": "e.g. server1.example.com",
            "default": "",
        },
        {
            "key": "SERVER_NAMES",
            "label": "Server Names",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "SERVER_NUMBER",
            "label": "Server Number",
            "placeholder": "e.g. 1",
            "default": "",
        },
    ],
    "OpenVPN": [
        {
            "key": "OPENVPN_USER",
            "label": "OpenVPN Username",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "OPENVPN_PASSWORD",
            "label": "OpenVPN Password",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "OPENVPN_CUSTOM_CONFIG",
            "label": "Custom Config Path",
            "placeholder": "/gluetun/custom.ovpn",
            "default": "",
        },
        {
            "key": "OPENVPN_PROTOCOL",
            "label": "Protocol",
            "placeholder": "udp or tcp",
            "default": "udp",
        },
        {
            "key": "OPENVPN_VERSION",
            "label": "OpenVPN Version",
            "placeholder": "2.5 or 2.6",
            "default": "2.6",
        },
        {
            "key": "OPENVPN_VERBOSITY",
            "label": "Verbosity Level",
            "placeholder": "0 to 6",
            "default": "1",
        },
        {
            "key": "OPENVPN_FLAGS",
            "label": "Additional Flags",
            "placeholder": "Space delimited flags",
            "default": "",
        },
        {
            "key": "OPENVPN_CIPHERS",
            "label": "Ciphers",
            "placeholder": "e.g. aes-256-gcm",
            "default": "",
        },
        {
            "key": "OPENVPN_AUTH",
            "label": "Auth Algorithm",
            "placeholder": "e.g. sha256",
            "default": "",
        },
        {
            "key": "OPENVPN_MSSFIX",
            "label": "MSS Fix",
            "placeholder": "0 to 9999",
            "default": "0",
        },
        {
            "key": "OPENVPN_CERT",
            "label": "Client Certificate (base64)",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "OPENVPN_KEY",
            "label": "Client Key (base64)",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "OPENVPN_ENCRYPTED_KEY",
            "label": "Encrypted Key (base64)",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "OPENVPN_KEY_PASSPHRASE",
            "label": "Key Passphrase",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "OPENVPN_ROOT",
            "label": "Run as Root",
            "placeholder": "yes or no",
            "default": "no",
        },
        {
            "key": "OPENVPN_PROCESS_USER",
            "label": "Process User",
            "placeholder": "OS user",
            "default": "root",
        },
        {
            "key": "OPENVPN_ENDPOINT_IP",
            "label": "Endpoint IP",
            "placeholder": "Valid IP address",
            "default": "",
        },
        {
            "key": "OPENVPN_ENDPOINT_PORT",
            "label": "Endpoint Port",
            "placeholder": "Valid port number",
            "default": "",
        },
    ],
    "WireGuard": [
        {
            "key": "WIREGUARD_PRIVATE_KEY",
            "label": "Private Key",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "WIREGUARD_PRESHARED_KEY",
            "label": "Preshared Key",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "WIREGUARD_PUBLIC_KEY",
            "label": "Public Key",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "WIREGUARD_ADDRESSES",
            "label": "Addresses",
            "placeholder": "xx.xx.xx.xx/xx",
            "default": "",
        },
        {
            "key": "WIREGUARD_ALLOWED_IPS",
            "label": "Allowed IPs",
            "placeholder": "CSV of IP ranges",
            "default": "0.0.0.0/0,::/0",
        },
        {
            "key": "WIREGUARD_IMPLEMENTATION",
            "label": "Implementation",
            "placeholder": "auto, kernelspace or userspace",
            "default": "auto",
        },
        {
            "key": "WIREGUARD_MTU",
            "label": "MTU",
            "placeholder": "Up to 1440",
            "default": "",
        },
        {
            "key": "WIREGUARD_PERSISTENT_KEEPALIVE_INTERVAL",
            "label": "Persistent Keepalive",
            "placeholder": "e.g. 25s",
            "default": "",
        },
        {
            "key": "WIREGUARD_ENDPOINT_IP",
            "label": "Endpoint IP",
            "placeholder": "Valid IP address",
            "default": "",
        },
        {
            "key": "WIREGUARD_ENDPOINT_PORT",
            "label": "Endpoint Port",
            "placeholder": "Valid port number",
            "default": "",
        },
    ],
    "Port Forwarding": [
        {
            "key": "VPN_PORT_FORWARDING",
            "label": "Port Forwarding",
            "placeholder": "on or off",
            "default": "off",
        },
        {
            "key": "VPN_PORT_FORWARDING_PROVIDER",
            "label": "Port Forwarding Provider",
            "placeholder": "e.g. protonvpn",
            "default": "",
        },
        {
            "key": "VPN_PORT_FORWARDING_STATUS_FILE",
            "label": "Status File Path",
            "placeholder": "Filepath",
            "default": "/tmp/gluetun/forwarded_port",
        },
        {
            "key": "VPN_PORT_FORWARDING_LISTENING_PORT",
            "label": "Listening Port",
            "placeholder": "Port number",
            "default": "",
        },
        {
            "key": "VPN_PORT_FORWARDING_UP_COMMAND",
            "label": "Up Command",
            "placeholder": "Shell command",
            "default": "",
        },
        {
            "key": "VPN_PORT_FORWARDING_DOWN_COMMAND",
            "label": "Down Command",
            "placeholder": "Shell command",
            "default": "",
        },
    ],
    "Firewall": [
        {
            "key": "FIREWALL_VPN_INPUT_PORTS",
            "label": "VPN Input Ports",
            "placeholder": "e.g. 1000,8080",
            "default": "",
        },
        {
            "key": "FIREWALL_INPUT_PORTS",
            "label": "Input Ports",
            "placeholder": "e.g. 1000,8000",
            "default": "",
        },
        {
            "key": "FIREWALL_OUTBOUND_SUBNETS",
            "label": "Outbound Subnets",
            "placeholder": "e.g. 192.168.1.0/24",
            "default": "",
        },
        {
            "key": "FIREWALL_IPTABLES_LOG_LEVEL",
            "label": "IPTables Log Level",
            "placeholder": "debug, info, warn, error",
            "default": "",
        },
    ],
    "DNS": [
        {
            "key": "DNS_UPSTREAM_RESOLVER_TYPE",
            "label": "Upstream Resolver Type",
            "placeholder": "dot, doh or plain",
            "default": "dot",
        },
        {
            "key": "DNS_UPSTREAM_RESOLVERS",
            "label": "Upstream Resolvers",
            "placeholder": "cloudflare, google, quad9...",
            "default": "cloudflare",
        },
        {
            "key": "DNS_CACHING",
            "label": "DNS Caching",
            "placeholder": "on or off",
            "default": "on",
        },
        {
            "key": "DNS_UPSTREAM_IPV6",
            "label": "Upstream IPv6",
            "placeholder": "on or off",
            "default": "off",
        },
        {
            "key": "DNS_UPDATE_PERIOD",
            "label": "Update Period",
            "placeholder": "e.g. 0, 30s, 5m, 24h",
            "default": "24h",
        },
        {
            "key": "DNS_ADDRESS",
            "label": "DNS Address",
            "placeholder": "IP address",
            "default": "127.0.0.1",
        },
        {
            "key": "DNS_BLOCK_IPS",
            "label": "Block IPs",
            "placeholder": "CSV of IP addresses",
            "default": "",
        },
        {
            "key": "DNS_BLOCK_IP_PREFIXES",
            "label": "Block IP Prefixes",
            "placeholder": "CSV of CIDRs",
            "default": "",
        },
        {
            "key": "DOT_EXCLUDE_IPS",
            "label": "DoT Exclude IPs",
            "placeholder": "CSV of IP addresses",
            "default": "",
        },
        {
            "key": "DNS_UNBLOCK_HOSTNAMES",
            "label": "Unblock Hostnames",
            "placeholder": "e.g. domain1.com,domain2.com",
            "default": "",
        },
        {
            "key": "DNS_REBINDING_PROTECTION_EXEMPT_HOSTNAMES",
            "label": "Rebinding Protection Exempt Hostnames",
            "placeholder": "CSV of public domain names",
            "default": "",
        },
        {
            "key": "DNS_UPSTREAM_PLAIN_ADDRESSES",
            "label": "Upstream Plain Addresses",
            "placeholder": "CSV of ip:port (not recommended)",
            "default": "",
        },
        {
            "key": "BLOCK_MALICIOUS",
            "label": "Block Malicious",
            "placeholder": "on or off",
            "default": "on",
        },
        {
            "key": "BLOCK_SURVEILLANCE",
            "label": "Block Surveillance",
            "placeholder": "on or off",
            "default": "off",
        },
        {
            "key": "BLOCK_ADS",
            "label": "Block Ads",
            "placeholder": "on or off",
            "default": "off",
        },
    ],
    "HTTP Proxy": [
        {
            "key": "HTTPPROXY",
            "label": "HTTP Proxy Enabled",
            "placeholder": "on or off",
            "default": "off",
        },
        {
            "key": "HTTPPROXY_LOG",
            "label": "HTTP Proxy Log",
            "placeholder": "on or off",
            "default": "off",
        },
        {
            "key": "HTTPPROXY_LISTENING_ADDRESS",
            "label": "Listening Address",
            "placeholder": "e.g. :8888",
            "default": ":8888",
        },
        {
            "key": "HTTPPROXY_USER",
            "label": "HTTP Proxy Username",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "HTTPPROXY_PASSWORD",
            "label": "HTTP Proxy Password",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "HTTPPROXY_STEALTH",
            "label": "HTTP Proxy Stealth",
            "placeholder": "on or off",
            "default": "off",
        },
    ],
    "Shadowsocks": [
        {
            "key": "SHADOWSOCKS",
            "label": "Shadowsocks Enabled",
            "placeholder": "on or off",
            "default": "off",
        },
        {
            "key": "SHADOWSOCKS_LOG",
            "label": "Shadowsocks Log",
            "placeholder": "on or off",
            "default": "off",
        },
        {
            "key": "SHADOWSOCKS_LISTENING_ADDRESS",
            "label": "Listening Address",
            "placeholder": "e.g. :8388",
            "default": ":8388",
        },
        {
            "key": "SHADOWSOCKS_CIPHER",
            "label": "Shadowsocks Cipher",
            "placeholder": "Cipher name",
            "default": "chacha20-ietf-poly1305",
        },
        {
            "key": "SHADOWSOCKS_PASSWORD",
            "label": "Shadowsocks Password",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
    ],
    "Control Server": [
        {
            "key": "HTTP_CONTROL_SERVER_ADDRESS",
            "label": "Control Server Address",
            "placeholder": "e.g. :8000",
            "default": ":8000",
        },
        {
            "key": "HTTP_CONTROL_SERVER_LOG",
            "label": "Control Server Log",
            "placeholder": "on or off",
            "default": "on",
        },
    ],
    "Updater": [
        {
            "key": "UPDATER_PERIOD",
            "label": "Update Period",
            "placeholder": "e.g. 0, 24h",
            "default": "0",
        },
        {
            "key": "UPDATER_MIN_RATIO",
            "label": "Min Server Ratio",
            "placeholder": "0 to 1",
            "default": "0.8",
        },
        {
            "key": "UPDATER_VPN_SERVICE_PROVIDERS",
            "label": "Update Providers",
            "placeholder": "Provider names",
            "default": "",
        },
    ],
    "Public IP": [
        {
            "key": "PUBLICIP_ENABLED",
            "label": "Public IP Check",
            "placeholder": "true or false",
            "default": "true",
        },
        {
            "key": "PUBLICIP_API",
            "label": "Public IP API",
            "placeholder": "API names",
            "default": "ipinfo,ifconfigco,ip2location,cloudflare",
        },
        {
            "key": "PUBLICIP_API_TOKEN",
            "label": "API Token",
            "type": "password",
            "placeholder": "",
            "default": "",
        },
        {
            "key": "PUBLICIP_FILE",
            "label": "Public IP File",
            "placeholder": "Filepath",
            "default": "/tmp/gluetun/ip",
        },
    ],
    "System": [
        {
            "key": "TZ",
            "label": "Timezone",
            "placeholder": "e.g. Europe/Berlin",
            "default": "",
        },
        {
            "key": "PUID",
            "label": "Process UID",
            "placeholder": "User ID",
            "default": "1000",
        },
        {
            "key": "PGID",
            "label": "Process GID",
            "placeholder": "Group ID",
            "default": "1000",
        },
        {
            "key": "LOG_LEVEL",
            "label": "Log Level",
            "placeholder": "debug, info, warn, error",
            "default": "info",
        },
        {
            "key": "VERSION_INFORMATION",
            "label": "Version Info",
            "placeholder": "on or off",
            "default": "on",
        },
    ],
}


def get_gluetun_env_variables():
    return GLUETUN_ENV_VARIABLES


def get_provider_fields(provider_key: str):
    provider = VPN_PROVIDERS.get(provider_key)
    if not provider:
        return None
    return provider

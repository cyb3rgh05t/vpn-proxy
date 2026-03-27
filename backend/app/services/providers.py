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


def get_provider_fields(provider_key: str):
    provider = VPN_PROVIDERS.get(provider_key)
    if not provider:
        return None
    return provider

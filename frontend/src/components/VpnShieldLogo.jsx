export default function VpnShieldLogo({ className = "w-8 h-8" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Shield shape */}
      <path
        d="M32 4L8 14v18c0 14 10.5 22.5 23 26.8a2 2 0 0 0 2 0C45.5 54.5 56 46 56 32V14L32 4z"
        fill="currentColor"
      />
      <path
        d="M32 8L12 16.5v15.5c0 12 9 19.5 19.5 23a1.5 1.5 0 0 0 1 0C43 51 52 43.5 52 32V16.5L32 8z"
        fill="#0a0a0a"
      />
      {/* Lock body */}
      <rect x="24" y="30" width="16" height="13" rx="2" fill="currentColor" />
      {/* Lock shackle */}
      <path
        d="M26 30v-5a6 6 0 0 1 12 0v5"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Keyhole */}
      <circle cx="32" cy="35" r="2.5" fill="#0a0a0a" />
      <rect x="31" y="36" width="2" height="4" rx="1" fill="#0a0a0a" />
    </svg>
  );
}

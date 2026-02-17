"use client";

import { motion } from "framer-motion";

type AvatarSize = "sm" | "md" | "lg";

const SIZES: Record<AvatarSize, number> = { sm: 28, md: 40, lg: 64 };

interface AlainAvatarProps {
  size?: AvatarSize;
  loading?: boolean;
  className?: string;
}

/**
 * ALAIN avatar — inline SVG, theme-aware via var(--primary).
 * Pulse animation when loading via framer-motion.
 */
export function AlainAvatar({ size = "md", loading = false, className = "" }: AlainAvatarProps) {
  const px = SIZES[size];

  const svg = (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="ALAIN"
    >
      {/* Head circle */}
      <circle cx="32" cy="32" r="30" fill="var(--primary)" opacity="0.12" />
      <circle cx="32" cy="32" r="30" stroke="var(--primary)" strokeWidth="2" opacity="0.4" />

      {/* Eyes */}
      <circle cx="22" cy="28" r="4" fill="var(--primary)" />
      <circle cx="42" cy="28" r="4" fill="var(--primary)" />

      {/* Eye highlights */}
      <circle cx="23.5" cy="26.5" r="1.5" fill="white" opacity="0.8" />
      <circle cx="43.5" cy="26.5" r="1.5" fill="white" opacity="0.8" />

      {/* Smile */}
      <path
        d="M22 38 C26 44, 38 44, 42 38"
        stroke="var(--primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Antenna */}
      <line x1="32" y1="2" x2="32" y2="10" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="2" r="2.5" fill="var(--primary)" />

      {/* Gear ears */}
      <path
        d="M6 32 L2 28 L2 36 Z"
        fill="var(--primary)"
        opacity="0.5"
      />
      <path
        d="M58 32 L62 28 L62 36 Z"
        fill="var(--primary)"
        opacity="0.5"
      />
    </svg>
  );

  if (loading) {
    return (
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        className="inline-flex"
      >
        {svg}
      </motion.div>
    );
  }

  return svg;
}

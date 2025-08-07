
import React from 'react';

interface UndersignedIconProps {
  size?: number;
  className?: string;
}

export function UndersignedIcon({ size = 16, className = "" }: UndersignedIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Motion lines to show speed */}
      <path
        d="M2 12L6 12M4 10L7 10M3 14L8 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      
      {/* Pen body */}
      <path
        d="M8 4L20 16L18 18L6 6L8 4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      
      {/* Pen tip */}
      <path
        d="M18 18L20 16L22 18L20 20L18 18Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      
      {/* Writing line/trail */}
      <path
        d="M18 18L16 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}


import React from 'react';

interface UnsplashIconProps {
  className?: string;
}

export const UnsplashIcon: React.FC<UnsplashIconProps> = ({ className = "h-4 w-4" }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10 9V0h12v9H10zm12 5h10v18H0V14h10v9h12v-9z"/>
    </svg>
  );
};

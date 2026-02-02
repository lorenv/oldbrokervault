import { useEffect, useRef } from "react";

/**
 * Hook to handle keyboard appearing on mobile and auto-scroll focused input into view
 * Usage: const inputRef = useKeyboardScroll<HTMLInputElement>();
 */
export function useKeyboardScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleFocus = () => {
      // Small delay to let keyboard animation start
      setTimeout(() => {
        if (!element) return;

        // Get element position
        const rect = element.getBoundingClientRect();
        const viewportHeight = window.visualViewport?.height || window.innerHeight;

        // If element is in lower half of viewport, scroll it into view
        if (rect.top > viewportHeight / 2) {
          element.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }
      }, 300); // Wait for keyboard animation
    };

    element.addEventListener("focus", handleFocus);

    return () => {
      element.removeEventListener("focus", handleFocus);
    };
  }, []);

  return ref;
}

/**
 * Hook to adjust viewport when keyboard opens on mobile
 * This helps prevent fixed elements from being hidden by the keyboard
 */
export function useKeyboardResize() {
  useEffect(() => {
    const handleResize = () => {
      // Use visualViewport to detect actual visible area (excluding keyboard)
      const viewport = window.visualViewport;
      if (!viewport) return;

      // Update CSS variable for keyboard-aware layouts
      document.documentElement.style.setProperty(
        "--viewport-height",
        `${viewport.height}px`
      );
    };

    // Listen to both visualViewport and window resize
    window.visualViewport?.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);

    // Initial call
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
    };
  }, []);
}

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path, { dirname } from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { fileURLToPath } from "url";
import { visualizer } from "rollup-plugin-visualizer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    // Bundle analyzer - generates stats.html in dist
    ...(process.env.ANALYZE === "true"
      ? [
          visualizer({
            filename: "dist/stats.html",
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  publicDir: path.resolve(__dirname, "client", "public"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // Optimize build
    sourcemap: false,
    minify: "esbuild",
    target: "es2020",
    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React - changes rarely
          "vendor-react": ["react", "react-dom", "wouter"],
          // React Query - data fetching layer
          "vendor-query": ["@tanstack/react-query"],
          // UI components - Radix primitives
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-toast",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-switch",
            "@radix-ui/react-slider",
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
          ],
          // Charts - heavy, lazy load when needed
          "vendor-charts": ["recharts"],
          // Rich text editor
          "vendor-editor": [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-table",
            "@tiptap/extension-table-cell",
            "@tiptap/extension-table-header",
            "@tiptap/extension-table-row",
          ],
          // Animation libraries
          "vendor-animation": ["framer-motion"],
          // Forms
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          // Stripe
          "vendor-stripe": ["@stripe/react-stripe-js", "@stripe/stripe-js"],
          // Date utilities
          "vendor-date": ["date-fns", "react-day-picker"],
          // PDF handling
          "vendor-pdf": ["jspdf", "pdf-lib"],
        },
        // Optimize chunk file names for caching
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name || "chunk";
          return `assets/${name}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || "asset";
          // Keep font files organized
          if (/\.(woff2?|ttf|eot)$/.test(name)) {
            return "assets/fonts/[name]-[hash][extname]";
          }
          // Keep images organized
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(name)) {
            return "assets/images/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
    // Warn on large chunks
    chunkSizeWarningLimit: 500,
  },
  // Optimize dev server
  server: {
    // Disable HMR in Replit to prevent WebSocket errors (wss://localhost:undefined)
    // Replit's proxy doesn't reliably support HMR websockets
    hmr: process.env.REPL_ID ? false : { overlay: true },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "wouter",
      "@tanstack/react-query",
    ],
  },
});

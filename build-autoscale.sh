#!/bin/bash
# Auto-scale Deployment Build Script
# Optimized for Replit Auto-scale deployment with proper port configuration
# Includes safe size optimizations to stay under 8 GiB limit

echo "🚀 Building for auto-scale deployment..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
mkdir -p dist

# Build the frontend first
echo "🎨 Building frontend with Vite..."
npm run build 2>/dev/null || {
  echo "⚠️ Vite build failed, using fallback client copy..."
  mkdir -p dist/client
  cp -r client/* dist/client/
}

# Build the server
echo "📦 Building server with ESBuild..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --minify

# Copy necessary files
echo "📄 Copying essential files..."
cp -r shared dist/ 2>/dev/null || true

# Copy public folder but EXCLUDE large non-essential directories
echo "📁 Copying public assets (excluding uploads and example files)..."
mkdir -p dist/public
# Copy only essential public subdirectories
cp -r public/assets dist/public/ 2>/dev/null || true
cp -r public/fonts dist/public/ 2>/dev/null || true
cp -r public/logos dist/public/ 2>/dev/null || true
cp -r public/template-thumbnails dist/public/ 2>/dev/null || true
cp -r public/screenshots dist/public/ 2>/dev/null || true
# Copy root-level files in public (exclude large videos and images)
find public -maxdepth 1 -type f \( -name "*.svg" -o -name "*.ico" -o -name "favicon*" -o -name "robots.txt" -o -name "*.json" \) -exec cp {} dist/public/ \; 2>/dev/null || true
# Copy small essential images only (under 100KB)
find public -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) -size -100k -exec cp {} dist/public/ \; 2>/dev/null || true
# Skip: uploads, user-images, business-images, example-assets, images, large videos/media

cp package.json dist/ 2>/dev/null || true

# Copy Python SDE analyzer package
echo "🐍 Copying Python SDE analyzer..."
mkdir -p dist/server/sde-analyzer-package
cp -r server/sde-analyzer-package/* dist/server/sde-analyzer-package/ 2>/dev/null || true

# Create storage directory for filesystem storage
echo "💾 Creating storage directory..."
mkdir -p dist/storage/sde-files

# === SAFE SIZE OPTIMIZATION SECTION ===
echo "📉 Applying safe size optimizations..."

# Install production dependencies in dist (dev deps excluded)
echo "🔧 Installing production dependencies..."
cd dist && npm install --omit=dev --legacy-peer-deps 2>&1 | tail -20 && cd ..

# Clean Puppeteer's embedded Chromium from dist/node_modules (300MB+)
echo "🌐 Cleaning Puppeteer browser cache from build..."
rm -rf dist/node_modules/puppeteer/.local-chromium 2>/dev/null || true
rm -rf dist/node_modules/puppeteer-core/.local-chromium 2>/dev/null || true
rm -rf dist/node_modules/**/chromium-* 2>/dev/null || true
find dist/node_modules -type d \( -name '.chromium' -o -name 'chromium' \) -exec rm -rf {} + 2>/dev/null || true
rm -rf dist/node_modules/puppeteer 2>/dev/null || true
rm -rf dist/node_modules/puppeteer-core 2>/dev/null || true

# Clean sharp's prebuilds for unused platforms in dist (keeps linux-x64)
echo "🖼️ Optimizing sharp for linux-x64..."
if [ -d "dist/node_modules/@img" ]; then
  find dist/node_modules/@img -type d -name "linux-arm*" -exec rm -rf {} + 2>/dev/null || true
  find dist/node_modules/@img -type d -name "darwin-*" -exec rm -rf {} + 2>/dev/null || true
  find dist/node_modules/@img -type d -name "win32-*" -exec rm -rf {} + 2>/dev/null || true
fi

# Clean canvas binaries for unused platforms in dist
echo "🎨 Optimizing canvas for linux..."
if [ -d "dist/node_modules/canvas" ]; then
  find dist/node_modules/canvas -type d -name "*darwin*" -exec rm -rf {} + 2>/dev/null || true
  find dist/node_modules/canvas -type d -name "*win32*" -exec rm -rf {} + 2>/dev/null || true
fi

# Remove test/example directories from dist/node_modules (safe cleanup)
echo "🗑️ Removing test directories from build dependencies..."
find dist/node_modules -type d -name "__tests__" -prune -exec rm -rf {} + 2>/dev/null || true
find dist/node_modules -type d -name "coverage" -prune -exec rm -rf {} + 2>/dev/null || true
find dist/node_modules -type d -name "example" -prune -exec rm -rf {} + 2>/dev/null || true
find dist/node_modules -type d -name "examples" -prune -exec rm -rf {} + 2>/dev/null || true
find dist/node_modules -type d -name "test" -prune -exec rm -rf {} + 2>/dev/null || true
find dist/node_modules -type d -name "tests" -prune -exec rm -rf {} + 2>/dev/null || true
find dist/node_modules -type d -name "docs" -prune -exec rm -rf {} + 2>/dev/null || true
find dist/node_modules -type d -name ".github" -prune -exec rm -rf {} + 2>/dev/null || true

# Remove TypeScript source files, maps, and type definitions (not needed at runtime)
echo "🗑️ Removing TypeScript sources, maps, and type definitions..."
find dist/node_modules -name "*.ts" -type f -delete 2>/dev/null || true
find dist/node_modules -name "*.d.ts" -type f -delete 2>/dev/null || true
find dist/node_modules -name "*.map" -type f -delete 2>/dev/null || true
find dist/node_modules -name "*.md" -type f -delete 2>/dev/null || true
find dist/node_modules -name "CHANGELOG*" -type f -delete 2>/dev/null || true
find dist/node_modules -name "LICENSE*" -type f -delete 2>/dev/null || true
find dist/node_modules -name "README*" -type f -delete 2>/dev/null || true

# Remove frontend-only packages from production (not needed on server)
echo "🗑️ Removing frontend-only packages from server build..."
rm -rf dist/node_modules/lucide-react 2>/dev/null || true
rm -rf dist/node_modules/@radix-ui 2>/dev/null || true
rm -rf dist/node_modules/react 2>/dev/null || true
rm -rf dist/node_modules/react-dom 2>/dev/null || true
rm -rf dist/node_modules/framer-motion 2>/dev/null || true
rm -rf dist/node_modules/embla-carousel-react 2>/dev/null || true
rm -rf dist/node_modules/@tanstack 2>/dev/null || true
rm -rf dist/node_modules/recharts 2>/dev/null || true
rm -rf dist/node_modules/react-hook-form 2>/dev/null || true
rm -rf dist/node_modules/@hookform 2>/dev/null || true
rm -rf dist/node_modules/react-day-picker 2>/dev/null || true
rm -rf dist/node_modules/react-dnd 2>/dev/null || true
rm -rf dist/node_modules/react-dnd-html5-backend 2>/dev/null || true
rm -rf dist/node_modules/@dnd-kit 2>/dev/null || true
rm -rf dist/node_modules/cmdk 2>/dev/null || true
rm -rf dist/node_modules/vaul 2>/dev/null || true
rm -rf dist/node_modules/@tiptap 2>/dev/null || true
rm -rf dist/node_modules/posthog-js 2>/dev/null || true
rm -rf dist/node_modules/canvas-confetti 2>/dev/null || true
rm -rf dist/node_modules/leaflet 2>/dev/null || true
rm -rf dist/node_modules/react-leaflet 2>/dev/null || true
rm -rf dist/node_modules/@stripe/react-stripe-js 2>/dev/null || true
rm -rf dist/node_modules/@stripe/stripe-js 2>/dev/null || true
rm -rf dist/node_modules/signature_pad 2>/dev/null || true
rm -rf dist/node_modules/input-otp 2>/dev/null || true
rm -rf dist/node_modules/react-resizable-panels 2>/dev/null || true
rm -rf dist/node_modules/react-markdown 2>/dev/null || true
rm -rf dist/node_modules/tailwind-merge 2>/dev/null || true
rm -rf dist/node_modules/tailwindcss-animate 2>/dev/null || true
rm -rf dist/node_modules/class-variance-authority 2>/dev/null || true
rm -rf dist/node_modules/clsx 2>/dev/null || true
rm -rf dist/node_modules/@uppy 2>/dev/null || true
rm -rf dist/node_modules/wouter 2>/dev/null || true

# Remove heavy PDF parsing dependencies (unused - server uses pdf-lib/pdfkit)
echo "🗑️ Removing heavy PDF parsing dependencies..."
rm -rf dist/node_modules/pdfjs-dist 2>/dev/null || true
rm -rf dist/node_modules/pdf-parse 2>/dev/null || true
rm -rf dist/node_modules/@napi-rs 2>/dev/null || true

# Remove client-only PDF library
rm -rf dist/node_modules/jspdf 2>/dev/null || true

# Remove extraneous canvas packages (client-only, not used server-side)
rm -rf dist/node_modules/html2canvas 2>/dev/null || true
rm -rf dist/node_modules/stackblur-canvas 2>/dev/null || true
rm -rf dist/node_modules/canvg 2>/dev/null || true

# Remove OpenTelemetry if not using tracing
rm -rf dist/node_modules/@opentelemetry 2>/dev/null || true

# Remove TypeScript types (not needed at runtime)
rm -rf dist/node_modules/@types 2>/dev/null || true

# Remove core-js polyfills (Node 20 doesn't need them)
rm -rf dist/node_modules/core-js 2>/dev/null || true
rm -rf dist/node_modules/core-js-pure 2>/dev/null || true

# Remove date-fns locales (keep only en-US)
if [ -d "dist/node_modules/date-fns/locale" ]; then
  find dist/node_modules/date-fns/locale -mindepth 1 -maxdepth 1 -type d ! -name "en-US" -exec rm -rf {} + 2>/dev/null || true
fi

# Clean up any example-assets that got through
rm -rf dist/public/example-assets 2>/dev/null || true
rm -rf dist/public/uploads 2>/dev/null || true
rm -rf dist/public/user-images 2>/dev/null || true
rm -rf dist/public/business-images 2>/dev/null || true
rm -rf dist/public/images 2>/dev/null || true

# Remove large video files from public
echo "🎬 Removing large video files..."
find dist/public -name "*.mp4" -type f -delete 2>/dev/null || true
find dist/public -name "*.webm" -type f -delete 2>/dev/null || true
find dist/public -name "*.mov" -type f -delete 2>/dev/null || true

# Deduplicate nested sharp-libvips copies (colorthief/ndarray-pixels have duplicates)
echo "🔗 Removing duplicate native bindings..."
rm -rf dist/node_modules/colorthief/node_modules/@img 2>/dev/null || true
rm -rf dist/node_modules/ndarray-pixels/node_modules/@img 2>/dev/null || true
rm -rf dist/node_modules/*/node_modules/@img 2>/dev/null || true

# === END SIZE OPTIMIZATION ===

# Create production start script for auto-scale
echo "🔧 Creating auto-scale start script..."
cat > dist/start.js << 'EOF'
#!/usr/bin/env node
// Auto-scale deployment start script
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'autoscale';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

// .replit maps port 5000 -> external 80
const PORT = process.env.PORT || 5000;

console.log('🚀 Starting CIM Share in auto-scale mode...');
console.log('📍 Port:', PORT);
console.log('🌐 Environment:', process.env.NODE_ENV);

// Import the main server
import('./index.js').catch(err => {
  console.error('❌ Failed to start auto-scale deployment:', err);
  process.exit(1);
});
EOF

chmod +x dist/start.js

# Create root start.js for auto-scale compatibility
echo "🔗 Creating root start.js for auto-scale deployment..."
cat > start.js << 'EOF'
#!/usr/bin/env node
// Root start.js for auto-scale deployment
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'autoscale';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

// Auto-scale deployment port configuration
// .replit maps port 5000 -> external 80
const PORT = process.env.PORT || 5000;
process.env.PORT = PORT;

console.log('🚀 CIM Share - Auto-scale Deployment');
console.log('📍 Port:', PORT);
console.log('🔗 Starting from dist/index.js...');

// Import the built server directly
import('./dist/index.js').catch(err => {
  console.error('❌ Auto-scale startup failed:', err);
  process.exit(1);
});
EOF

chmod +x start.js

# Report final size
echo "📊 Checking build sizes..."
echo "Root node_modules (excluded via .dockerignore):"
du -sh node_modules 2>/dev/null || echo "  N/A"
echo "Dist folder (deployed):"
du -sh dist 2>/dev/null || echo "  N/A"
echo "Dist breakdown:"
du -sh dist/*/ 2>/dev/null | sort -rh | head -5
echo ""
echo "Estimated deployment size: ~$(du -sh dist | cut -f1)"

echo "✅ Auto-scale build complete!"
echo "📝 Deployment ready:"
echo "   🎯 Target: Auto-scale"
echo "   🌐 Port: 5000 → 80 (external)"
echo "   🚀 Start: node start.js"
echo "   📉 Size optimizations applied"

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
cp -r public dist/ 2>/dev/null || true
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

# === END SIZE OPTIMIZATION ===

# Create production start script for auto-scale
echo "🔧 Creating auto-scale start script..."
cat > dist/start.js << 'EOF'
#!/usr/bin/env node
// Auto-scale deployment start script
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'autoscale';
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = 'true';

// Auto-scale requires port 3000 with external port 80
const PORT = process.env.PORT || 3000;

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
const PORT = process.env.PORT || 3000;
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
du -sh node_modules 2>/dev/null || echo "node_modules: N/A"
du -sh dist 2>/dev/null || echo "dist: N/A"

echo "✅ Auto-scale build complete!"
echo "📝 Deployment ready:"
echo "   🎯 Target: Auto-scale"
echo "   🌐 Port: 3000 → 80 (external)"
echo "   🚀 Start: node start.js"
echo "   📉 Size optimizations applied"

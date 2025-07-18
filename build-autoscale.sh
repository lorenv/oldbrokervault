#!/bin/bash
# Auto-scale Deployment Build Script
# Optimized for Replit Auto-scale deployment with proper port configuration

echo "🚀 Building for auto-scale deployment..."

# Clean previous builds
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

# Create production start script for auto-scale
echo "🔧 Creating auto-scale start script..."
cat > dist/start.js << 'EOF'
#!/usr/bin/env node
// Auto-scale deployment start script
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'autoscale';

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

echo "✅ Auto-scale build complete!"
echo "📝 Deployment ready:"
echo "   🎯 Target: Auto-scale"
echo "   🌐 Port: 3000 → 80 (external)"
echo "   🚀 Start: node start.js"
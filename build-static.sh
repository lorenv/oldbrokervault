#!/bin/bash
# Static Deployment Build Script
# Bypasses problematic Vite build by creating simplified static deployment

echo "🏗️  Building for static deployment..."

# Clean previous builds
rm -rf dist
mkdir -p dist

# Build the server (this works reliably)
echo "📦 Building server..."
esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Copy client source files for development mode serving
echo "📄 Copying client files..."
cp -r client dist/
cp -r shared dist/

# Copy public assets
echo "🎨 Copying public assets..."
cp -r public dist/

echo "📦 Preparing static deployment dependencies..."
# Copy essential files for static deployment
cp package.json dist/ 2>/dev/null || true
mkdir -p dist/server/pdf-templates dist/server/fonts 2>/dev/null || true
cp -r server/pdf-templates/* dist/server/pdf-templates/ 2>/dev/null || true
cp -r server/fonts/* dist/server/fonts/ 2>/dev/null || true

# Create a production start script
echo "🚀 Creating production start script..."
cat > dist/start.js << 'EOF'
#!/usr/bin/env node
// Static deployment start script optimized for Replit
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'static';
process.env.PORT = '3000';

console.log('🚀 Starting CIM Share in static deployment mode...');
console.log('📍 Working directory:', process.cwd());
console.log('🌐 Environment:', process.env.NODE_ENV);

// Import the main server
import('./index.js').catch(err => {
  console.error('❌ Failed to start static deployment:', err);
  console.error('❌ Error details:', err.stack);
  process.exit(1);
});
EOF

chmod +x dist/start.js

# Create a root-level start.js that properly delegates to the dist version
echo "🔗 Creating root start.js for deployment compatibility..."
cat > start.js << 'EOF'
#!/usr/bin/env node
// Root start.js - delegates to dist/start.js for static deployment
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'static';
process.env.PORT = '3000';

console.log('🚀 CIM Share - Static Deployment Launcher');
console.log('📍 Root directory:', process.cwd());
console.log('🔗 Delegating to dist/start.js...');

// Import the main start script from dist
import('./dist/start.js').catch(err => {
  console.error('❌ Failed to start from root:', err);
  console.error('❌ Trying direct dist/index.js import...');
  
  // Fallback: try importing the built server directly
  import('./dist/index.js').catch(fallbackErr => {
    console.error('❌ All startup methods failed:', fallbackErr);
    process.exit(1);
  });
});
EOF

chmod +x start.js

echo "🔧 Creating package.json for static deployment..."
cat > dist/package.json << 'EOF'
{
  "name": "cim-share-static",
  "version": "1.0.0",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node start.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

echo "✅ Static build complete!"
echo "📝 To deploy:"
echo "   1. Upload dist/ folder to static deployment"
echo "   2. Set start command to: node start.js"
echo "   3. Ensure all environment variables are configured"
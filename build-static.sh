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

# Copy public assets
echo "🎨 Copying public assets..."
cp -r public dist/

# Create a production start script
echo "🚀 Creating production start script..."
cat > dist/start.js << 'EOF'
#!/usr/bin/env node
// Static deployment start script
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'static';

import('./index.js').catch(err => {
  console.error('Failed to start static deployment:', err);
  process.exit(1);
});
EOF

chmod +x dist/start.js

echo "✅ Static build complete!"
echo "📝 To deploy:"
echo "   1. Upload dist/ folder to static deployment"
echo "   2. Set start command to: node start.js"
echo "   3. Ensure all environment variables are configured"
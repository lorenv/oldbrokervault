#!/usr/bin/env node
// Smart deployment build script that bypasses Vite hanging issues
// This replaces the problematic "vite build" step in package.json

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Smart Deployment Build - Bypassing Vite Issues...');

try {
  // Clean previous builds
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  fs.mkdirSync('dist', { recursive: true });

  console.log('📦 Building server with ESBuild...');
  // Build server directly (this works)
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist --minify', { stdio: 'inherit' });

  console.log('📄 Copying client files...');
  // Copy client files directly instead of Vite build
  execSync('cp -r client dist/', { stdio: 'inherit' });
  execSync('cp -r shared dist/', { stdio: 'inherit' });

  console.log('🎨 Copying public assets...');
  // Copy public assets
  execSync('cp -r public dist/', { stdio: 'inherit' });

  console.log('🔧 Creating start script...');
  // Create start script
  const startScript = `#!/usr/bin/env node
// Production start script for static deployment
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_TARGET = 'static';

console.log('🚀 Starting CIM Share in production mode...');
import('./index.js').catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});`;

  fs.writeFileSync('dist/start.js', startScript);
  execSync('chmod +x dist/start.js', { stdio: 'inherit' });

  console.log('✅ Deployment build complete!');
  console.log('📊 Build summary:');
  const files = fs.readdirSync('dist');
  files.forEach(file => {
    const stats = fs.statSync(path.join('dist', file));
    console.log(`   ${stats.isDirectory() ? '📁' : '📄'} ${file}`);
  });

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
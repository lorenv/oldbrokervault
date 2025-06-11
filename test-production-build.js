// Test production build locally to identify the issue
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import { setTimeout } from 'timers/promises';

async function testProductionBuild() {
  console.log('Building production version...');
  
  // Start build process
  const build = spawn('npm', ['run', 'build'], { stdio: 'pipe' });
  
  let buildOutput = '';
  build.stdout.on('data', (data) => {
    buildOutput += data.toString();
  });
  
  build.stderr.on('data', (data) => {
    buildOutput += data.toString();
  });
  
  // Wait for build to complete or timeout
  const buildPromise = new Promise((resolve, reject) => {
    build.on('close', (code) => {
      if (code === 0) {
        resolve('Build successful');
      } else {
        reject(new Error(`Build failed with code ${code}`));
      }
    });
  });
  
  try {
    await Promise.race([
      buildPromise,
      setTimeout(60000).then(() => {
        build.kill();
        throw new Error('Build timeout');
      })
    ]);
    
    console.log('Build completed successfully');
    
    // Start production server
    console.log('Starting production server...');
    const server = spawn('npm', ['run', 'start'], { 
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'production' }
    });
    
    let serverOutput = '';
    server.stdout.on('data', (data) => {
      serverOutput += data.toString();
      console.log('Server:', data.toString().trim());
    });
    
    server.stderr.on('data', (data) => {
      serverOutput += data.toString();
      console.log('Server Error:', data.toString().trim());
    });
    
    // Wait for server to start
    await setTimeout(10000);
    
    // Test the share endpoint locally
    try {
      const response = await fetch('http://localhost:5000/api/share/cim-e229m1');
      console.log('Local production test status:', response.status);
      const text = await response.text();
      console.log('Local production response length:', text.length);
      
      if (response.status === 500) {
        console.log('Local production 500 error:', text);
      } else if (response.ok) {
        console.log('Local production success!');
      }
    } catch (fetchError) {
      console.log('Local production fetch error:', fetchError.message);
    }
    
    server.kill();
    
  } catch (error) {
    console.log('Build error:', error.message);
    console.log('Build output:', buildOutput);
  }
}

testProductionBuild();
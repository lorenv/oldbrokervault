#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the file
const filePath = process.argv[2];
if (!filePath) {
  console.error('Please provide a file path');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Count initial console statements
const initialCount = (content.match(/console\./g) || []).length;
console.log(`Processing ${filePath}...`);
console.log(`Found ${initialCount} console statements`);

// Replace console.error with logger.error
content = content.replace(/console\.error\((.*?)\);/g, (match, args) => {
  // Try to extract meaningful context from the error message
  if (args.includes(',')) {
    // Has multiple arguments
    const parts = args.split(',').map(p => p.trim());
    const message = parts[0].replace(/[`'"]/g, '').replace(/^\$\{.*?\}/, '').trim();
    if (parts.length > 1) {
      return `logger.error(${parts[0]}, { error: ${parts.slice(1).join(', ')} });`;
    }
    return `logger.error(${parts[0]});`;
  }
  return `logger.error("Error occurred", { error: ${args} });`;
});

// Replace console.warn with logger.warn
content = content.replace(/console\.warn\((.*?)\);/g, (match, args) => {
  if (args.includes(',')) {
    const parts = args.split(',').map(p => p.trim());
    return `logger.warn(${parts[0]}, { data: ${parts.slice(1).join(', ')} });`;
  }
  return `logger.warn(${args});`;
});

// Replace console.log with logger.info or logger.debug based on context
content = content.replace(/console\.log\((.*?)\);/g, (match, args) => {
  // Check if it's a debug/trace type message
  const isDebug = args.toLowerCase().includes('debug') || 
                  args.includes('🔍') || 
                  args.includes('📊') ||
                  args.includes('===') ||
                  args.toLowerCase().includes('raw body') ||
                  args.toLowerCase().includes('parsed');
  
  const logLevel = isDebug ? 'debug' : 'info';
  
  if (args.includes(',')) {
    const parts = args.split(',').map(p => p.trim());
    // If first part is a template literal or string, use it as message
    if (parts[0].match(/^[`'"]/) || parts[0].includes('${')) {
      return `logger.${logLevel}(${parts[0]}, { data: ${parts.slice(1).join(', ')} });`;
    }
    return `logger.${logLevel}("Log message", { data: ${args} });`;
  }
  return `logger.${logLevel}(${args});`;
});

// Count final console statements
const finalCount = (content.match(/console\./g) || []).length;
console.log(`Replaced ${initialCount - finalCount} console statements`);
console.log(`${finalCount} console statements remaining`);

// Write back the file
fs.writeFileSync(filePath, content, 'utf8');
console.log(`File ${filePath} updated successfully`);
// Temporary script to comment out problematic lines in routes.ts
const fs = require('fs');

const routesPath = 'server/routes.ts';
let content = fs.readFileSync(routesPath, 'utf8');

// Comment out the problematic website analysis line
content = content.replace(
  'const websiteAnalysis = await analyzeWebsite(normalizedUrl);',
  '// DISABLED: const websiteAnalysis = await analyzeWebsite(normalizedUrl);'
);

// Comment out the enhance CIM line
content = content.replace(
  'analysis = enhanceCimWithWebsiteData(analysis, websiteAnalysis);',
  '// DISABLED: analysis = enhanceCimWithWebsiteData(analysis, websiteAnalysis);'
);

fs.writeFileSync(routesPath, content);
console.log('Fixed problematic website analysis code');
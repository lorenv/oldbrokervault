import fs from 'fs';
import path from 'path';

// Simple zip extraction for the font file
const zipFile = fs.readFileSync('handwritania_1749411508861.zip');

// Look for ZIP file signature and extract
function extractZip(buffer) {
  const entries = [];
  let offset = 0;
  
  // Find central directory
  const centralDirSig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  let centralDirOffset = -1;
  
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { // End of central dir signature
      centralDirOffset = buffer.readUInt32LE(i + 16);
      break;
    }
  }
  
  if (centralDirOffset === -1) {
    throw new Error('Invalid ZIP file');
  }
  
  // Read central directory entries
  let pos = centralDirOffset;
  while (pos < buffer.length && buffer.readUInt32LE(pos) === 0x02014b50) {
    const filenameLength = buffer.readUInt16LE(pos + 28);
    const extraFieldLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const localHeaderOffset = buffer.readUInt32LE(pos + 42);
    
    const filename = buffer.slice(pos + 46, pos + 46 + filenameLength).toString('utf8');
    
    // Extract file data
    const localHeaderPos = localHeaderOffset;
    if (buffer.readUInt32LE(localHeaderPos) === 0x04034b50) { // Local file header signature
      const compressedSize = buffer.readUInt32LE(localHeaderPos + 18);
      const localFilenameLength = buffer.readUInt16LE(localHeaderPos + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderPos + 28);
      
      const fileDataStart = localHeaderPos + 30 + localFilenameLength + localExtraLength;
      const fileData = buffer.slice(fileDataStart, fileDataStart + compressedSize);
      
      entries.push({
        filename,
        data: fileData
      });
    }
    
    pos += 46 + filenameLength + extraFieldLength + commentLength;
  }
  
  return entries;
}

try {
  const entries = extractZip(zipFile);
  
  // Create fonts directory
  if (!fs.existsSync('public/fonts')) {
    fs.mkdirSync('public/fonts', { recursive: true });
  }
  
  // Extract font files
  entries.forEach(entry => {
    console.log('Found file:', entry.filename);
    
    // Check if it's a font file
    if (entry.filename.toLowerCase().includes('.ttf') || 
        entry.filename.toLowerCase().includes('.otf') ||
        entry.filename.toLowerCase().includes('.woff')) {
      
      const fontPath = path.join('public/fonts', path.basename(entry.filename));
      fs.writeFileSync(fontPath, entry.data);
      console.log('Extracted font to:', fontPath);
    }
  });
  
  console.log('Font extraction completed');
} catch (error) {
  console.error('Error extracting font:', error);
}
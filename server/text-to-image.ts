import { createCanvas } from 'canvas';
import { Buffer } from 'buffer';

export async function convertTextToImage(text: string): Promise<string> {
  // Configure canvas
  const lineHeight = 20;
  const fontSize = 16;
  const padding = 20;
  const maxWidth = 800;
  
  // Split text into lines
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  // Calculate lines based on max width
  const tempCanvas = createCanvas(1, 1);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.font = `${fontSize}px Arial`;
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = tempCtx.measureText(testLine);
    
    if (metrics.width > maxWidth - 2 * padding && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  
  // Create final canvas with calculated dimensions
  const height = lines.length * lineHeight + 2 * padding;
  const canvas = createCanvas(maxWidth, height);
  const ctx = canvas.getContext('2d');
  
  // Draw background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, maxWidth, height);
  
  // Draw text
  ctx.fillStyle = 'black';
  ctx.font = `${fontSize}px Arial`;
  lines.forEach((line, i) => {
    ctx.fillText(line, padding, padding + i * lineHeight + fontSize);
  });
  
  // Convert to base64
  return canvas.toDataURL().split(',')[1];
}

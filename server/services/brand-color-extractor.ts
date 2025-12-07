/**
 * Brand Color Extraction Service
 * Extracts dominant colors from uploaded logos for branding consistency
 */

import { getColor, getPalette } from 'colorthief';

interface ExtractedColors {
  primary: string;
  secondary: string | null;
  accent: string | null;
  background: string | null;
  colors: string[];
}

/**
 * Converts RGB array to hex string
 */
function rgbToHex(rgb: [number, number, number]): string {
  return '#' + rgb.map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Calculates perceived brightness of a color (0-255)
 */
function getBrightness(rgb: [number, number, number]): number {
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
}

/**
 * Calculates color distance between two RGB colors
 */
function colorDistance(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(rgb1[0] - rgb2[0], 2) +
    Math.pow(rgb1[1] - rgb2[1], 2) +
    Math.pow(rgb1[2] - rgb2[2], 2)
  );
}

/**
 * Filters out near-white and near-black colors
 */
function isValidBrandColor(rgb: [number, number, number]): boolean {
  const brightness = getBrightness(rgb);
  // Filter out very light colors (near white) and very dark colors (near black)
  return brightness > 30 && brightness < 240;
}

/**
 * Filters colors to ensure they are distinct enough from each other
 */
function filterDistinctColors(colors: [number, number, number][], minDistance: number = 50): [number, number, number][] {
  const distinct: [number, number, number][] = [];

  for (const color of colors) {
    const isTooSimilar = distinct.some(existing => colorDistance(color, existing) < minDistance);
    if (!isTooSimilar && isValidBrandColor(color)) {
      distinct.push(color);
    }
  }

  return distinct;
}

/**
 * Extracts brand colors from an image buffer
 * @param imageBuffer - Buffer containing the image data
 * @param colorCount - Number of colors to extract (default: 4)
 * @returns Promise with extracted colors
 */
export async function extractBrandColors(imageBuffer: Buffer, colorCount: number = 6): Promise<ExtractedColors> {
  try {
    // ColorThief exports getColor and getPalette as functions that accept buffers directly

    // Get dominant color
    const dominantRgb = await getColor(imageBuffer) as [number, number, number];

    // Get color palette
    const paletteRgb = await getPalette(imageBuffer, colorCount + 2) as [number, number, number][]; // Get extra colors for filtering

    // Filter to get distinct, valid brand colors
    const filteredPalette = filterDistinctColors(paletteRgb).slice(0, colorCount);

    // Convert all colors to hex
    const hexColors = filteredPalette.map(rgb => rgbToHex(rgb));

    // Ensure dominant color is included and is first
    const dominantHex = rgbToHex(dominantRgb);
    if (!hexColors.includes(dominantHex) && isValidBrandColor(dominantRgb)) {
      hexColors.unshift(dominantHex);
    } else if (hexColors[0] !== dominantHex && isValidBrandColor(dominantRgb)) {
      // Move dominant to first position
      const idx = hexColors.indexOf(dominantHex);
      if (idx > 0) {
        hexColors.splice(idx, 1);
        hexColors.unshift(dominantHex);
      }
    }

    // Limit to 4 colors
    const finalColors = hexColors.slice(0, 4);

    console.log(`[BrandColors] Extracted ${finalColors.length} colors:`, finalColors);

    return {
      primary: finalColors[0] || '#3b82f6', // Default to blue if extraction fails
      secondary: finalColors[1] || null,
      accent: finalColors[2] || null,
      background: finalColors[3] || null,
      colors: finalColors
    };
  } catch (error) {
    console.error('[BrandColors] Color extraction failed:', error);
    // Return default colors on error
    return {
      primary: '#3b82f6',
      secondary: null,
      accent: null,
      background: null,
      colors: ['#3b82f6']
    };
  }
}

/**
 * Extracts brand colors from a base64 image string
 * @param base64Image - Base64 encoded image (with or without data URI prefix)
 * @returns Promise with extracted colors
 */
export async function extractBrandColorsFromBase64(base64Image: string): Promise<ExtractedColors> {
  try {
    // Remove data URI prefix if present
    const base64Data = base64Image.includes(',')
      ? base64Image.split(',')[1]
      : base64Image;

    const imageBuffer = Buffer.from(base64Data, 'base64');
    return await extractBrandColors(imageBuffer);
  } catch (error) {
    console.error('[BrandColors] Base64 extraction failed:', error);
    return {
      primary: '#3b82f6',
      secondary: null,
      accent: null,
      background: null,
      colors: ['#3b82f6']
    };
  }
}

/**
 * Extracts brand colors from a file path
 * @param filePath - Path to the image file
 * @returns Promise with extracted colors
 */
export async function extractBrandColorsFromPath(filePath: string): Promise<ExtractedColors> {
  try {
    const fs = await import('fs');
    const imageBuffer = fs.readFileSync(filePath);
    return await extractBrandColors(imageBuffer);
  } catch (error) {
    console.error('[BrandColors] File path extraction failed:', error);
    return {
      primary: '#3b82f6',
      secondary: null,
      accent: null,
      background: null,
      colors: ['#3b82f6']
    };
  }
}

/**
 * Suggests a contrasting text color (black or white) for a given background
 */
export function getContrastingTextColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const brightness = getBrightness([r, g, b]);
  return brightness > 128 ? '#000000' : '#ffffff';
}

/**
 * Removes white/light backgrounds from images by making them transparent.
 * Uses canvas to process pixel data.
 */

/**
 * Detects if an image has a predominantly white/light background
 * by sampling the corners and edges.
 */
export async function hasLightBackground(imageUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(false);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Sample pixels from corners and edges
      const samplePoints = [
        [0, 0], // top-left
        [img.width - 1, 0], // top-right
        [0, img.height - 1], // bottom-left
        [img.width - 1, img.height - 1], // bottom-right
        [Math.floor(img.width / 2), 0], // top-center
        [Math.floor(img.width / 2), img.height - 1], // bottom-center
        [0, Math.floor(img.height / 2)], // left-center
        [img.width - 1, Math.floor(img.height / 2)], // right-center
      ];

      let lightPixels = 0;
      const threshold = 240; // Consider pixels with R, G, B all > 240 as "white"

      for (const [x, y] of samplePoints) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        if (pixel[0] > threshold && pixel[1] > threshold && pixel[2] > threshold) {
          lightPixels++;
        }
      }

      // If more than half of sampled points are light, consider it a light background
      resolve(lightPixels >= samplePoints.length / 2);
    };
    img.onerror = () => resolve(false);
    img.src = imageUrl;
  });
}

/**
 * Removes white/light background from an image and returns a new data URL with transparency.
 * Uses a tolerance-based approach to handle anti-aliasing and slight color variations.
 */
export async function removeWhiteBackground(
  imageUrl: string,
  tolerance: number = 30 // How far from pure white (255) to still consider as background
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const whiteThreshold = 255 - tolerance;

      // First pass: identify background color from corners
      const cornerSamples = [
        ctx.getImageData(0, 0, 1, 1).data,
        ctx.getImageData(img.width - 1, 0, 1, 1).data,
        ctx.getImageData(0, img.height - 1, 1, 1).data,
        ctx.getImageData(img.width - 1, img.height - 1, 1, 1).data,
      ];

      // Check if corners are consistently white/light
      const cornersAreLight = cornerSamples.every(
        pixel => pixel[0] > whiteThreshold && pixel[1] > whiteThreshold && pixel[2] > whiteThreshold
      );

      if (!cornersAreLight) {
        // Background doesn't appear to be white, return original
        resolve(imageUrl);
        return;
      }

      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Check if pixel is close to white
        if (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) {
          // Make it fully transparent
          data[i + 3] = 0;
        } else if (r > whiteThreshold - 20 && g > whiteThreshold - 20 && b > whiteThreshold - 20) {
          // For pixels that are close to white but not quite (anti-aliasing),
          // make them semi-transparent based on how close to white they are
          const avgDistance = ((255 - r) + (255 - g) + (255 - b)) / 3;
          const alpha = Math.min(255, avgDistance * 8); // Scale up the difference
          data[i + 3] = alpha;
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Return as PNG to preserve transparency
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}

/**
 * Detects the dominant background color from image corners.
 * Returns the RGB values and whether the corners are consistent.
 */
async function detectBackgroundColor(imageUrl: string): Promise<{
  r: number;
  g: number;
  b: number;
  isConsistent: boolean;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ r: 255, g: 255, b: 255, isConsistent: false });
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Sample corners
      const corners = [
        ctx.getImageData(0, 0, 1, 1).data,
        ctx.getImageData(img.width - 1, 0, 1, 1).data,
        ctx.getImageData(0, img.height - 1, 1, 1).data,
        ctx.getImageData(img.width - 1, img.height - 1, 1, 1).data,
      ];

      // Calculate average color
      let avgR = 0, avgG = 0, avgB = 0;
      for (const corner of corners) {
        avgR += corner[0];
        avgG += corner[1];
        avgB += corner[2];
      }
      avgR = Math.round(avgR / 4);
      avgG = Math.round(avgG / 4);
      avgB = Math.round(avgB / 4);

      // Check consistency (all corners should be similar)
      const tolerance = 30;
      const isConsistent = corners.every(corner =>
        Math.abs(corner[0] - avgR) < tolerance &&
        Math.abs(corner[1] - avgG) < tolerance &&
        Math.abs(corner[2] - avgB) < tolerance
      );

      resolve({ r: avgR, g: avgG, b: avgB, isConsistent });
    };
    img.onerror = () => resolve({ r: 255, g: 255, b: 255, isConsistent: false });
    img.src = imageUrl;
  });
}

/**
 * Removes any solid background color from an image based on corner detection.
 * More aggressive than white-only removal.
 */
export async function removeAnyBackground(
  imageUrl: string,
  tolerance: number = 35
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const bgColor = await detectBackgroundColor(imageUrl);

      if (!bgColor.isConsistent) {
        // Background is not consistent, don't process
        resolve(imageUrl);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Process each pixel
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Calculate color distance from background
          const distance = Math.sqrt(
            Math.pow(r - bgColor.r, 2) +
            Math.pow(g - bgColor.g, 2) +
            Math.pow(b - bgColor.b, 2)
          );

          if (distance < tolerance) {
            // Make it fully transparent
            data[i + 3] = 0;
          } else if (distance < tolerance + 8) {
            // Narrow anti-aliasing zone to preserve text edges
            const alpha = Math.min(255, (distance - tolerance) * 30);
            data[i + 3] = Math.round(alpha);
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Process a logo: detect background color and remove it.
 * Works with any solid color background, not just white.
 * Returns the processed image URL (or original if no processing needed).
 */
export async function processLogoForDarkBackground(imageUrl: string): Promise<{
  processedUrl: string;
  wasProcessed: boolean;
}> {
  try {
    // Use conservative tolerance to preserve text and fine details
    // Lower tolerance = only remove pixels very close to background color
    const processedUrl = await removeAnyBackground(imageUrl, 18);

    // Check if we actually made changes
    if (processedUrl !== imageUrl) {
      return {
        processedUrl,
        wasProcessed: true
      };
    }

    // Fallback to white-only removal for edge cases (also conservative)
    const hasLight = await hasLightBackground(imageUrl);
    if (hasLight) {
      const whiteRemoved = await removeWhiteBackground(imageUrl, 12);
      return {
        processedUrl: whiteRemoved,
        wasProcessed: whiteRemoved !== imageUrl
      };
    }

    return {
      processedUrl: imageUrl,
      wasProcessed: false
    };
  } catch (error) {
    console.error('Error processing logo:', error);
    return {
      processedUrl: imageUrl,
      wasProcessed: false
    };
  }
}

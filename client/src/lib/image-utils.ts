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
 * Process a logo: detect if it has a white background and remove it if so.
 * Returns the processed image URL (or original if no processing needed).
 */
export async function processLogoForDarkBackground(imageUrl: string): Promise<{
  processedUrl: string;
  wasProcessed: boolean;
}> {
  try {
    const hasLight = await hasLightBackground(imageUrl);

    if (hasLight) {
      const processedUrl = await removeWhiteBackground(imageUrl, 25);
      return {
        processedUrl,
        wasProcessed: processedUrl !== imageUrl
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

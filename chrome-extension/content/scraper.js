/**
 * Content script for scraping webpage data.
 * Extracts metadata, Open Graph tags, Schema.org data, and main content.
 */

// Listen for scrape requests from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape') {
    const data = scrapePageData();
    sendResponse(data);
  }
  return true; // Keep channel open for async response
});

/**
 * Scrape all relevant data from the current page.
 */
function scrapePageData() {
  return {
    title: getTitle(),
    metaDescription: getMetaDescription(),
    ogTitle: getOgTag('og:title'),
    ogDescription: getOgTag('og:description'),
    ogImage: getOgTag('og:image'),
    schemaOrg: getSchemaOrgData(),
    textContent: getMainContent()
  };
}

/**
 * Get page title.
 */
function getTitle() {
  return document.title || '';
}

/**
 * Get meta description.
 */
function getMetaDescription() {
  const meta = document.querySelector('meta[name="description"]');
  return meta ? meta.getAttribute('content') : '';
}

/**
 * Get Open Graph tag content.
 */
function getOgTag(property) {
  const meta = document.querySelector(`meta[property="${property}"]`);
  return meta ? meta.getAttribute('content') : '';
}

/**
 * Extract Schema.org JSON-LD data from the page.
 */
function getSchemaOrgData() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const schemas = [];

  scripts.forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      if (data) {
        schemas.push(data);
      }
    } catch (e) {
      // Ignore invalid JSON
    }
  });

  return schemas.length > 0 ? schemas : null;
}

/**
 * Get main content from the page.
 * Prioritizes <main>, <article>, or falls back to body.
 * Truncates to 50k characters.
 */
function getMainContent() {
  const MAX_LENGTH = 50000;

  // Try to find main content areas
  const mainElement = document.querySelector('main') ||
                      document.querySelector('article') ||
                      document.querySelector('[role="main"]') ||
                      document.querySelector('.main-content') ||
                      document.querySelector('#content') ||
                      document.querySelector('#main');

  let container = mainElement || document.body;

  // Clone to avoid modifying the page
  const clone = container.cloneNode(true);

  // Remove scripts, styles, and navigation elements
  const removeSelectors = [
    'script', 'style', 'noscript', 'iframe',
    'nav', 'header', 'footer', 'aside',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '.navigation', '.nav', '.menu', '.sidebar',
    '.header', '.footer', '.advertisement', '.ad',
    '.cookie-banner', '.popup', '.modal'
  ];

  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Get text content and clean it up
  let text = clone.textContent || '';

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')  // Collapse whitespace
    .replace(/\n\s*\n/g, '\n\n')  // Normalize paragraph breaks
    .trim();

  // Truncate if needed
  if (text.length > MAX_LENGTH) {
    text = text.substring(0, MAX_LENGTH) + '...';
  }

  return text;
}

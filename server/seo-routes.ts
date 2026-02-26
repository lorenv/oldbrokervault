/**
 * SEO Route Handlers
 * Serves optimized HTML for public marketing pages
 */

import { Express, Request, Response } from 'express';
import { renderPageToHTML, generateSitemap, SEO_PAGES } from './ssr-renderer';
import { logger } from './logger';

/**
 * Setup SEO-optimized routes for public pages
 */
export function setupSEORoutes(app: Express) {
  const baseUrl = process.env.BASE_URL || '';
  
  // Cache for rendered pages (in memory for now)
  const pageCache = new Map<string, { html: string; timestamp: number }>();
  const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache

  /**
   * Get cached or render page HTML
   */
  async function getCachedPage(route: string): Promise<string> {
    const cached = pageCache.get(route);
    const now = Date.now();
    
    // Return cached version if it's fresh
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      logger.debug(`Serving cached HTML for route: ${route}`);
      return cached.html;
    }
    
    // Render fresh HTML
    logger.info(`Rendering fresh HTML for SEO route: ${route}`);
    const html = await renderPageToHTML(route, baseUrl);
    
    // Cache the result
    pageCache.set(route, { html, timestamp: now });
    
    return html;
  }

  // SEO Route Handlers
  const seoRoutes = Object.keys(SEO_PAGES);
  
  seoRoutes.forEach(route => {
    app.get(route, async (req: Request, res: Response, next: any) => {
      try {
        // Check if this is a bot/crawler - including social media crawlers
        const userAgent = req.headers['user-agent'] || '';
        const isBot = /bot|crawler|spider|crawling/i.test(userAgent) ||
                     /googlebot|bingbot|slurp|duckduckbot/i.test(userAgent) ||
                     /facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot|discordbot/i.test(userAgent) ||
                     /pinterest|tumblr|reddit|instagram/i.test(userAgent);

        // Serve SEO HTML to bots and social media crawlers
        const shouldServeSEO = isBot;
        
        if (shouldServeSEO) {
          logger.info(`Serving SEO HTML for ${route}`, { 
            userAgent: userAgent.substring(0, 100),
            isBot,
            ip: req.ip 
          });
          
          const html = await getCachedPage(route);
          
          // Set SEO-friendly headers
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour cache
          res.setHeader('X-SEO-Rendered', 'true');
          
          return res.send(html);
        }
        
        // For SPA navigation in development, let it fall through to Vite
        // Don't handle this request - let it continue to the next middleware
        return next();
        
      } catch (error) {
        logger.error(`Error rendering SEO page ${route}`, { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        
        // Fallback to SPA - let other middleware handle it
        return next();
      }
    });
  });

  // Sitemap.xml route
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    try {
      const sitemap = generateSitemap(baseUrl);
      
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hour cache
      res.send(sitemap);
      
      logger.info('Served sitemap.xml');
    } catch (error) {
      logger.error('Error generating sitemap', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      res.status(500).send('Error generating sitemap');
    }
  });

  // Robots.txt route
  app.get('/robots.txt', (req: Request, res: Response) => {
    const robotsTxt = `User-agent: *
Allow: /
Allow: /pricing
Allow: /contact

Disallow: /api/
Disallow: /dashboard
Disallow: /documents
Disallow: /admin
Disallow: /share/
Disallow: /cims/

Sitemap: ${baseUrl}/sitemap.xml`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hour cache
    res.send(robotsTxt);
    
    logger.info('Served robots.txt');
  });

  logger.info(`SEO routes configured for: ${seoRoutes.join(', ')}`);
}

/**
 * Clear the page cache (useful for deployments)
 */
export function clearSEOCache() {
  const pageCache = new Map();
  logger.info('SEO page cache cleared');
}
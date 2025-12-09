import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
}

/**
 * SEO component that updates document head for better search engine optimization.
 * Updates title, meta description, and Open Graph tags.
 */
export function SEOHead({ title, description, canonicalUrl, ogImage }: SEOHeadProps) {
  useEffect(() => {
    // Update document title
    const fullTitle = `${title} | CIM Share`;
    document.title = fullTitle;

    // Update or create meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", description);
    } else {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      metaDescription.setAttribute("content", description);
      document.head.appendChild(metaDescription);
    }

    // Update Open Graph tags
    const ogTags = [
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "twitter:title", content: fullTitle },
      { property: "twitter:description", content: description },
    ];

    if (canonicalUrl) {
      ogTags.push({ property: "og:url", content: canonicalUrl });
      ogTags.push({ property: "twitter:url", content: canonicalUrl });

      // Update canonical link
      let canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        canonical.setAttribute("href", canonicalUrl);
      } else {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        canonical.setAttribute("href", canonicalUrl);
        document.head.appendChild(canonical);
      }
    }

    if (ogImage) {
      ogTags.push({ property: "og:image", content: ogImage });
      ogTags.push({ property: "twitter:image", content: ogImage });
    }

    ogTags.forEach(({ property, content }) => {
      let meta = document.querySelector(`meta[property="${property}"]`);
      if (meta) {
        meta.setAttribute("content", content);
      } else {
        meta = document.createElement("meta");
        meta.setAttribute("property", property);
        meta.setAttribute("content", content);
        document.head.appendChild(meta);
      }
    });

    // Cleanup function to restore defaults when component unmounts
    return () => {
      document.title = "CIM Share - Create Professional CIMs in Minutes with AI";
    };
  }, [title, description, canonicalUrl, ogImage]);

  return null;
}

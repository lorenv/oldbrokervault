# CIM Generator Chrome Extension

A Chrome extension that allows BrokerVault users to generate Company Information Memorandum (CIM) documents from any webpage they're browsing.

## Features

- **One-Click CIM Generation**: Generate professional CIM documents from any company website
- **Smart Content Extraction**: Automatically scrapes page metadata, Open Graph tags, Schema.org data, and main content
- **Background Processing**: CIM generation happens in the background with notifications when complete
- **Recent Documents**: Quick access to your recently created documents
- **Secure Authentication**: Uses secure token-based authentication with your BrokerVault account

## Installation

### For Development/Testing

1. Clone or download this extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `chrome-extension` folder
6. The extension icon should appear in your toolbar

### From Chrome Web Store

*(Coming soon)*

Visit the Chrome Web Store and search for "BrokerVault CIM Generator" or use the direct link.

## Setup

1. Click the extension icon in your Chrome toolbar
2. Click "Sign In"
3. Log in with your BrokerVault account credentials
4. Once authenticated, you're ready to generate CIMs!

## Usage

1. Navigate to any company website (e.g., stripe.com, shopify.com)
2. Click the CIM Generator extension icon
3. Review the detected page title and URL
4. Click "Generate CIM"
5. Wait for the notification that your CIM is ready
6. Click the notification or "View & Edit Document" to open your new CIM

## How It Works

1. **Content Scraping**: The extension extracts:
   - Page title and meta description
   - Open Graph metadata (og:title, og:description, og:image)
   - Schema.org JSON-LD structured data
   - Main page content text

2. **API Processing**: The scraped data is sent to BrokerVault's servers where:
   - AI analyzes the company information
   - A professional CIM document is generated
   - The document is saved to your account

3. **Notification**: Once complete, you receive a browser notification with a link to edit your new CIM.

## Supported Pages

The extension works on most public company websites. It cannot be used on:
- Chrome internal pages (chrome://, chrome-extension://)
- Browser extension pages
- Chrome Web Store
- Local files (file://)
- View source pages

## Troubleshooting

### "Cannot generate CIM from this page"
You're on a restricted page. Navigate to a regular website.

### "Unable to read page content"
Try refreshing the page and clicking the extension again.

### "Sign in failed"
Make sure you have an active BrokerVault account. Check your internet connection.

### "Document creation limit reached"
You've reached your plan's document limit. Upgrade your subscription or wait for your limit to reset.

## Privacy & Security

- Your BrokerVault credentials are never stored in the extension
- Authentication uses secure tokens stored in Chrome's encrypted storage
- Page content is only sent to BrokerVault servers when you click "Generate CIM"
- We do not track your browsing history
- See our full [Privacy Policy](https://brokervault.ai/privacy) for details

## Requirements

- Google Chrome (version 88 or later)
- Active BrokerVault account
- Internet connection

## Support

- **Email**: support@brokervault.ai
- **Documentation**: https://brokervault.ai/docs
- **Issues**: Report bugs or request features through your BrokerVault dashboard

## Version History

### 1.0.0
- Initial release
- One-click CIM generation from any webpage
- Smart content extraction
- Background processing with notifications
- Recent documents list

## License

Copyright 2024 BrokerVault. All rights reserved.

This extension is proprietary software provided for use with the BrokerVault platform.

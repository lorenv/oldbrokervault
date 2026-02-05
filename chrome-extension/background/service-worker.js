/**
 * Background service worker for CIM Generator extension.
 * Handles notifications and background processing.
 */

// Configuration
const BASE_URL = 'https://app.brokervault.ai';

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // "View Document" button clicked
    // The notification ID contains the document ID
    const docId = notificationId.replace('cim-ready-', '');
    if (docId) {
      chrome.tabs.create({ url: `${BASE_URL}/cim/${docId}/edit` });
    }
  }
  chrome.notifications.clear(notificationId);
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  const docId = notificationId.replace('cim-ready-', '');
  if (docId) {
    chrome.tabs.create({ url: `${BASE_URL}/cim/${docId}/edit` });
  }
  chrome.notifications.clear(notificationId);
});

// Utility function to show completion notification
function showCimReadyNotification(docId, title) {
  chrome.notifications.create(`cim-ready-${docId}`, {
    type: 'basic',
    iconUrl: '/icons/icon128.png',
    title: 'CIM Document Ready',
    message: title ? `"${title}" is ready to view and edit.` : 'Your CIM document is ready to view and edit.',
    buttons: [{ title: 'View Document' }],
    priority: 2
  });
}

// Export for use by popup
self.showCimReadyNotification = showCimReadyNotification;

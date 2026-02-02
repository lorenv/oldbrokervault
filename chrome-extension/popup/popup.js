// Configuration
const BASE_URL = 'https://brokervault.ai';
const API_URL = `${BASE_URL}/api/extension`;

// State management
let currentState = 'signedOut';
let authToken = null;
let currentUser = null;
let currentJobId = null;

// DOM elements
const states = {
  signedOut: document.getElementById('signedOutState'),
  ready: document.getElementById('readyState'),
  generating: document.getElementById('generatingState'),
  error: document.getElementById('errorState'),
  success: document.getElementById('successState')
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load stored auth token
  const stored = await chrome.storage.sync.get(['authToken', 'user']);
  if (stored.authToken) {
    authToken = stored.authToken;
    currentUser = stored.user;
    await checkAuthStatus();
  }

  updateUI();

  // Get current page info
  if (currentState === 'ready') {
    await loadPageInfo();
    await loadRecentDocuments();
  }
});

// Event listeners
document.getElementById('signInBtn').addEventListener('click', signIn);
document.getElementById('signOutBtn').addEventListener('click', signOut);
document.getElementById('generateBtn').addEventListener('click', generateCim);
document.getElementById('retryBtn').addEventListener('click', () => {
  setState('ready');
  loadPageInfo();
});

// Authentication functions
async function signIn() {
  // Use Chrome's identity API for a more reliable auth flow
  const redirectUrl = chrome.identity.getRedirectURL();
  const authUrl = `${BASE_URL}/api/extension/auth?redirect_uri=${encodeURIComponent(redirectUrl)}`;

  try {
    // Launch auth flow - this handles the popup and redirect automatically
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    // Extract token from the response URL
    const url = new URL(responseUrl);
    const token = url.searchParams.get('token');
    const userId = url.searchParams.get('user_id');
    const email = url.searchParams.get('email');

    if (token) {
      authToken = token;
      currentUser = { id: parseInt(userId), email: email };

      // Store token
      await chrome.storage.sync.set({
        authToken: authToken,
        user: currentUser
      });

      setState('ready');
      await loadPageInfo();
      await loadRecentDocuments();
    } else {
      throw new Error('No token received');
    }
  } catch (error) {
    console.error('Auth failed:', error);
    if (error.message !== 'The user did not approve access.') {
      showError('Sign in failed. Please try again.');
    }
  }
}

async function signOut() {
  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
  } catch (e) {
    // Ignore logout errors
  }

  authToken = null;
  currentUser = null;
  await chrome.storage.sync.remove(['authToken', 'user']);
  setState('signedOut');
}

async function checkAuthStatus() {
  try {
    const response = await fetch(`${API_URL}/auth/status`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await response.json();

    if (data.authenticated) {
      currentUser = data.user;
      setState('ready');
    } else {
      // Token expired or invalid
      authToken = null;
      currentUser = null;
      await chrome.storage.sync.remove(['authToken', 'user']);
      setState('signedOut');
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    setState('signedOut');
  }
}

// Page info functions
async function loadPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const titleEl = document.getElementById('pageTitle');
    const urlEl = document.getElementById('pageUrl');
    const generateBtn = document.getElementById('generateBtn');

    if (isRestrictedUrl(tab.url)) {
      titleEl.textContent = 'Restricted Page';
      urlEl.textContent = 'Navigate to a company website to generate a CIM';
      generateBtn.disabled = true;
      generateBtn.textContent = 'Not Available';
      generateBtn.classList.add('btn-disabled');
    } else {
      titleEl.textContent = tab.title || 'Untitled Page';
      urlEl.textContent = tab.url;
      generateBtn.disabled = false;
      generateBtn.textContent = 'Generate CIM';
      generateBtn.classList.remove('btn-disabled');
    }
  } catch (error) {
    console.error('Failed to get page info:', error);
  }
}

// Recent documents
async function loadRecentDocuments() {
  try {
    const response = await fetch(`${API_URL}/cim?limit=5`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const data = await response.json();
    const list = document.getElementById('recentDocsList');
    list.innerHTML = '';

    if (data.documents && data.documents.length > 0) {
      data.documents.forEach(doc => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `${BASE_URL}/cim/${doc.id}/edit`;
        a.target = '_blank';
        a.textContent = doc.title;
        li.appendChild(a);
        list.appendChild(li);
      });
    } else {
      list.innerHTML = '<li class="empty">No documents yet</li>';
    }
  } catch (error) {
    console.error('Failed to load recent documents:', error);
  }
}

// Check if URL is restricted (can't inject content scripts)
function isRestrictedUrl(url) {
  if (!url) return true;

  const restrictedPatterns = [
    /^chrome:\/\//,
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^edge:\/\//,
    /^about:/,
    /^file:\/\//,
    /^view-source:/,
    /^data:/,
    /^javascript:/,
    /^https?:\/\/chrome\.google\.com\/webstore/,
    /^https?:\/\/addons\.mozilla\.org/,
    /^https?:\/\/microsoftedge\.microsoft\.com/
  ];

  return restrictedPatterns.some(pattern => pattern.test(url));
}

// CIM Generation
async function generateCim() {
  setState('generating');
  updateSubstep('Scraping page content...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Check for restricted URLs
    if (isRestrictedUrl(tab.url)) {
      throw new Error('Cannot generate CIM from this page. Please navigate to a company website.');
    }

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/scraper.js']
      });
    } catch (injectionError) {
      // Script may already be injected or page doesn't allow injection
      console.log('Script injection note:', injectionError.message);
    }

    // Small delay to ensure script is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    // Request scraped data from content script with timeout
    let scrapedData;
    try {
      scrapedData = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { action: 'scrape' }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Page scraping timed out')), 10000)
        )
      ]);
    } catch (messageError) {
      throw new Error('Unable to read page content. Try refreshing the page and trying again.');
    }

    if (!scrapedData || !scrapedData.title) {
      throw new Error('Could not extract content from this page. Please try a different page.');
    }

    updateSubstep('Starting CIM generation...');

    // Submit to API
    const response = await fetch(`${API_URL}/cim`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceUrl: tab.url,
        scrapedData
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start generation');
    }

    const result = await response.json();
    currentJobId = result.jobId;

    // Poll for completion
    await pollJobStatus();

  } catch (error) {
    console.error('CIM generation failed:', error);
    showError(error.message || 'Failed to generate CIM');
  }
}

async function pollJobStatus() {
  const maxAttempts = 60; // 5 minutes at 5-second intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      updateSubstep(`Processing... (${Math.floor(attempts * 5 / 60)}:${String((attempts * 5) % 60).padStart(2, '0')})`);

      const response = await fetch(`${API_URL}/cim/${currentJobId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const data = await response.json();

      if (data.status === 'completed') {
        // Show success and notification
        showSuccess(data.cimDocumentId, data.editUrl);

        // Send browser notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon128.png',
          title: 'CIM Ready!',
          message: 'Your CIM document has been generated.',
          buttons: [{ title: 'View Document' }]
        });

        return;
      } else if (data.status === 'failed') {
        throw new Error(data.error || 'Generation failed');
      }

      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

    } catch (error) {
      console.error('Poll error:', error);
      throw error;
    }
  }

  throw new Error('Generation timed out');
}

// UI State Management
function setState(state) {
  currentState = state;
  updateUI();
}

function updateUI() {
  // Hide all states
  Object.values(states).forEach(el => el.classList.add('hidden'));

  // Show current state
  switch (currentState) {
    case 'signedOut':
      states.signedOut.classList.remove('hidden');
      break;
    case 'ready':
      states.ready.classList.remove('hidden');
      if (currentUser) {
        document.getElementById('userEmail').textContent = currentUser.email;
      }
      break;
    case 'generating':
      states.generating.classList.remove('hidden');
      break;
    case 'error':
      states.error.classList.remove('hidden');
      break;
    case 'success':
      states.success.classList.remove('hidden');
      break;
  }
}

function updateSubstep(text) {
  document.getElementById('statusSubstep').textContent = text;
}

function showError(message) {
  document.getElementById('errorMessage').textContent = message;
  setState('error');
}

function showSuccess(docId, editUrl) {
  const link = document.getElementById('viewDocLink');
  link.href = `${BASE_URL}${editUrl}`;
  setState('success');
}

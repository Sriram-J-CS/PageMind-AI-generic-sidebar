document.addEventListener('DOMContentLoaded', () => {
  const apiKeyEl = document.getElementById('apiKey');
  const notionTokenEl = document.getElementById('notionToken');
  const notionDbIdEl = document.getElementById('notionDbId');
  const githubTokenEl = document.getElementById('githubToken');
  const slackWebhookEl = document.getElementById('slackWebhook');

  const saveBtn = document.getElementById('saveBtn');
  const testApiKeyBtn = document.getElementById('testApiKeyBtn');
  const openSidebarBtn = document.getElementById('openSidebarBtn');
  const toggleIntegrationsBtn = document.getElementById('toggleIntegrations');
  const integrationsContent = document.getElementById('integrationsContent');
  const statusEl = document.getElementById('status');

  // Toggle Advanced Integrations Accordion
  toggleIntegrationsBtn.addEventListener('click', () => {
    integrationsContent.classList.toggle('show');
    const isShowing = integrationsContent.classList.contains('show');
    toggleIntegrationsBtn.textContent = isShowing 
      ? '⚙️ Advanced MCP Integrations (Notion, GitHub, Slack) ▴' 
      : '⚙️ Advanced MCP Integrations (Notion, GitHub, Slack) ▾';
  });

  // Load saved credentials
  chrome.storage.sync.get(['apiKey', 'notionToken', 'notionDbId', 'githubToken', 'slackWebhook'], (data) => {
    if (data.apiKey) apiKeyEl.value = data.apiKey;
    if (data.notionToken) notionTokenEl.value = data.notionToken;
    if (data.notionDbId) notionDbIdEl.value = data.notionDbId;
    if (data.githubToken) githubTokenEl.value = data.githubToken;
    if (data.slackWebhook) slackWebhookEl.value = data.slackWebhook;

    if (data.notionToken || data.notionDbId || data.githubToken || data.slackWebhook) {
      integrationsContent.classList.add('show');
      toggleIntegrationsBtn.textContent = '⚙️ Advanced MCP Integrations (Notion, GitHub, Slack) ▴';
    }
  });

  // Save Credentials & Auto-Activate
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyEl.value.trim();
    const notionToken = notionTokenEl.value.trim();
    const notionDbId = notionDbIdEl.value.trim();
    const githubToken = githubTokenEl.value.trim();
    const slackWebhook = slackWebhookEl.value.trim();

    chrome.storage.sync.set({ apiKey, notionToken, notionDbId, githubToken, slackWebhook }, async () => {
      showStatus('✅ Saved successfully! Activating PageMind...', 'success');
      await triggerSidebarOnActiveTab();
    });
  });

  // Test OpenAI API Key (or confirm Zero-Setup mode)
  testApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyEl.value.trim();
    if (!apiKey) {
      showStatus('✨ Zero-Setup Active! PageMind works out-of-the-box without an API key.', 'success');
      return;
    }

    testApiKeyBtn.textContent = '⏳ Testing Connection...';
    testApiKeyBtn.disabled = true;

    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (res.ok) {
        showStatus('🎉 OpenAI API key verified successfully!', 'success');
      } else {
        const errData = await res.json().catch(() => ({}));
        showStatus(`❌ API Key Error: ${errData.error?.message || 'Invalid Key'}`, 'error');
      }
    } catch (err) {
      showStatus(`❌ Network error: ${err.message}`, 'error');
    } finally {
      testApiKeyBtn.textContent = '🧪 Test OpenAI Connection';
      testApiKeyBtn.disabled = false;
    }
  });

  // Open Sidebar Button Click
  openSidebarBtn.addEventListener('click', async () => {
    await triggerSidebarOnActiveTab();
  });

  // Helper function to safely inject scripts and toggle sidebar on active tab
  async function triggerSidebarOnActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showStatus('⚠️ Please select an active webpage tab.', 'error');
        return;
      }

      // Check if URL is restrictable by Chrome (chrome:// or edge://)
      if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:'))) {
        showStatus('⚠️ Cannot run on browser internal system pages. Open a normal website!', 'error');
        return;
      }

      // Inject content.js and styles.css programmatically if not already loaded
      try {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      } catch (e) {
        // Already injected or standard injection
      }

      // Send message to toggle sidebar
      chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' }, (res) => {
        if (chrome.runtime.lastError) {
          // Retry sending message after brief pause
          setTimeout(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' }, () => {
              window.close();
            });
          }, 200);
        } else {
          window.close();
        }
      });
    } catch (err) {
      showStatus(`⚠️ Error: ${err.message}`, 'error');
    }
  }

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = `status-toast ${type}`;
    statusEl.style.display = 'block';
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 4000);
  }
});

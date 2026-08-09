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

  // Toggle Advanced Integrations
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

    // Show advanced section if any advanced token is present
    if (data.notionToken || data.notionDbId || data.githubToken || data.slackWebhook) {
      integrationsContent.classList.add('show');
      toggleIntegrationsBtn.textContent = '⚙️ Advanced MCP Integrations (Notion, GitHub, Slack) ▴';
    }
  });

  // Save Credentials
  saveBtn.addEventListener('click', () => {
    const apiKey = apiKeyEl.value.trim();
    const notionToken = notionTokenEl.value.trim();
    const notionDbId = notionDbIdEl.value.trim();
    const githubToken = githubTokenEl.value.trim();
    const slackWebhook = slackWebhookEl.value.trim();

    chrome.storage.sync.set({ apiKey, notionToken, notionDbId, githubToken, slackWebhook }, () => {
      showStatus('✅ Saved successfully! Press Alt+P on any webpage to open PageMind.', 'success');
    });
  });

  // Test OpenAI API Key
  testApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyEl.value.trim();
    if (!apiKey) {
      showStatus('⚠️ Please enter an OpenAI API Key to test.', 'error');
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

  // Open Sidebar on Current Tab
  openSidebarBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { action: 'toggle_sidebar' }, (response) => {
        if (chrome.runtime.lastError) {
          showStatus('⚠️ Please refresh the target webpage to inject PageMind.', 'error');
        } else {
          window.close();
        }
      });
    }
  });

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = `status-toast ${type}`;
    statusEl.style.display = 'block';
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 4000);
  }
});

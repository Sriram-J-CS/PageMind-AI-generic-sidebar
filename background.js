// Service Worker for PageMind Chrome Extension
'use strict';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('🔮 PageMind V3 Installed');
  
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'pagemind_toggle',
        title: '🔮 Toggle PageMind 3D Sidebar',
        contexts: ['page', 'selection']
      }, () => { if (chrome.runtime.lastError) {} });

      chrome.contextMenus.create({
        id: 'pagemind_vision',
        title: '🎯 Annotate with PageMind Vision',
        contexts: ['page', 'selection']
      }, () => { if (chrome.runtime.lastError) {} });

      chrome.contextMenus.create({
        id: 'pagemind_agent',
        title: '🤖 Control with PageMind Agent',
        contexts: ['page', 'selection']
      }, () => { if (chrome.runtime.lastError) {} });

      chrome.contextMenus.create({
        id: 'pagemind_mcp',
        title: '🔗 Create Notion Task (MCP)',
        contexts: ['page', 'selection']
      }, () => { if (chrome.runtime.lastError) {} });
    });
  }
});

// Helper function to inject script and send message safely
async function safeSendMessage(tabId, message) {
  if (!tabId) return;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      return;
    }

    try {
      await chrome.scripting.insertCSS({ target: { tabId: tabId }, files: ['styles.css'] });
      await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] });
    } catch (e) {}

    chrome.tabs.sendMessage(tabId, message, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch (e) {}
}

// Handle Context Menu Clicks
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) return;

    if (info.menuItemId === 'pagemind_toggle') {
      safeSendMessage(tab.id, { action: 'toggle_sidebar' });
    } else if (info.menuItemId === 'pagemind_vision') {
      safeSendMessage(tab.id, { action: 'trigger_mode', mode: 'vision', selection: info.selectionText });
    } else if (info.menuItemId === 'pagemind_agent') {
      safeSendMessage(tab.id, { action: 'trigger_mode', mode: 'agent', selection: info.selectionText });
    } else if (info.menuItemId === 'pagemind_mcp') {
      safeSendMessage(tab.id, { action: 'trigger_mode', mode: 'mcp', selection: info.selectionText });
    }
  });
}

// Handle Action Icon Click if popup is not active
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener((tab) => {
    if (tab && tab.id) {
      safeSendMessage(tab.id, { action: 'toggle_sidebar' });
    }
  });
}

// Service Worker Keep-Alive & Message Router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok', time: new Date().toISOString() });
  } else if (request.action === 'ensure_injected' && sender.tab && sender.tab.id) {
    safeSendMessage(sender.tab.id, { action: 'ping' });
    sendResponse({ status: 'ok' });
  }
  return true;
});

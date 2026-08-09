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
  
  // Safely setup Context Menus
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
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

// Handle Context Menu Clicks
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab || !tab.id) return;

    if (info.menuItemId === 'pagemind_vision') {
      chrome.tabs.sendMessage(tab.id, { action: 'trigger_mode', mode: 'vision', selection: info.selectionText }, () => { if (chrome.runtime.lastError) {} });
    } else if (info.menuItemId === 'pagemind_agent') {
      chrome.tabs.sendMessage(tab.id, { action: 'trigger_mode', mode: 'agent', selection: info.selectionText }, () => { if (chrome.runtime.lastError) {} });
    } else if (info.menuItemId === 'pagemind_mcp') {
      chrome.tabs.sendMessage(tab.id, { action: 'trigger_mode', mode: 'mcp', selection: info.selectionText }, () => { if (chrome.runtime.lastError) {} });
    }
  });
}

// Service Worker Keep-Alive & Message Router
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok', time: new Date().toISOString() });
  }
  return true;
});

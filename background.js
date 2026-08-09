// Service Worker for PageMind Chrome Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('🔮 PageMind V3 Installed');
  
  // Create Context Menus for instant access on any webpage
  chrome.contextMenus.create({
    id: 'pagemind_vision',
    title: '🎯 Annotate with PageMind Vision',
    contexts: ['page', 'selection']
  });

  chrome.contextMenus.create({
    id: 'pagemind_agent',
    title: '🤖 Control with PageMind Agent',
    contexts: ['page', 'selection']
  });

  chrome.contextMenus.create({
    id: 'pagemind_mcp',
    title: '🔗 Create Notion Task (MCP)',
    contexts: ['page', 'selection']
  });
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'pagemind_vision') {
    chrome.tabs.sendMessage(tab.id, { action: 'trigger_mode', mode: 'vision', selection: info.selectionText });
  } else if (info.menuItemId === 'pagemind_agent') {
    chrome.tabs.sendMessage(tab.id, { action: 'trigger_mode', mode: 'agent', selection: info.selectionText });
  } else if (info.menuItemId === 'pagemind_mcp') {
    chrome.tabs.sendMessage(tab.id, { action: 'trigger_mode', mode: 'mcp', selection: info.selectionText });
  }
});

// Relay messages if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok', time: new Date().toISOString() });
  }
  return true;
});

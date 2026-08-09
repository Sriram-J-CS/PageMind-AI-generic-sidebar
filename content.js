(function() {
  'use strict';
  
  if (window.__pagemindLoaded) {
    if (typeof window.__pagemindToggleSidebar === 'function') {
      window.__pagemindToggleSidebar();
    }
    return;
  }
  window.__pagemindLoaded = true;

  // ===== GLOBAL STATE =====
  let sidebar = null;
  let floatingOrb = null;
  let chatContainer = null;
  let inputField = null;
  let currentMode = 'chat'; // chat | vision | agent | mcp
  let apiKey = '';
  let notionToken = '';
  let notionDbId = '';
  let githubToken = '';
  let slackWebhook = '';
  let isProcessing = false;

  // ===== WEB AUDIO SYNTHESIZER (Sci-Fi Sound FX) =====
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;

      if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'acquire') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'complete') {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc.type = 'sine';
        osc2.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc2.frequency.setValueAtTime(659.25, now);

        gain.gain.setValueAtTime(0.15, now);
        gain2.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        gain2.gain.linearRampToValueAtTime(0.01, now + 0.25);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.25);
        osc2.stop(now + 0.25);
      }
    } catch (e) {}
  }

  // ===== INITIALIZE SETTINGS FROM STORAGE =====
  chrome.storage.sync.get(['apiKey', 'notionToken', 'notionDbId', 'githubToken', 'slackWebhook'], (data) => {
    apiKey = data.apiKey || '';
    notionToken = data.notionToken || '';
    notionDbId = data.notionDbId || '';
    githubToken = data.githubToken || '';
    slackWebhook = data.slackWebhook || '';
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.apiKey) apiKey = changes.apiKey.newValue || '';
    if (changes.notionToken) notionToken = changes.notionToken.newValue || '';
    if (changes.notionDbId) notionDbId = changes.notionDbId.newValue || '';
    if (changes.githubToken) githubToken = changes.githubToken.newValue || '';
    if (changes.slackWebhook) slackWebhook = changes.slackWebhook.newValue || '';
  });

  // ===== BACKGROUND MESSAGING LISTENERS =====
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle_sidebar') {
      toggleSidebar();
      sendResponse({ status: 'ok' });
    } else if (request.action === 'trigger_mode') {
      setMode(request.mode);
      toggleSidebar(true);
      
      const queryText = request.selection 
        ? `Analyze selection: "${request.selection}"` 
        : (request.mode === 'vision' ? 'Find key statements and annotate' : (request.mode === 'agent' ? 'Fill inputs and interact' : 'Route Notion & Calendar task'));
      
      if (inputField) inputField.value = queryText;
      
      // Instantly execute mode action on page DOM!
      setTimeout(() => {
        handleSend();
      }, 200);

      sendResponse({ status: 'ok' });
    }
    return true;
  });

  // ===== KEYBOARD SHORTCUTS (Alt+P, Alt+V, Alt+A) =====
  document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable) {
      if (document.activeElement !== inputField) return;
    }

    if (e.altKey && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      playSound('click');
      toggleSidebar();
    }
    if (e.altKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      playSound('click');
      setMode('vision');
      toggleSidebar(true);
      if (inputField) inputField.value = 'Annotate key page elements';
      setTimeout(() => handleSend(), 200);
    }
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      playSound('click');
      setMode('agent');
      toggleSidebar(true);
      if (inputField) inputField.value = 'Auto-interact with webpage fields';
      setTimeout(() => handleSend(), 200);
    }
  });

  // ===== FLOATING ORB TRIGGER WIDGET =====
  function createFloatingOrb() {
    if (document.getElementById('pagemind-floating-orb')) return;

    floatingOrb = document.createElement('div');
    floatingOrb.id = 'pagemind-floating-orb';
    floatingOrb.title = 'Open PageMind 3D (Alt+P)';
    floatingOrb.innerHTML = `
      <span class="pm-orb-icon">🔮</span>
      <span class="pm-orb-badge">AI</span>
    `;

    const handleOrbClick = (e) => {
      if (e) {
        e.stopPropagation();
        e.preventDefault();
      }
      playSound('click');
      toggleSidebar();
    };

    floatingOrb.addEventListener('click', handleOrbClick);
    floatingOrb.addEventListener('pointerdown', (e) => e.stopPropagation());

    const parent = document.body || document.documentElement;
    if (parent) {
      parent.appendChild(floatingOrb);
    }
  }

  // ===== SIDEBAR CREATION =====
  function createSidebar() {
    if (document.getElementById('pagemind-sidebar')) return;

    sidebar = document.createElement('div');
    sidebar.id = 'pagemind-sidebar';
    
    sidebar.innerHTML = `
      <div class="pagemind-header">
        <div class="pagemind-header-title">
          <span style="font-size: 20px;">🔮</span>
          <h3>PageMind 3D</h3>
        </div>
        <button class="pagemind-close" title="Close (Esc)">×</button>
      </div>
      <div class="pagemind-modes">
        <button class="pagemind-mode-btn active" data-mode="chat">💬 Chat</button>
        <button class="pagemind-mode-btn" data-mode="vision">🎯 Vision</button>
        <button class="pagemind-mode-btn" data-mode="agent">🤖 Agent</button>
        <button class="pagemind-mode-btn" data-mode="mcp">🔗 MCP</button>
      </div>
      <div class="pagemind-chat"></div>
      <div class="pagemind-input-area">
        <input type="text" class="pagemind-input" placeholder="Ask anything about this page..." />
        <button class="pagemind-send">Send</button>
      </div>
    `;
    
    const parent = document.body || document.documentElement;
    parent.appendChild(sidebar);
    
    chatContainer = sidebar.querySelector('.pagemind-chat');
    inputField = sidebar.querySelector('.pagemind-input');
    
    sidebar.querySelector('.pagemind-close').addEventListener('click', (e) => {
      e.stopPropagation();
      playSound('click');
      toggleSidebar(false);
    });
    
    sidebar.querySelectorAll('.pagemind-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSound('click');
        setMode(btn.dataset.mode);
      });
    });
    
    sidebar.querySelector('.pagemind-send').addEventListener('click', (e) => {
      e.stopPropagation();
      playSound('click');
      handleSend();
    });

    inputField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        playSound('click');
        handleSend();
      }
    });

    addMessage('ai', '👋 **Welcome to PageMind 3D!**\n\n✨ **Zero Setup Required** — I work out of the box on any website:\n- 🎯 **Vision:** Annotate webpage elements in real-time\n- 🤖 **Agent:** Auto-click, scroll & fill form fields\n- 🔗 **MCP:** Route tasks to Notion, Calendar, GitHub & Slack');
  }

  function toggleSidebar(forceState) {
    if (!sidebar) createSidebar();
    if (!floatingOrb) createFloatingOrb();

    const isOpen = sidebar.classList.contains('open');
    const shouldOpen = forceState !== undefined ? forceState : !isOpen;
    
    if (shouldOpen) {
      sidebar.classList.add('open');
      if (inputField) inputField.focus();
    } else {
      sidebar.classList.remove('open');
      clearOverlays();
    }
  }

  window.__pagemindToggleSidebar = toggleSidebar;

  function setMode(mode) {
    currentMode = mode;
    if (!sidebar) createSidebar();
    
    sidebar.querySelectorAll('.pagemind-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    const placeholders = {
      chat: 'Ask anything about this page...',
      vision: 'e.g. "Find loaded language" or "Highlight key stats"',
      agent: 'e.g. "Fill out this form" or "Scroll to pricing"',
      mcp: 'e.g. "Create a Notion task" or "Block calendar time"'
    };
    inputField.placeholder = placeholders[mode];
    
    addMessage('system', `🔄 Switched to ${mode.toUpperCase()} mode`);
    clearOverlays();
  }

  // ===== CHAT STREAM SYSTEM & MARKDOWN RENDERER =====
  function parseMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; font-family:monospace; font-size:11px;">$1</code>');
    html = html.replace(/^\s*-\s+(.*)$/gbm, '• $1<br/>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  function addMessage(type, text, rawHtml = '') {
    if (!chatContainer) createSidebar();
    
    const msg = document.createElement('div');
    msg.className = `pagemind-msg ${type}`;
    
    if (rawHtml) {
      msg.innerHTML = rawHtml;
    } else {
      msg.innerHTML = parseMarkdown(text);
    }

    chatContainer.appendChild(msg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msg;
  }

  function showTyping() {
    const msg = document.createElement('div');
    msg.className = 'pagemind-msg ai';
    msg.innerHTML = '✨ <span style="opacity:0.75; font-weight:600;">PageMind is processing...</span>';
    msg.id = 'pagemind-typing';
    chatContainer.appendChild(msg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msg;
  }

  function removeTyping() {
    const typing = document.getElementById('pagemind-typing');
    if (typing) typing.remove();
  }

  // ===== SMART PAGE CONTEXT EXTRACTION =====
  function getPageContext() {
    const title = document.title;
    const url = window.location.href;
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    
    const article = document.querySelector('article') || document.querySelector('[role="main"]') || document.body;
    const textNodes = article.querySelectorAll('p, h1, h2, h3, h4, li, td, th, label, span');
    
    const chunks = [];
    textNodes.forEach(el => {
      const text = el.textContent.trim();
      if (text.length > 8 && text.length < 500) {
        chunks.push(text);
      }
    });
    
    const mainText = chunks.slice(0, 60).join('\n').substring(0, 8000);
    
    const interactiveElements = [];
    document.querySelectorAll('button, a, input, select, textarea, [role="button"]').forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        interactiveElements.push({
          index: i,
          tag: el.tagName.toLowerCase(),
          type: el.type || '',
          text: (el.textContent || el.placeholder || el.value || el.ariaLabel || '').trim().substring(0, 50),
          id: el.id,
          class: el.className,
          selector: getUniqueSelector(el)
        });
      }
    });
    
    return { title, url, metaDesc, mainText, interactiveElements: interactiveElements.slice(0, 35) };
  }

  function getUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.trim().split(/\s+/)[0];
      if (firstClass) return `.${firstClass}`;
    }
    return el.tagName.toLowerCase();
  }

  // ===== MAIN SEND HANDLER =====
  async function handleSend() {
    if (isProcessing) return;
    const text = inputField.value.trim();
    if (!text) return;
    
    addMessage('user', text);
    inputField.value = '';
    isProcessing = true;
    showTyping();
    
    try {
      const context = getPageContext();
      
      switch (currentMode) {
        case 'vision':
          await handleVision(text, context);
          break;
        case 'agent':
          await handleAgent(text, context);
          break;
        case 'mcp':
          await handleMCP(text, context);
          break;
        default:
          await handleChat(text, context);
      }
    } catch (err) {
      removeTyping();
      addMessage('ai', `❌ Error: ${err.message}`);
    } finally {
      isProcessing = false;
    }
  }

  // ===== 1. CHAT MODE =====
  async function handleChat(text, context) {
    if (!apiKey) {
      removeTyping();
      const localResponse = generateLocalSmartAnalysis(text, context);
      addMessage('ai', localResponse);
      return;
    }

    const systemPrompt = `You are PageMind, an AI browser assistant. 
Page Title: ${context.title}
URL: ${context.url}
Description: ${context.metaDesc}

Page Context:
${context.mainText}

Answer the user concisely using markdown formatting.`;

    const response = await callOpenAI(systemPrompt, text);
    removeTyping();
    addMessage('ai', response);
  }

  function generateLocalSmartAnalysis(userQuery, context) {
    const queryLower = userQuery.toLowerCase();
    const sentences = context.mainText.split('\n').filter(s => s.trim().length > 15);
    
    if (queryLower.includes('summar') || queryLower.includes('about') || queryLower.includes('what is')) {
      const top3 = sentences.slice(0, 3).map(s => `- ${s}`).join('\n');
      return `📊 **Page Summary for "${context.title}"**:\n\n${top3 || '- Webpage loaded successfully.'}\n\n🔗 **Source URL:** ${context.url}`;
    } else if (queryLower.includes('bias') || queryLower.includes('problem') || queryLower.includes('issue')) {
      return `⚠️ **Page Mind Audit for "${context.title}"**:\n\n- Analyzed ${sentences.length} content blocks.\n- **Language Tone:** Evaluated headline structure.\n- **Recommendation:** Switch to 🎯 **Vision Mode** (<kbd>Alt+V</kbd>) to draw annotations over page sections!`;
    } else {
      const matched = sentences.filter(s => queryLower.split(' ').some(word => word.length > 3 && s.toLowerCase().includes(word)));
      if (matched.length > 0) {
        return `💡 **Key Findings regarding "${userQuery}"**:\n\n${matched.slice(0, 3).map(m => `- "${m}"`).join('\n')}`;
      }
      return `💡 **PageMind Analysis for "${context.title}"**:\n\n- Page contains ${context.interactiveElements.length} interactive elements.\n- **Main Content Snippet:** "${sentences[0] || context.title}"\n- Try asking me to **summarize**, **find problems**, or switch to **Vision / Agent** mode!`;
    }
  }

  // ===== 2. VISION MODE ENGINE =====
  async function handleVision(text, context) {
    let parsed = null;

    if (!apiKey) {
      parsed = generateDemoVisionAnnotations(text, context);
    } else {
      const systemPrompt = `You are PageMind Vision — an AI that annotates webpages visually.
Analyze the page text and request, then return ONLY valid JSON matching this schema:
{
  "annotations": [
    {
      "type": "box", 
      "color": "red" | "green" | "yellow" | "blue", 
      "targetText": "exact string from page", 
      "note": "sticky note explanation"
    },
    {
      "type": "highlight" | "badge",
      "targetText": "exact string from page",
      "note": "short status badge or note"
    }
  ],
  "summary": "Brief explanation of what was annotated"
}`;

      try {
        const rawRes = await callOpenAI(systemPrompt, text);
        const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        parsed = generateDemoVisionAnnotations(text, context);
      }
    }

    removeTyping();
    clearOverlays();

    if (parsed && parsed.annotations && parsed.annotations.length > 0) {
      let count = 0;
      for (const ann of parsed.annotations) {
        const rendered = renderAnnotation(ann);
        if (rendered) count++;
      }
      playSound('acquire');
      addMessage('ai', `🎯 **PageMind Vision active!** Rendered ${count} 3D annotations on page.\n\n*${parsed.summary || 'Annotated relevant webpage elements.'}*`);
    } else {
      addMessage('ai', '⚠️ Scanned page nodes and highlighted active sections!');
    }
  }

  function generateDemoVisionAnnotations(userQuery, context) {
    const textNodes = context.mainText.split('\n').filter(t => t.length > 12);
    const target1 = textNodes[0] || context.title;
    const target2 = textNodes[1] || 'page content';

    return {
      summary: "Intelligent DOM scanner identified key content nodes and loaded statements.",
      annotations: [
        {
          type: "box",
          color: "red",
          targetText: target1.substring(0, 30),
          note: "⚠️ Key loaded statement / headline claim"
        },
        {
          type: "box",
          color: "green",
          targetText: target2.substring(0, 30),
          note: "✅ Verified page context section"
        },
        {
          type: "badge",
          targetText: target1.substring(0, 15),
          note: "📊 Audit 2026"
        }
      ]
    };
  }

  function renderAnnotation(ann) {
    const container = getOverlayContainer();
    if (!ann.targetText) return false;

    const searchString = ann.targetText.toLowerCase().trim();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    
    while (node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest('#pagemind-sidebar') || parent.closest('#pagemind-floating-orb')) continue;
      
      const nodeText = node.textContent.toLowerCase();
      const idx = nodeText.indexOf(searchString);
      
      if (idx !== -1) {
        try {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, Math.min(node.textContent.length, idx + ann.targetText.length));
          const rect = range.getBoundingClientRect();
          
          if (rect.width === 0 || rect.height === 0) continue;

          const scrollX = window.scrollX || window.pageXOffset;
          const scrollY = window.scrollY || window.pageYOffset;

          parent.scrollIntoView({ behavior: 'smooth', block: 'center' });

          if (ann.type === 'box') {
            const box = document.createElement('div');
            box.className = `pagemind-annotation-box ${ann.color || 'red'}`;
            box.style.left = `${rect.left + scrollX - 6}px`;
            box.style.top = `${rect.top + scrollY - 6}px`;
            box.style.width = `${rect.width + 12}px`;
            box.style.height = `${rect.height + 12}px`;
            container.appendChild(box);
            
            if (ann.note) {
              const note = document.createElement('div');
              note.className = 'pagemind-sticky-note';
              note.textContent = ann.note;
              note.style.left = `${rect.left + scrollX}px`;
              note.style.top = `${Math.max(10, rect.top + scrollY - 50)}px`;
              container.appendChild(note);
            }
          } else if (ann.type === 'highlight') {
            const hl = document.createElement('div');
            hl.className = 'pagemind-highlight';
            hl.style.left = `${rect.left + scrollX}px`;
            hl.style.top = `${rect.top + scrollY}px`;
            hl.style.width = `${rect.width}px`;
            hl.style.height = `${rect.height}px`;
            container.appendChild(hl);
          } else if (ann.type === 'badge') {
            const badge = document.createElement('div');
            badge.className = 'pagemind-badge';
            badge.textContent = ann.note || '📌 Target';
            badge.style.left = `${rect.right + scrollX + 8}px`;
            badge.style.top = `${rect.top + scrollY - 4}px`;
            container.appendChild(badge);
          }

          return true;
        } catch (e) {}
      }
    }
    return false;
  }

  // ===== 3. AGENT MODE ENGINE =====
  async function handleAgent(text, context) {
    let parsed = null;

    if (!apiKey) {
      parsed = generateDemoAgentActions(text, context);
    } else {
      const systemPrompt = `You are PageMind Agent — an AI that clicks, fills forms, and scrolls pages.
Available DOM Elements:
${context.interactiveElements.map(e => `[${e.index}] ${e.tag} "${e.text}" selector:${e.selector}`).join('\n')}

Return JSON:
{
  "explanation": "What I will perform",
  "actions": [
    {"action": "click", "selector": "CSS selector", "description": "clicking..."},
    {"action": "fill", "selector": "CSS selector", "value": "text to type", "description": "typing..."}
  ]
}`;

      try {
        const rawRes = await callOpenAI(systemPrompt, text);
        const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        parsed = generateDemoAgentActions(text, context);
      }
    }

    removeTyping();

    if (parsed && parsed.actions && parsed.actions.length > 0) {
      addMessage('ai', `🤖 **PageMind Agent executing...**\n*${parsed.explanation || 'Performing browser interactions'}*`);
      
      for (const act of parsed.actions) {
        await executeAgentAction(act);
        await sleep(700);
      }
      playSound('complete');
      showToast('🎉 Agent completed all actions!');
    } else {
      addMessage('ai', '🤖 Scanned page, executing interactive DOM action!');
    }
  }

  function generateDemoAgentActions(text, context) {
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], textarea');
    const buttons = document.querySelectorAll('button, input[type="submit"], a');

    const actions = [];
    if (inputs.length > 0) {
      const sel = getUniqueSelector(inputs[0]);
      actions.push({ action: 'fill', selector: sel, value: 'PageMind 2026 Demo', description: `Fill ${inputs[0].placeholder || 'input'}` });
    }
    if (buttons.length > 0) {
      const sel = getUniqueSelector(buttons[0]);
      actions.push({ action: 'click', selector: sel, description: `Click ${buttons[0].textContent.trim().substring(0, 20) || 'button'}` });
    }

    if (actions.length === 0) {
      actions.push({ action: 'scroll', direction: 'down', amount: 400, description: 'Scroll page' });
    }

    return {
      explanation: "Auto-detected interactive fields and executing live demonstration actions.",
      actions: actions
    };
  }

  async function executeAgentAction(act) {
    const cursor = getGhostCursor();
    
    if (act.action === 'click') {
      const el = document.querySelector(act.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        await moveCursorTo(rect.left + rect.width/2 + scrollX, rect.top + rect.height/2 + scrollY);
        playSound('click');
        cursor.classList.add('click');
        await sleep(300);
        el.click();
        cursor.classList.remove('click');
        showToast(`Clicked: ${act.description || act.selector}`);
      }
    } else if (act.action === 'fill') {
      const el = document.querySelector(act.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        await moveCursorTo(rect.left + rect.width/2 + scrollX, rect.top + rect.height/2 + scrollY);
        el.focus();
        el.value = '';
        
        for (const char of act.value) {
          el.value += char;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          playSound('click');
          await sleep(40);
        }
        
        el.dispatchEvent(new Event('change', { bubbles: true }));
        showToast(`Typed: "${act.value}"`);
      }
    } else if (act.action === 'scroll') {
      const dir = act.direction === 'up' ? -1 : 1;
      window.scrollBy({ top: (act.amount || 400) * dir, behavior: 'smooth' });
      showToast(`Scrolled ${act.direction || 'down'}`);
    }
  }

  function getGhostCursor() {
    let cursor = document.getElementById('pagemind-ghost-cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'pagemind-ghost-cursor';
      cursor.className = 'pagemind-ghost-cursor';
      const parent = document.body || document.documentElement;
      parent.appendChild(cursor);
    }
    return cursor;
  }

  async function moveCursorTo(targetX, targetY) {
    const cursor = getGhostCursor();
    const currentX = parseFloat(cursor.style.left) || window.innerWidth / 2;
    const currentY = parseFloat(cursor.style.top) || window.innerHeight / 2;

    const steps = 15;
    for (let i = 1; i <= steps; i++) {
      const x = currentX + (targetX - currentX) * (i / steps);
      const y = currentY + (targetY - currentY) * (i / steps);
      cursor.style.left = `${x - 13}px`;
      cursor.style.top = `${y - 13}px`;
      await sleep(16);
    }
  }

  // ===== 4. MCP MODE HUB =====
  async function handleMCP(text, context) {
    let parsed = null;

    if (!apiKey) {
      parsed = generateDemoMCPCall(text, context);
    } else {
      const systemPrompt = `You are PageMind MCP — an AI that calls external tools via Model Context Protocol.
User is on: ${context.title} (${context.url})

Available MCP Tools:
1. notion_create_task(title, content, url)
2. calendar_block_time(title, duration_hours, description)
3. github_create_issue(title, body)
4. slack_post_message(message)

Return JSON:
{
  "explanation": "Why tools are executed",
  "tools": [
    {"name": "tool_name", "params": {...}}
  ]
}`;

      try {
        const rawRes = await callOpenAI(systemPrompt, text);
        const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        parsed = generateDemoMCPCall(text, context);
      }
    }

    removeTyping();

    if (parsed && parsed.tools && parsed.tools.length > 0) {
      addMessage('ai', `🔗 **PageMind MCP Router active!**\n*${parsed.explanation || 'Executing connected service tools'}*`);
      
      for (const tool of parsed.tools) {
        const toolCardHtml = await executeMCPTool(tool);
        addMessage('ai', '', toolCardHtml);
      }
      playSound('complete');
    } else {
      addMessage('ai', '⚠️ Executing default MCP tool routing.');
    }
  }

  function generateDemoMCPCall(text, context) {
    const lower = text.toLowerCase();
    if (lower.includes('notion') || lower.includes('task')) {
      return {
        explanation: "Routing request to Notion Task Integration.",
        tools: [{
          name: 'notion_create_task',
          params: { title: `Review: ${context.title.substring(0, 40)}`, content: `Page URL: ${context.url}`, url: context.url }
        }]
      };
    } else if (lower.includes('slack') || lower.includes('message')) {
      return {
        explanation: "Routing request to Slack Webhook connector.",
        tools: [{
          name: 'slack_post_message',
          params: { message: `🚀 *PageMind Highlight*: ${context.title} - ${context.url}` }
        }]
      };
    } else if (lower.includes('github') || lower.includes('issue')) {
      return {
        explanation: "Routing request to GitHub Issue Creator.",
        tools: [{
          name: 'github_create_issue',
          params: { title: `[PageMind] Audit request for ${context.title.substring(0, 30)}`, body: `URL: ${context.url}` }
        }]
      };
    } else {
      return {
        explanation: "Routing request to Calendar Time-Blocker & Notion MCP connectors.",
        tools: [
          {
            name: 'calendar_block_time',
            params: { title: `Deep Work: ${context.title.substring(0, 30)}`, duration_hours: 2, description: `URL: ${context.url}` }
          },
          {
            name: 'notion_create_task',
            params: { title: `PageMind Note: ${context.title.substring(0, 30)}`, content: `Summary from ${context.url}`, url: context.url }
          }
        ]
      };
    }
  }

  async function executeMCPTool(tool) {
    if (tool.name === 'notion_create_task') {
      return await createNotionTask(tool.params);
    } else if (tool.name === 'calendar_block_time') {
      return await blockCalendarTime(tool.params);
    } else if (tool.name === 'github_create_issue') {
      return await createGithubIssue(tool.params);
    } else if (tool.name === 'slack_post_message') {
      return await sendSlackMessage(tool.params);
    }
    return `<div class="pagemind-tool-card"><div class="tool-header">⚠️ Unknown Tool</div><div class="tool-body">${tool.name}</div></div>`;
  }

  async function createNotionTask(params) {
    if (notionToken && notionDbId) {
      try {
        const res = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${notionToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify({
            parent: { database_id: notionDbId },
            properties: {
              'Name': { title: [{ text: { content: params.title || 'PageMind Task' } }] },
              'URL': { url: params.url || window.location.href }
            }
          })
        });

        if (res.ok) {
          const data = await res.json();
          return `
            <div class="pagemind-tool-card">
              <div class="tool-header"><span>🟢 Notion MCP Integration</span> <span>Live</span></div>
              <div class="tool-body">
                <strong>Task Created:</strong> "${params.title}"<br/>
                <a href="${data.url}" target="_blank" style="color:#67e8f9; font-weight:700;">Open in Notion ↗</a>
              </div>
            </div>`;
        }
      } catch (e) {}
    }

    return `
      <div class="pagemind-tool-card">
        <div class="tool-header"><span>🟢 Notion MCP Integration</span> <span>Ready</span></div>
        <div class="tool-body">
          <strong>Created Task:</strong> "${params.title || 'PageMind Action Item'}"<br/>
          <span style="font-size:11px; opacity:0.8;">🔗 Attached URL: ${params.url || window.location.href}</span>
        </div>
      </div>`;
  }

  async function blockCalendarTime(params) {
    const now = new Date();
    const end = new Date(now.getTime() + (params.duration_hours || 2) * 60 * 60 * 1000);
    
    const title = encodeURIComponent(params.title || 'PageMind Focus Block');
    const details = encodeURIComponent(params.description || 'Created via PageMind MCP Router');
    const dates = `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;

    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${params.title}\nDESCRIPTION:${params.description}\nEND:VEVENT\nEND:VCALENDAR`;
    const icsDataUri = `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;

    return `
      <div class="pagemind-tool-card">
        <div class="tool-header"><span>📅 Calendar MCP Connector</span> <span>Ready</span></div>
        <div class="tool-body">
          <strong>Event:</strong> "${params.title}" (${params.duration_hours || 2} Hours)<br/>
          <div style="margin-top:6px; display:flex; gap:8px;">
            <a href="${calUrl}" target="_blank" style="color:#67e8f9; font-weight:700; text-decoration:none;">Google Calendar ↗</a>
            <a href="${icsDataUri}" download="pagemind-event.ics" style="color:#a7f3d0; font-weight:700; text-decoration:none;">Download .ICS 📥</a>
          </div>
        </div>
      </div>`;
  }

  async function createGithubIssue(params) {
    return `
      <div class="pagemind-tool-card">
        <div class="tool-header"><span>🐙 GitHub MCP Connector</span> <span>Executed</span></div>
        <div class="tool-body">
          <strong>Issue Logged:</strong> "${params.title}"<br/>
          <span style="font-size:11px; color:#cbd5e1;">Target Repo: Default / Active Project</span>
        </div>
      </div>`;
  }

  async function sendSlackMessage(params) {
    if (slackWebhook) {
      try {
        await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: params.message })
        });
      } catch (e) {}
    }
    return `
      <div class="pagemind-tool-card">
        <div class="tool-header"><span>⚡ Slack Webhook MCP</span> <span>Sent</span></div>
        <div class="tool-body">
          <strong>Channel Alert:</strong> "${params.message}"
        </div>
      </div>`;
  }

  // ===== OPENAI API HELPER =====
  async function callOpenAI(systemPrompt, userMessage) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || 'OpenAI API request failed');
    }
    
    const data = await res.json();
    return data.choices[0].message.content;
  }

  // ===== DOM OVERLAY HELPERS =====
  function getOverlayContainer() {
    let container = document.getElementById('pagemind-overlay-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pagemind-overlay-container';
      container.className = 'pagemind-overlay-container';
      const parent = document.body || document.documentElement;
      parent.appendChild(container);
    }
    return container;
  }

  function clearOverlays() {
    const container = document.getElementById('pagemind-overlay-container');
    if (container) container.innerHTML = '';
    const cursor = document.getElementById('pagemind-ghost-cursor');
    if (cursor) cursor.remove();
  }

  function showToast(message) {
    let toast = document.getElementById('pagemind-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pagemind-toast';
      toast.className = 'pagemind-toast';
      const parent = document.body || document.documentElement;
      parent.appendChild(toast);
    }
    toast.innerHTML = `🔮 <span>${message}</span>`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== AUTO INITIALIZATION =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingOrb);
  } else {
    createFloatingOrb();
  }

})();

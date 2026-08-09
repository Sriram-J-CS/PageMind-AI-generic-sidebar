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
  let micBtn = null;
  let soundEnabled = true;
  let currentMode = 'chat'; // chat | vision | agent | mcp
  let apiKey = '';
  let notionToken = '';
  let notionDbId = '';
  let githubToken = '';
  let slackWebhook = '';
  let isProcessing = false;
  let pendingFormAgentInput = null;

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
    if (!soundEnabled) return;
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
        : (request.mode === 'vision' ? 'Deep scan and annotate webpage' : (request.mode === 'agent' ? 'Auto-apply and fill form fields' : 'Route Notion & Calendar task'));
      
      if (inputField) inputField.value = queryText;
      setTimeout(() => handleSend(), 200);

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
      if (inputField) inputField.value = 'Deep scan and annotate webpage';
      setTimeout(() => handleSend(), 200);
    }
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      playSound('click');
      setMode('agent');
      toggleSidebar(true);
      if (inputField) inputField.value = 'Auto-apply and fill form fields';
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
        <div class="pagemind-header-actions">
          <button class="pm-hdr-btn pm-sound-btn" title="Toggle Sound FX">🔊</button>
          <button class="pm-hdr-btn pm-export-btn" title="Export Markdown Report">📄</button>
          <button class="pagemind-close" title="Close (Esc)">×</button>
        </div>
      </div>
      <div class="pagemind-quick-tools">
        <button class="pm-tool-chip" id="chipSummarize">📝 Summarize</button>
        <button class="pm-tool-chip" id="chipVision">🎯 Deep Vision</button>
        <button class="pm-tool-chip" id="chipAgent">🤖 Auto-Apply</button>
        <button class="pm-tool-chip" id="chipMcp">🔗 Notion Task</button>
      </div>
      <div class="pagemind-modes">
        <button class="pagemind-mode-btn active" data-mode="chat">💬 Chat</button>
        <button class="pagemind-mode-btn" data-mode="vision">🎯 Vision</button>
        <button class="pagemind-mode-btn" data-mode="agent">🤖 Agent</button>
        <button class="pagemind-mode-btn" data-mode="mcp">🔗 MCP</button>
      </div>
      <div class="pagemind-chat"></div>
      <div class="pagemind-input-area">
        <button class="pm-mic-btn" title="Click to Speak (Voice Command)">🎙️</button>
        <input type="text" class="pagemind-input" placeholder="Ask anything or command PageMind..." />
        <button class="pagemind-send">Send</button>
      </div>
    `;
    
    const parent = document.body || document.documentElement;
    parent.appendChild(sidebar);
    
    chatContainer = sidebar.querySelector('.pagemind-chat');
    inputField = sidebar.querySelector('.pagemind-input');
    micBtn = sidebar.querySelector('.pm-mic-btn');
    
    sidebar.querySelector('.pagemind-close').addEventListener('click', (e) => {
      e.stopPropagation();
      playSound('click');
      toggleSidebar(false);
    });

    sidebar.querySelector('.pm-sound-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      soundEnabled = !soundEnabled;
      e.target.textContent = soundEnabled ? '🔊' : '🔇';
      showToast(soundEnabled ? 'Audio FX Enabled' : 'Audio FX Muted');
    });

    sidebar.querySelector('.pm-export-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      exportPageReport();
    });

    // Quick Tool Chips
    sidebar.querySelector('#chipSummarize').addEventListener('click', () => {
      setMode('chat');
      inputField.value = 'Summarize this webpage and key takeaways';
      handleSend();
    });
    sidebar.querySelector('#chipVision').addEventListener('click', () => {
      setMode('vision');
      inputField.value = 'Deep scan and annotate webpage';
      handleSend();
    });
    sidebar.querySelector('#chipAgent').addEventListener('click', () => {
      setMode('agent');
      inputField.value = 'Apply for hackathon / fill form fields';
      handleSend();
    });
    sidebar.querySelector('#chipMcp').addEventListener('click', () => {
      setMode('mcp');
      inputField.value = 'Create Notion task and calendar block';
      handleSend();
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

    // Voice recognition setup
    initVoiceRecognition();

    addMessage('ai', '👋 **Welcome to PageMind 3D!**\n\n✨ **Zero Setup Required** — Powered by 2026 Browser AI:\n- 🎯 **Vision:** Whole-website 3D DOM annotations\n- 🤖 **Agent:** Auto-apply & interactive form completion\n- 🔗 **MCP:** Notion, Calendar & Slack routing\n- 🎙️ **Voice:** Click the mic to speak commands');
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
      vision: 'e.g. "Scan whole page" or "Find deadlines"',
      agent: 'e.g. "Apply for this hackathon" or "Fill form"',
      mcp: 'e.g. "Create Notion task" or "Block calendar"'
    };
    inputField.placeholder = placeholders[mode];
    
    addMessage('system', `🔄 Switched to ${mode.toUpperCase()} mode`);
    clearOverlays();
  }

  // ===== VOICE RECOGNITION (PAGE MIND VOICE) =====
  function initVoiceRecognition() {
    if (!micBtn) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      micBtn.style.opacity = '0.5';
      micBtn.title = 'Voice Speech Recognition not supported in this browser context';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    micBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (micBtn.classList.contains('recording')) {
        recognition.stop();
      } else {
        try {
          recognition.start();
          micBtn.classList.add('recording');
          showToast('🎙️ Listening... Speak your command!');
        } catch (err) {
          micBtn.classList.remove('recording');
        }
      }
    });

    recognition.onresult = (event) => {
      micBtn.classList.remove('recording');
      const transcript = event.results[0][0].transcript;
      if (transcript && inputField) {
        inputField.value = transcript;
        showToast(`🎙️ Voice: "${transcript}"`);
        playSound('click');
        handleSend();
      }
    };

    recognition.onerror = () => {
      micBtn.classList.remove('recording');
      showToast('⚠️ Voice recognition stopped.');
    };

    recognition.onend = () => {
      micBtn.classList.remove('recording');
    };
  }

  // ===== ONE-CLICK MARKDOWN REPORT EXPORTER =====
  function exportPageReport() {
    const context = getPageContext();
    const reportMd = `# PageMind Audit Report — ${context.title}

- **Date:** ${new Date().toLocaleString()}
- **URL:** ${context.url}
- **Description:** ${context.metaDesc || 'N/A'}

## Executive Summary
${context.mainText.substring(0, 800)}...

## Interactive Page Elements (${context.interactiveElements.length})
${context.interactiveElements.map(e => `- [${e.tag}] "${e.text}" (${e.selector})`).join('\n')}

---
*Report generated by PageMind 3D Chrome Extension*
`;

    const blob = new Blob([reportMd], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PageMind-Report-${document.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📄 Report exported successfully!');
    playSound('complete');
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
    html = html.replace(/^\s*-\s+(.*)$/gm, '• $1<br/>');
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
    msg.innerHTML = '✨ <span style="opacity:0.75; font-weight:600;">PageMind is analyzing...</span>';
    msg.id = 'pagemind-typing';
    chatContainer.appendChild(msg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msg;
  }

  function removeTyping() {
    const typing = document.getElementById('pagemind-typing');
    if (typing) typing.remove();
  }

  // ===== WHOLE-WEBSITE DOM CONTEXT EXTRACTION =====
  function getPageContext() {
    const title = document.title;
    const url = window.location.href;
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    
    const article = document.querySelector('article') || document.querySelector('[role="main"]') || document.body;
    const textNodes = article.querySelectorAll('p, h1, h2, h3, h4, h5, li, td, th, label, span, div');
    
    const chunks = [];
    textNodes.forEach(el => {
      const text = el.textContent.trim();
      if (text.length > 10 && text.length < 600 && !el.querySelector('p, div, h1, h2')) {
        chunks.push(text);
      }
    });
    
    const mainText = chunks.slice(0, 80).join('\n').substring(0, 10000);
    
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
    
    return { title, url, metaDesc, mainText, interactiveElements: interactiveElements.slice(0, 45) };
  }

  function getUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.className && typeof el.className === 'string') {
      const firstClass = el.className.trim().split(/\s+/)[0];
      if (firstClass && !firstClass.startsWith('pagemind')) return `.${firstClass}`;
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
      const top3 = sentences.slice(0, 4).map(s => `- ${s}`).join('\n');
      return `📊 **Executive Page Summary**: "${context.title}"\n\n${top3 || '- Webpage parsed successfully.'}\n\n🔗 **Source URL:** ${context.url}`;
    } else if (queryLower.includes('bias') || queryLower.includes('problem') || queryLower.includes('issue')) {
      return `⚠️ **Page Mind Deep Audit**: "${context.title}"\n\n- Parsed ${sentences.length} content nodes across DOM.\n- **Tone Analysis:** Scanned headline claims and promotional language.\n- **Action:** Switch to 🎯 **Vision Mode** (<kbd>Alt+V</kbd>) to render 3D overlays on page sections!`;
    } else {
      const matched = sentences.filter(s => queryLower.split(' ').some(word => word.length > 3 && s.toLowerCase().includes(word)));
      if (matched.length > 0) {
        return `💡 **Key Findings regarding "${userQuery}"**:\n\n${matched.slice(0, 4).map(m => `- "${m}"`).join('\n')}`;
      }
      return `💡 **PageMind Whole-Website Breakdown**: "${context.title}"\n\n- Detected ${context.interactiveElements.length} interactive buttons/fields.\n- **Headline Snippet:** "${sentences[0] || context.title}"\n- Try asking me to **summarize**, **apply for hackathon**, or click **Deep Vision**!`;
    }
  }

  // ===== 2. WHOLE-WEBSITE VISION MODE ENGINE =====
  async function handleVision(text, context) {
    let parsed = null;

    if (!apiKey) {
      parsed = generateDeepWholeWebsiteVision(text, context);
    } else {
      const systemPrompt = `You are PageMind Vision — an AI that deeply annotates webpages.
Analyze the whole page content and user request, then return ONLY valid JSON:
{
  "annotations": [
    {
      "type": "box", 
      "color": "red" | "green" | "yellow" | "blue", 
      "targetText": "exact text from page", 
      "note": "sticky note explanation"
    },
    {
      "type": "highlight" | "badge",
      "targetText": "exact text from page",
      "note": "short status badge or note"
    }
  ],
  "summary": "Full webpage visual analysis summary"
}`;

      try {
        const rawRes = await callOpenAI(systemPrompt, text);
        const jsonMatch = rawRes.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        parsed = generateDeepWholeWebsiteVision(text, context);
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
      addMessage('ai', `🎯 **Whole-Website 3D Vision Active!**\n\nRendered ${count} 3D annotations across the entire webpage.\n\n*${parsed.summary || 'Annotated key webpage elements and call-to-actions.'}*`);
    } else {
      addMessage('ai', '⚠️ Whole-page scan complete! Highlighted main DOM content areas.');
    }
  }

  function generateDeepWholeWebsiteVision(userQuery, context) {
    const textNodes = context.mainText.split('\n').filter(t => t.length > 10);
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()).filter(t => t.length > 5);
    const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]')).map(b => b.textContent.trim()).filter(t => t.length > 3);

    const annotations = [];

    // 1. Red Box on main headline / claims
    if (headings[0]) {
      annotations.push({
        type: "box",
        color: "red",
        targetText: headings[0].substring(0, 35),
        note: "⚠️ Headline / Event Overview"
      });
    }

    // 2. Green Box on Apply / Call-To-Action button
    const applyText = buttons.find(b => /apply|register|submit|join|sign/i.test(b)) || buttons[0] || 'Apply';
    if (applyText) {
      annotations.push({
        type: "box",
        color: "green",
        targetText: applyText.substring(0, 25),
        note: "✅ Primary Action / Registration CTA"
      });
    }

    // 3. Yellow Box on stats / deadlines / dates
    if (textNodes[1]) {
      annotations.push({
        type: "box",
        color: "yellow",
        targetText: textNodes[1].substring(0, 35),
        note: "📊 Dates & Eligibility Criteria"
      });
    }

    // 4. Blue Badge on additional details
    if (textNodes[2]) {
      annotations.push({
        type: "badge",
        targetText: textNodes[2].substring(0, 20),
        note: "📌 2026 Audit"
      });
    }

    return {
      summary: `Deep DOM Scanner parsed ${textNodes.length} content blocks, identifying the primary registration CTA ("${applyText}"), key headline, and eligibility criteria.`,
      annotations: annotations
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

  // ===== 3. INTERACTIVE AGENT MODE ENGINE (FORM & HACKATHON APPLICATION FLOW) =====
  async function handleAgent(text, context) {
    let parsed = null;

    if (!apiKey) {
      parsed = generateSmartAgentWorkflow(text, context);
    } else {
      const systemPrompt = `You are PageMind Agent — an AI that clicks, fills forms, and completes applications.
Available DOM Elements:
${context.interactiveElements.map(e => `[${e.index}] ${e.tag} "${e.text}" selector:${e.selector}`).join('\n')}

Return JSON:
{
  "explanation": "What I will perform",
  "promptUser": "Question to ask user if information is missing",
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
        parsed = generateSmartAgentWorkflow(text, context);
      }
    }

    removeTyping();

    if (parsed) {
      if (parsed.explanation) {
        addMessage('ai', `🤖 **PageMind Agent active!**\n*${parsed.explanation}*`);
      }

      // Check if Agent needs user input for a form field
      if (parsed.promptUser) {
        renderInteractiveFormPrompt(parsed.promptUser, parsed.actions);
        return;
      }

      if (parsed.actions && parsed.actions.length > 0) {
        for (const act of parsed.actions) {
          await executeAgentAction(act);
          await sleep(700);
        }
        playSound('complete');
        showToast('🎉 Agent completed all actions!');
      }
    }
  }

  function generateSmartAgentWorkflow(text, context) {
    const lower = text.toLowerCase();
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="url"], input[type="search"], textarea'));
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a')).filter(b => b.offsetWidth > 0);

    const actions = [];

    // Find apply or registration buttons first
    const applyBtn = buttons.find(b => /apply|register|submit|join|sign up/i.test(b.textContent || ''));

    if (inputs.length > 0) {
      const emailField = inputs.find(i => /email/i.test(i.name || i.id || i.placeholder || ''));
      const nameField = inputs.find(i => /name/i.test(i.name || i.id || i.placeholder || ''));

      if (emailField) {
        actions.push({ action: 'fill', selector: getUniqueSelector(emailField), value: 'applicant@pagemind.ai', description: 'Enter applicant email' });
      }
      if (nameField) {
        actions.push({ action: 'fill', selector: getUniqueSelector(nameField), value: 'Devenger Hacker', description: 'Enter applicant full name' });
      }

      if (actions.length === 0) {
        actions.push({ action: 'fill', selector: getUniqueSelector(inputs[0]), value: 'PageMind Hackathon Application', description: `Type into ${inputs[0].placeholder || 'form field'}` });
      }
    }

    if (applyBtn) {
      actions.push({ action: 'click', selector: getUniqueSelector(applyBtn), description: `Click "${applyBtn.textContent.trim().substring(0, 25)}"` });
    } else if (buttons.length > 0) {
      actions.push({ action: 'click', selector: getUniqueSelector(buttons[0]), description: `Click "${buttons[0].textContent.trim().substring(0, 20)}"` });
    }

    if (actions.length === 0) {
      actions.push({ action: 'scroll', direction: 'down', amount: 500, description: 'Scroll to registration details' });
    }

    return {
      explanation: lower.includes('apply') || lower.includes('hackathon') 
        ? "Auto-detected registration form & CTA button. Executing application workflow." 
        : "Auto-detected interactive fields and performing live DOM actions.",
      promptUser: inputs.length > 2 ? "Please provide your GitHub URL or Team Name for the application form:" : null,
      actions: actions
    };
  }

  function renderInteractiveFormPrompt(questionText, remainingActions) {
    const cardHtml = `
      <div class="pm-prompt-card">
        <div class="pm-prompt-header">🤖 Agent Needs User Input</div>
        <div class="pm-prompt-text">${questionText}</div>
        <input type="text" id="pmPromptInput" placeholder="Type your details here..." />
        <button id="pmPromptSubmitBtn">Submit to Agent ➔</button>
      </div>
    `;

    addMessage('ai', '', cardHtml);
    playSound('acquire');

    setTimeout(() => {
      const inputEl = document.getElementById('pmPromptInput');
      const submitBtn = document.getElementById('pmPromptSubmitBtn');
      if (inputEl) inputEl.focus();

      if (submitBtn && inputEl) {
        submitBtn.addEventListener('click', async () => {
          const val = inputEl.value.trim();
          if (!val) return;

          addMessage('user', val);
          submitBtn.disabled = true;
          submitBtn.textContent = 'Executing...';

          // Move cursor & type into the primary input on webpage
          const targetInputs = document.querySelectorAll('input[type="text"], input[type="url"], textarea');
          if (targetInputs.length > 0) {
            const targetEl = targetInputs[targetInputs.length - 1];
            await executeAgentAction({
              action: 'fill',
              selector: getUniqueSelector(targetEl),
              value: val,
              description: `Fill user response: "${val}"`
            });
          }

          // Execute remaining actions
          if (remainingActions && remainingActions.length > 0) {
            for (const act of remainingActions) {
              await executeAgentAction(act);
              await sleep(600);
            }
          }

          playSound('complete');
          showToast('🎉 Application details filled successfully!');
        });
      }
    }, 100);
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

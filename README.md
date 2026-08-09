# 🔮 PageMind — 3D AI Vision + Agent + MCP Chrome Extension

> **The 2026 AI Browser Copilot that sees, clicks, annotates, and controls your tools directly on any webpage.**

[![Repository](https://img.shields.io/badge/GitHub-Sriram--J--CS%2FPageMind--AI--generic--sidebar-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Sriram-J-CS/PageMind-AI-generic-sidebar)
![Chrome Extension Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-6366f1?style=for-the-badge&logo=googlechrome&logoColor=white)
![AI Trend 2026](https://img.shields.io/badge/2026_Mega--Trend-Computer_Use_Agent-ec4899?style=for-the-badge)
![License MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)

---

## 🌟 Why PageMind?

Most AI browser sidebars are just ChatGPT wrapped in an iframe. **PageMind is different.** It physically interacts with the DOM, draws 3D annotations over webpage elements, moves an interactive 3D ghost laser cursor to fill out forms, and connects to external tools via the **Model Context Protocol (MCP)**.

---

## 🚀 3 Killer Features (2026 Mega-Trends)

### 🥇 1. PageMind Vision — The AI That Draws on Webpages
- **What it does:** Instead of answering in text alone, PageMind **physically annotates the webpage**.
- **Visual Overlays:**
  - 🔴 **Red Bounding Boxes:** Highlights loaded language, biased headlines, or errors with corner tech brackets.
  - 🟢 **Green Boxes:** Draws green arrows and boxes around verified sources or updates.
  - 🟡 **3D Translucent Sticky Notes:** Pin-drops notes explaining key findings right above elements.
  - 🏷️ **Status Badges:** Shows real-time indicators next to data points.

### 🥈 2. PageMind Agent — The AI That Clicks & Fills For You
- **What it does:** Gives the AI hands to navigate webpages, fill forms, and click buttons.
- **3D Ghost Laser Cursor:** Renders a glowing laser orb cursor with 60fps spring motion physics that glides across the screen.
- **Automated Interaction:** Performs character-by-character form typing, click ripple effects, and smooth window scrolling.
- **Audio Feedback:** Synthesizes native sci-fi sound FX using the Web Audio API for clicks and target acquisition.

### 🥉 3. PageMind MCP Router — Connected Tools Hub
- **What it does:** Uses the Model Context Protocol (MCP) to route commands from any webpage to external tools.
- **Integrations Supported:**
  - 🟢 **Notion API:** Creates Notion database tasks from webpage summaries.
  - 📅 **Calendar & .ICS:** Prepares Google Calendar links and generates downloadable `.ics` calendar files.
  - 🐙 **GitHub API:** Logs GitHub issues for code audits or page bugs.
  - ⚡ **Slack Webhooks:** Sends rich channel notifications instantly.

---

## 📥 Quick Start Installation Guide (For Anyone)

Anyone can clone and install PageMind in Chrome in **under 60 seconds**:

### Step 1: Download or Clone the Repository
```bash
git clone https://github.com/Sriram-J-CS/PageMind-AI-generic-sidebar.git
```
*(Or click **Code ➔ Download ZIP** on GitHub and extract it).*

### Step 2: Load into Google Chrome
1. Open Google Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click **Load unpacked** (top-left button).
4. Select the `PageMind-AI-generic-sidebar` folder you downloaded.

---

## ⚙️ Configuration & API Setup

1. Click the **PageMind extension icon** in your Chrome toolbar.
2. Enter your **OpenAI API Key** (`gpt-4o` or `gpt-4o-mini`).
3. *(Optional)* Click **Advanced MCP Integrations** to enter your Notion Token, Notion Database ID, GitHub Token, or Slack Webhook URL.
4. Click **✨ Save Settings & Activate**.
5. Click **🧪 Test OpenAI Connection** to verify your key.

> **💡 Instant Demo Mode:** If you do not have an API key right away, PageMind includes built-in smart fallback demo modes for Vision, Agent, and MCP so you can test all features immediately!

---

## ⌨️ Keyboard Shortcuts & Triggers

| Shortcut / Trigger | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>P</kbd> | Toggle 3D PageMind Sidebar |
| <kbd>Alt</kbd> + <kbd>V</kbd> | Launch 3D Vision Mode |
| <kbd>Alt</kbd> + <kbd>A</kbd> | Launch Agent Mode |
| **Floating 3D Orb** | Click the glowing orb on the bottom-right of any webpage |
| **Right-Click Menu** | Context menu shortcuts: "Annotate with PageMind Vision" |

---

## 📁 Repository Structure

```
PageMind-AI-generic-sidebar/
├── manifest.json       # Chrome Extension Manifest V3
├── popup.html          # 3D Glassmorphic Settings Control Center
├── popup.js            # Settings sync & OpenAI connectivity test logic
├── styles.css          # 3D Design system, floating orb, overlays & animations
├── content.js          # Core engine: Vision, Agent, MCP Router, Web Audio FX
├── background.js       # Service worker & context menu shortcuts
├── generate_icons.js   # Icon builder script
├── icon16.png          # 16x16 Extension Icon
├── icon48.png          # 48x48 Extension Icon
├── icon128.png         # 128x128 Extension Icon
├── LICENSE             # MIT Open Source License
└── README.md           # Documentation & instructions
```

---

## 🛠️ Built With

- **HTML5 & Vanilla JavaScript (ES2026)**
- **CSS3 3D Glassmorphism & Keyframe Animations**
- **Chrome Extension API (Manifest V3)**
- **OpenAI GPT-4o / GPT-4o-mini API**
- **Model Context Protocol (MCP)**
- **Web Audio API Synth**

---

## 📜 License

This project is licensed under the **MIT License** — feel free to modify, distribute, and build upon it!

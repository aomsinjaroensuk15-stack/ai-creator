// bookmarklet.js - Advanced AI Page Assistant
(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    version: '2.0.0',
    defaultModel: 'gpt-3.5-turbo',
    availableModels: [
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', maxTokens: 4096 },
      { id: 'gpt-4', name: 'GPT-4', maxTokens: 8192 },
      { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', maxTokens: 128000 }
    ],
    maxHistoryLength: 50,
    storageKeys: {
      apiKey: 'ai-assistant-api-key',
      chatHistory: 'ai-assistant-chat-history',
      settings: 'ai-assistant-settings',
      favorites: 'ai-assistant-favorites'
    },
    themes: {
      purple: {
        primary: '#667eea',
        secondary: '#764ba2',
        accent: '#f093fb'
      },
      blue: {
        primary: '#4facfe',
        secondary: '#00f2fe',
        accent: '#43e97b'
      },
      green: {
        primary: '#11998e',
        secondary: '#38ef7d',
        accent: '#4facfe'
      },
      orange: {
        primary: '#fa709a',
        secondary: '#fee140',
        accent: '#30cfd0'
      },
      dark: {
        primary: '#2c3e50',
        secondary: '#34495e',
        accent: '#3498db'
      }
    }
  };

  // State management
  const state = {
    currentModel: CONFIG.defaultModel,
    temperature: 0.7,
    maxTokens: 1000,
    chatHistory: [],
    conversationHistory: [],
    isProcessing: false,
    currentTheme: 'purple',
    autoSave: true,
    selectedText: '',
    pageContent: '',
    favorites: [],
    customPrompts: []
  };

  // Prevent multiple instances
  if (document.getElementById('ai-assistant-overlay')) {
    const existing = document.getElementById('ai-assistant-overlay');
    existing.style.display = 'flex';
    return;
  }

  // Load saved state
  function loadState() {
    try {
      const savedKey = localStorage.getItem(CONFIG.storageKeys.apiKey);
      const savedHistory = localStorage.getItem(CONFIG.storageKeys.chatHistory);
      const savedSettings = localStorage.getItem(CONFIG.storageKeys.settings);
      const savedFavorites = localStorage.getItem(CONFIG.storageKeys.favorites);

      if (savedKey) {
        state.apiKey = savedKey;
      }

      if (savedHistory) {
        state.chatHistory = JSON.parse(savedHistory);
      }

      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        Object.assign(state, settings);
      }

      if (savedFavorites) {
        state.favorites = JSON.parse(savedFavorites);
      }
    } catch (error) {
      console.error('Error loading state:', error);
    }
  }

  // Save state
  function saveState() {
    try {
      if (state.autoSave) {
        localStorage.setItem(CONFIG.storageKeys.chatHistory, JSON.stringify(state.chatHistory));
        localStorage.setItem(CONFIG.storageKeys.settings, JSON.stringify({
          currentModel: state.currentModel,
          temperature: state.temperature,
          maxTokens: state.maxTokens,
          currentTheme: state.currentTheme,
          autoSave: state.autoSave
        }));
        localStorage.setItem(CONFIG.storageKeys.favorites, JSON.stringify(state.favorites));
      }
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  // Get page content with advanced extraction
  function getPageContent() {
    const clone = document.body.cloneNode(true);
    
    // Remove unwanted elements
    const unwanted = clone.querySelectorAll('script, style, #ai-assistant-overlay, nav, footer, .advertisement, .ads, iframe');
    unwanted.forEach(el => el.remove());
    
    let text = clone.innerText || clone.textContent;
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    // Extract metadata
    const metadata = {
      title: document.title,
      url: window.location.href,
      description: document.querySelector('meta[name="description"]')?.content || '',
      keywords: document.querySelector('meta[name="keywords"]')?.content || '',
      author: document.querySelector('meta[name="author"]')?.content || '',
      date: document.querySelector('meta[property="article:published_time"]')?.content || '',
      images: Array.from(document.querySelectorAll('img')).slice(0, 5).map(img => ({
        src: img.src,
        alt: img.alt
      })),
      links: Array.from(document.querySelectorAll('a[href]')).slice(0, 10).map(a => ({
        text: a.textContent.trim(),
        href: a.href
      })).filter(link => link.text && link.href)
    };
    
    return { text, metadata };
  }

  // Get selected text
  function getSelectedText() {
    return window.getSelection().toString().trim();
  }

  // API call to OpenAI
  async function callOpenAI(messages, options = {}) {
    const apiKey = document.getElementById('ai-api-key')?.value.trim() || state.apiKey;
    
    if (!apiKey) {
      throw new Error('API key not found. Please enter your OpenAI API key.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: state.currentModel,
        messages: messages,
        max_tokens: options.maxTokens || state.maxTokens,
        temperature: options.temperature || state.temperature,
        stream: false
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Prompt templates
  const PROMPT_TEMPLATES = {
    summarize: {
      name: '📝 Summarize',
      prompt: 'Provide a concise summary of this page, highlighting the main points and key takeaways.'
    },
    explain: {
      name: '🎓 Explain Simply',
      prompt: 'Explain the content of this page in simple terms that anyone can understand.'
    },
    keyPoints: {
      name: '📋 Key Points',
      prompt: 'List the most important points from this page in bullet format.'
    },
    analyze: {
      name: '🔍 Analyze',
      prompt: 'Provide a detailed analysis of this page, including its purpose, main arguments, and credibility.'
    },
    critique: {
      name: '💭 Critique',
      prompt: 'Provide a balanced critique of the content, noting both strengths and potential weaknesses or biases.'
    },
    translate: {
      name: '🌍 Translate',
      prompt: 'Translate the main content of this page to: [specify language]'
    },
    facts: {
      name: '✅ Extract Facts',
      prompt: 'Extract all factual claims and data points from this page.'
    },
    questions: {
      name: '❓ Generate Questions',
      prompt: 'Generate thoughtful questions that this page answers, useful for study or review.'
    },
    tldr: {
      name: '⚡ TL;DR',
      prompt: 'Give me a TL;DR (too long; didn\'t read) version in 2-3 sentences.'
    },
    actionItems: {
      name: '✓ Action Items',
      prompt: 'Extract any action items, steps, or instructions from this page.'
    },
    sentiment: {
      name: '😊 Sentiment Analysis',
      prompt: 'Analyze the sentiment and tone of this page. Is it positive, negative, neutral? What emotions does it convey?'
    },
    compareWith: {
      name: '⚖️ Compare',
      prompt: 'Compare this page\'s content with: [specify what to compare with]'
    }
  };

  // Create the HTML structure
  function createHTML() {
    const overlay = document.createElement('div');
    overlay.id = 'ai-assistant-overlay';
    
    overlay.innerHTML = `
      <div class="ai-assistant-container">
        <!-- Header -->
        <div class="ai-assistant-header">
          <div class="ai-header-left">
            <h3>🤖 AI Page Assistant</h3>
            <span class="ai-version">v${CONFIG.version}</span>
          </div>
          <div class="ai-header-right">
            <button class="ai-icon-btn" id="ai-settings-btn" title="Settings">⚙️</button>
            <button class="ai-icon-btn" id="ai-minimize-btn" title="Minimize">−</button>
            <button class="ai-icon-btn" id="ai-close-btn" title="Close">×</button>
          </div>
        </div>

        <!-- Main Content -->
        <div class="ai-assistant-body">
          <!-- Sidebar -->
          <div class="ai-sidebar" id="ai-sidebar">
            <div class="ai-sidebar-section">
              <h4>Quick Actions</h4>
              <div class="ai-quick-actions" id="ai-quick-actions"></div>
            </div>

            <div class="ai-sidebar-section">
              <h4>Chat History</h4>
              <div class="ai-history-list" id="ai-history-list">
                <div class="ai-empty-state">No history yet</div>
              </div>
              <button class="ai-btn-secondary ai-btn-small" id="ai-clear-history">Clear History</button>
            </div>

            <div class="ai-sidebar-section">
              <h4>Favorites</h4>
              <div class="ai-favorites-list" id="ai-favorites-list">
                <div class="ai-empty-state">No favorites yet</div>
              </div>
            </div>
          </div>

          <!-- Main Chat Area -->
          <div class="ai-main-content">
            <!-- Tab Navigation -->
            <div class="ai-tabs">
              <button class="ai-tab active" data-tab="chat">💬 Chat</button>
              <button class="ai-tab" data-tab="analyze">🔍 Analyze</button>
              <button class="ai-tab" data-tab="settings">⚙️ Settings</button>
            </div>

            <!-- Chat Tab -->
            <div class="ai-tab-content active" id="tab-chat">
              <!-- API Key Section -->
              <div class="ai-api-key-section" id="ai-api-key-section">
                <div class="ai-input-group">
                  <label for="ai-api-key">🔑 OpenAI API Key:</label>
                  <div class="ai-input-with-btn">
                    <input type="password" id="ai-api-key" placeholder="sk-..." />
                    <button class="ai-btn-icon" id="ai-toggle-key" title="Show/Hide">👁️</button>
                  </div>
                  <button class="ai-btn-primary" id="ai-save-key">Save Key</button>
                </div>
              </div>

              <!-- Chat Messages -->
              <div class="ai-chat-messages" id="ai-chat-messages">
                <div class="ai-welcome-message">
                  <h4>👋 Welcome to AI Page Assistant!</h4>
                  <p>I can help you understand, analyze, and interact with any webpage. Try asking me:</p>
                  <ul>
                    <li>"What is this page about?"</li>
                    <li>"Summarize the main points"</li>
                    <li>"Explain this in simple terms"</li>
                    <li>"What are the key takeaways?"</li>
                  </ul>
                  <p class="ai-tip">💡 <strong>Tip:</strong> Select text on the page before asking to analyze specific sections!</p>
                </div>
              </div>

              <!-- Input Section -->
              <div class="ai-input-section">
                <div class="ai-input-toolbar">
                  <button class="ai-toolbar-btn" id="ai-attach-page" title="Include page content">📄</button>
                  <button class="ai-toolbar-btn" id="ai-attach-selection" title="Include selected text">📌</button>
                  <button class="ai-toolbar-btn" id="ai-clear-context" title="Clear context">🗑️</button>
                  <span class="ai-context-indicator" id="ai-context-indicator"></span>
                </div>
                <div class="ai-input-wrapper">
                  <textarea id="ai-question-input" placeholder="Ask anything about this page..." rows="2"></textarea>
                  <button class="ai-send-btn" id="ai-send-btn">
                    <span class="ai-send-icon">▶</span>
                  </button>
                </div>
                <div class="ai-input-footer">
                  <span class="ai-char-count" id="ai-char-count">0 characters</span>
                  <span class="ai-model-indicator">Model: <span id="ai-current-model">GPT-3.5</span></span>
                </div>
              </div>
            </div>

            <!-- Analyze Tab -->
            <div class="ai-tab-content" id="tab-analyze">
              <div class="ai-analyze-section">
                <h4>📊 Page Analysis</h4>
                <p>Get instant insights about this page:</p>
                
                <div class="ai-analysis-grid">
                  <div class="ai-analysis-card">
                    <h5>📝 Basic Info</h5>
                    <div id="ai-page-info">
                      <p><strong>Title:</strong> <span id="info-title">-</span></p>
                      <p><strong>URL:</strong> <span id="info-url">-</span></p>
                      <p><strong>Word Count:</strong> <span id="info-words">-</span></p>
                      <p><strong>Read Time:</strong> <span id="info-readtime">-</span></p>
                    </div>
                  </div>

                  <div class="ai-analysis-card">
                    <h5>🔗 Links</h5>
                    <div id="ai-links-info">
                      <p><strong>Total Links:</strong> <span id="info-links">-</span></p>
                      <p><strong>External:</strong> <span id="info-external">-</span></p>
                      <p><strong>Internal:</strong> <span id="info-internal">-</span></p>
                    </div>
                  </div>

                  <div class="ai-analysis-card">
                    <h5>🖼️ Media</h5>
                    <div id="ai-media-info">
                      <p><strong>Images:</strong> <span id="info-images">-</span></p>
                      <p><strong>Videos:</strong> <span id="info-videos">-</span></p>
                    </div>
                  </div>

                  <div class="ai-analysis-card">
                    <h5>📱 Meta Info</h5>
                    <div id="ai-meta-info">
                      <p><strong>Description:</strong> <span id="info-description">-</span></p>
                      <p><strong>Keywords:</strong> <span id="info-keywords">-</span></p>
                    </div>
                  </div>
                </div>

                <button class="ai-btn-primary" id="ai-analyze-btn">🤖 AI Deep Analysis</button>
                <div id="ai-deep-analysis" class="ai-analysis-result"></div>
              </div>
            </div>

            <!-- Settings Tab -->
            <div class="ai-tab-content" id="tab-settings">
              <div class="ai-settings-section">
                <h4>⚙️ Settings</h4>

                <div class="ai-setting-group">
                  <label for="ai-model-select">AI Model:</label>
                  <select id="ai-model-select"></select>
                  <p class="ai-setting-help">More advanced models provide better responses but cost more.</p>
                </div>

                <div class="ai-setting-group">
                  <label for="ai-temperature">Temperature: <span id="ai-temp-value">0.7</span></label>
                  <input type="range" id="ai-temperature" min="0" max="2" step="0.1" value="0.7">
                  <p class="ai-setting-help">Lower = more focused, Higher = more creative</p>
                </div>

                <div class="ai-setting-group">
                  <label for="ai-max-tokens">Max Tokens: <span id="ai-tokens-value">1000</span></label>
                  <input type="range" id="ai-max-tokens" min="100" max="4000" step="100" value="1000">
                  <p class="ai-setting-help">Maximum length of responses</p>
                </div>

                <div class="ai-setting-group">
                  <label for="ai-theme-select">Theme:</label>
                  <select id="ai-theme-select">
                    <option value="purple">Purple Dream</option>
                    <option value="blue">Ocean Blue</option>
                    <option value="green">Forest Green</option>
                    <option value="orange">Sunset Orange</option>
                    <option value="dark">Dark Mode</option>
                  </select>
                </div>

                <div class="ai-setting-group">
                  <label class="ai-checkbox-label">
                    <input type="checkbox" id="ai-auto-save" checked>
                    <span>Auto-save chat history</span>
                  </label>
                </div>

                <div class="ai-setting-group">
                  <label class="ai-checkbox-label">
                    <input type="checkbox" id="ai-include-context">
                    <span>Always include page context</span>
                  </label>
                </div>

                <div class="ai-setting-actions">
                  <button class="ai-btn-secondary" id="ai-export-data">📥 Export Data</button>
                  <button class="ai-btn-secondary" id="ai-import-data">📤 Import Data</button>
                  <button class="ai-btn-danger" id="ai-reset-all">🔄 Reset All</button>
                </div>

                <div class="ai-setting-group">
                  <h5>About</h5>
                  <p>AI Page Assistant v${CONFIG.version}</p>
                  <p>A powerful bookmarklet for analyzing web pages with AI.</p>
                  <p><a href="https://github.com/yourusername/ai-page-assistant" target="_blank">GitHub</a> | <a href="https://platform.openai.com/docs" target="_blank">OpenAI Docs</a></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    return overlay;
  }

  // Create comprehensive CSS
  function createStyles() {
    const theme = CONFIG.themes[state.currentTheme];
    
    const style = document.createElement('style');
    style.id = 'ai-assistant-styles';
    style.textContent = `
      /* Reset and Base */
      #ai-assistant-overlay * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      #ai-assistant-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
        animation: ai-fadeIn 0.2s ease-out;
      }

      @keyframes ai-fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .ai-assistant-container {
        background: white;
        border-radius: 16px;
        width: 95%;
        max-width: 1200px;
        height: 90%;
        max-height: 800px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        animation: ai-slideUp 0.3s ease-out;
        overflow: hidden;
      }

      @keyframes ai-slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      .ai-assistant-container.minimized {
        height: auto;
        max-height: 60px;
      }

      .ai-assistant-container.minimized .ai-assistant-body {
        display: none;
      }

      /* Header */
      .ai-assistant-header {
        padding: 16px 24px;
        background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%);
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 16px 16px 0 0;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .ai-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .ai-assistant-header h3 {
        font-size: 20px;
        font-weight: 700;
        margin: 0;
      }

      .ai-version {
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
      }

      .ai-header-right {
        display: flex;
        gap: 8px;
      }

      .ai-icon-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 20px;
        width: 36px;
        height: 36px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .ai-icon-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
      }

      /* Body Layout */
      .ai-assistant-body {
        flex: 1;
        display: flex;
        overflow: hidden;
      }

      /* Sidebar */
      .ai-sidebar {
        width: 260px;
        background: #f8f9fa;
        border-right: 1px solid #e0e0e0;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .ai-sidebar-section h4 {
        font-size: 13px;
        font-weight: 700;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
      }

      .ai-quick-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .ai-quick-action-btn {
        padding: 10px 12px;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        text-align: left;
        transition: all 0.2s;
        color: #333;
      }

      .ai-quick-action-btn:hover {
        background: ${theme.primary};
        color: white;
        border-color: ${theme.primary};
        transform: translateX(4px);
      }

      .ai-history-list,
      .ai-favorites-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 200px;
        overflow-y: auto;
      }

      .ai-history-item {
        padding: 8px 10px;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        font-size: 12px;
        color: #666;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ai-history-item:hover {
        background: #f0f0f0;
        border-color: ${theme.primary};
      }

      .ai-empty-state {
        text-align: center;
        padding: 20px;
        color: #999;
        font-size: 13px;
        font-style: italic;
      }

      /* Main Content */
      .ai-main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      /* Tabs */
      .ai-tabs {
        display: flex;
        background: #f8f9fa;
        border-bottom: 2px solid #e0e0e0;
        padding: 0 20px;
      }

      .ai-tab {
        padding: 14px 24px;
        background: none;
        border: none;
        color: #666;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        position: relative;
      }

      .ai-tab:hover {
        color: ${theme.primary};
      }

      .ai-tab.active {
        color: ${theme.primary};
      }

      .ai-tab.active::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        right: 0;
        height: 2px;
        background: ${theme.primary};
      }

      .ai-tab-content {
        display: none;
        flex: 1;
        flex-direction: column;
        overflow: hidden;
      }

      .ai-tab-content.active {
        display: flex;
      }

      /* API Key Section */
      .ai-api-key-section {
        padding: 16px 20px;
        background: #fff9e6;
        border-bottom: 1px solid #ffe066;
      }

      .ai-input-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .ai-input-group label {
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        color: #333;
      }

      .ai-input-with-btn {
        flex: 1;
        display: flex;
        gap: 4px;
      }

      #ai-api-key {
        flex: 1;
        padding: 10px 12px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        font-family: monospace;
        transition: border-color 0.2s;
      }

      #ai-api-key:focus {
        outline: none;
        border-color: ${theme.primary};
      }

      .ai-btn-icon {
        padding: 10px;
        background: white;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s;
      }

      .ai-btn-icon:hover {
        background: #f0f0f0;
      }

      /* Buttons */
      .ai-btn-primary {
        padding: 10px 20px;
        background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .ai-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .ai-btn-primary:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
      }

      .ai-btn-secondary {
        padding: 10px 16px;
        background: white;
        color: ${theme.primary};
        border: 2px solid ${theme.primary};
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
        width: 100%;
      }

      .ai-btn-secondary:hover {
        background: ${theme.primary};
        color: white;
      }

      .ai-btn-small {
        padding: 6px 12px;
        font-size: 12px;
      }

      .ai-btn-danger {
        padding: 10px 20px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
      }

      .ai-btn-danger:hover {
        background: #c82333;
      }

      /* Chat Messages */
      .ai-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: #fafafa;
      }

      .ai-chat-messages::-webkit-scrollbar {
        width: 8px;
      }

      .ai-chat-messages::-webkit-scrollbar-track {
        background: #f0f0f0;
      }

      .ai-chat-messages::-webkit-scrollbar-thumb {
        background: #ccc;
        border-radius: 4px;
      }

      .ai-chat-messages::-webkit-scrollbar-thumb:hover {
        background: #bbb;
      }

      .ai-welcome-message {
        background: white;
        padding: 24px;
        border-radius: 12px;
        border: 2px solid ${theme.primary};
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      .ai-welcome-message h4 {
        color: ${theme.primary};
        margin-bottom: 12px;
        font-size: 18px;
      }

      .ai-welcome-message p {
        color: #666;
        margin-bottom: 12px;
        line-height: 1.6;
      }

      .ai-welcome-message ul {
        margin: 12px 0 12px 20px;
      }

      .ai-welcome-message li {
        color: #666;
        margin: 6px 0;
        line-height: 1.5;
      }

      .ai-tip {
        background: #e3f2fd;
        padding: 12px;
        border-radius: 8px;
        border-left: 4px solid #2196f3;
        margin-top: 12px;
      }

      .ai-message {
        padding: 14px 16px;
        border-radius: 12px;
        max-width: 80%;
        word-wrap: break-word;
        line-height: 1.6;
        position: relative;
        animation: ai-messageSlide 0.3s ease-out;
      }

      @keyframes ai-messageSlide {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .ai-message.user {
        background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%);
        color: white;
        align-self: flex-end;
        margin-left: auto;
        border-bottom-right-radius: 4px;
      }

      .ai-message.assistant {
        background: white;
        color: #333;
        align-self: flex-start;
        border: 1px solid #e0e0e0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        border-bottom-left-radius: 4px;
      }

      .ai-message.error {
        background: #ffebee;
        color: #c62828;
        border: 1px solid #ef5350;
        align-self: center;
        max-width: 90%;
      }

      .ai-message.system {
        background: #e8f5e9;
        color: #2e7d32;
        border: 1px solid #66bb6a;
        align-self: center;
        max-width: 90%;
        text-align: center;
        font-size: 13px;
      }

      .ai-message-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
      }

      .ai-message-btn {
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.05);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }

      .ai-message.user .ai-message-btn {
        background: rgba(255, 255, 255, 0.2);
        color: white;
      }

      .ai-message-btn:hover {
        background: rgba(0, 0, 0, 0.1);
      }

      .ai-message.user .ai-message-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Input Section */
      .ai-input-section {
        padding: 16px 20px;
        background: white;
        border-top: 2px solid #e0e0e0;
      }

      .ai-input-toolbar {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
        align-items: center;
      }

      .ai-toolbar-btn {
        padding: 6px 12px;
        background: #f0f0f0;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .ai-toolbar-btn:hover {
        background: #e0e0e0;
      }

      .ai-toolbar-btn.active {
        background: ${theme.primary};
        color: white;
        border-color: ${theme.primary};
      }

      .ai-context-indicator {
        flex: 1;
        font-size: 12px;
        color: #666;
        font-style: italic;
      }

      .ai-input-wrapper {
        display: flex;
        gap: 10px;
        align-items: flex-end;
      }

      #ai-question-input {
        flex: 1;
        padding: 12px 14px;
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        font-size: 15px;
        font-family: inherit;
        resize: none;
        min-height: 48px;
        max-height: 150px;
        transition: border-color 0.2s;
      }

      #ai-question-input:focus {
        outline: none;
        border-color: ${theme.primary};
      }

      .ai-send-btn {
        padding: 12px 20px;
        background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%);
        color: white;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 56px;
        height: 48px;
      }

      .ai-send-btn:hover:not(:disabled) {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }

      .ai-send-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .ai-send-icon {
        display: inline-block;
        transition: transform 0.2s;
      }

      .ai-send-btn:hover .ai-send-icon {
        transform: translateX(2px);
      }

      .ai-input-footer {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 12px;
        color: #999;
      }

      .ai-model-indicator {
        font-weight: 600;
      }

      /* Loading Animation */
      .ai-loading {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: ai-spin 0.8s linear infinite;
      }

      @keyframes ai-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .ai-typing-indicator {
        display: flex;
        gap: 4px;
        padding: 14px 16px;
      }

      .ai-typing-dot {
        width: 8px;
        height: 8px;
        background: #999;
        border-radius: 50%;
        animation: ai-typing 1.4s ease-in-out infinite;
      }

      .ai-typing-dot:nth-child(2) {
        animation-delay: 0.2s;
      }

      .ai-typing-dot:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes ai-typing {
        0%, 60%, 100% {
          transform: translateY(0);
          opacity: 0.7;
        }
        30% {
          transform: translateY(-10px);
          opacity: 1;
        }
      }

      /* Analyze Tab */
      .ai-analyze-section {
        padding: 24px;
        overflow-y: auto;
      }

      .ai-analyze-section h4 {
        font-size: 20px;
        margin-bottom: 8px;
        color: ${theme.primary};
      }

      .ai-analyze-section > p {
        color: #666;
        margin-bottom: 20px;
      }

      .ai-analysis-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }

      .ai-analysis-card {
        background: white;
        padding: 16px;
        border-radius: 10px;
        border: 1px solid #e0e0e0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }

      .ai-analysis-card h5 {
        font-size: 16px;
        margin-bottom: 12px;
        color: ${theme.primary};
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .ai-analysis-card p {
        font-size: 13px;
        color: #666;
        margin: 6px 0;
        line-height: 1.5;
      }

      .ai-analysis-card strong {
        color: #333;
        font-weight: 600;
      }

      .ai-analysis-result {
        margin-top: 16px;
        padding: 16px;
        background: white;
        border-radius: 10px;
        border: 1px solid #e0e0e0;
        line-height: 1.6;
        display: none;
      }

      .ai-analysis-result.visible {
        display: block;
      }

      /* Settings Tab */
      .ai-settings-section {
        padding: 24px;
        overflow-y: auto;
      }

      .ai-settings-section h4 {
        font-size: 20px;
        margin-bottom: 24px;
        color: ${theme.primary};
      }

      .ai-setting-group {
        margin-bottom: 24px;
      }

      .ai-setting-group label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
        color: #333;
      }

      .ai-setting-group select,
      .ai-setting-group input[type="range"] {
        width: 100%;
        padding: 10px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        background: white;
        cursor: pointer;
      }

      .ai-setting-group select:focus {
        outline: none;
        border-color: ${theme.primary};
      }

      .ai-setting-help {
        font-size: 12px;
        color: #999;
        margin-top: 6px;
        font-style: italic;
      }

      .ai-checkbox-label {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        user-select: none;
      }

      .ai-checkbox-label input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      .ai-checkbox-label span {
        font-weight: 500;
      }

      .ai-setting-actions {
        display: flex;
        gap: 12px;
        margin-top: 32px;
      }

      .ai-setting-group h5 {
        font-size: 16px;
        margin-bottom: 12px;
        color: ${theme.primary};
      }

      .ai-setting-group a {
        color: ${theme.primary};
        text-decoration: none;
        font-weight: 600;
      }

      .ai-setting-group a:hover {
        text-decoration: underline;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .ai-assistant-container {
          width: 100%;
          height: 100%;
          max-width: 100%;
          max-height: 100%;
          border-radius: 0;
        }

        .ai-assistant-header {
          border-radius: 0;
        }

        .ai-sidebar {
          display: none;
        }

        .ai-tabs {
          overflow-x: auto;
        }

        .ai-tab {
          padding: 12px 16px;
          font-size: 13px;
          white-space: nowrap;
        }

        .ai-analysis-grid {
          grid-template-columns: 1fr;
        }

        .ai-setting-actions {
          flex-direction: column;
        }
      }

      /* Print */
      @media print {
        #ai-assistant-overlay {
          display: none !important;
        }
      }
    `;

    return style;
  }

  // Initialize the assistant
  function init() {
    loadState();

    const overlay = createHTML();
    const style = createStyles();

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Initialize UI
    initializeUI();
    bindEvents();
    updatePageAnalysis();
    renderQuickActions();
    renderChatHistory();
    applyTheme();
  }

  // Initialize UI elements
  function initializeUI() {
    // Load API key
    if (state.apiKey) {
      const keyInput = document.getElementById('ai-api-key');
      if (keyInput) keyInput.value = state.apiKey;
    }

    // Populate model select
    const modelSelect = document.getElementById('ai-model-select');
    CONFIG.availableModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      if (model.id === state.currentModel) {
        option.selected = true;
      }
      modelSelect.appendChild(option);
    });

    // Set initial values
    document.getElementById('ai-temperature').value = state.temperature;
    document.getElementById('ai-temp-value').textContent = state.temperature;
    document.getElementById('ai-max-tokens').value = state.maxTokens;
    document.getElementById('ai-tokens-value').textContent = state.maxTokens;
    document.getElementById('ai-theme-select').value = state.currentTheme;
    document.getElementById('ai-auto-save').checked = state.autoSave;
    document.getElementById('ai-current-model').textContent = 
      CONFIG.availableModels.find(m => m.id === state.currentModel)?.name || 'GPT-3.5';

    // Load chat history into UI
    state.chatHistory.forEach(msg => {
      addMessageToUI(msg.content, msg.role);
    });
  }

  // Bind all event listeners
  function bindEvents() {
    // Header buttons
    document.getElementById('ai-close-btn').addEventListener('click', () => {
      document.getElementById('ai-assistant-overlay').style.display = 'none';
    });

    document.getElementById('ai-minimize-btn').addEventListener('click', () => {
      document.querySelector('.ai-assistant-container').classList.toggle('minimized');
    });

    // API Key
    document.getElementById('ai-save-key').addEventListener('click', saveApiKey);
    document.getElementById('ai-toggle-key').addEventListener('click', toggleKeyVisibility);

    // Send message
    document.getElementById('ai-send-btn').addEventListener('click', sendMessage);
    document.getElementById('ai-question-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Character count
    document.getElementById('ai-question-input').addEventListener('input', updateCharCount);

    // Toolbar buttons
    document.getElementById('ai-attach-page').addEventListener('click', togglePageContext);
    document.getElementById('ai-attach-selection').addEventListener('click', toggleSelectionContext);
    document.getElementById('ai-clear-context').addEventListener('click', clearContext);

    // Tabs
    document.querySelectorAll('.ai-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Settings
    document.getElementById('ai-model-select').addEventListener('change', (e) => {
      state.currentModel = e.target.value;
      document.getElementById('ai-current-model').textContent = 
        CONFIG.availableModels.find(m => m.id === state.currentModel)?.name || 'GPT-3.5';
      saveState();
    });

    document.getElementById('ai-temperature').addEventListener('input', (e) => {
      state.temperature = parseFloat(e.target.value);
      document.getElementById('ai-temp-value').textContent = state.temperature;
      saveState();
    });

    document.getElementById('ai-max-tokens').addEventListener('input', (e) => {
      state.maxTokens = parseInt(e.target.value);
      document.getElementById('ai-tokens-value').textContent = state.maxTokens;
      saveState();
    });

    document.getElementById('ai-theme-select').addEventListener('change', (e) => {
      state.currentTheme = e.target.value;
      applyTheme();
      saveState();
    });

    document.getElementById('ai-auto-save').addEventListener('change', (e) => {
      state.autoSave = e.target.checked;
      saveState();
    });

    // History and favorites
    document.getElementById('ai-clear-history').addEventListener('click', clearHistory);

    // Analysis
    document.getElementById('ai-analyze-btn').addEventListener('click', performDeepAnalysis);

    // Data management
    document.getElementById('ai-export-data').addEventListener('click', exportData);
    document.getElementById('ai-import-data').addEventListener('click', importData);
    document.getElementById('ai-reset-all').addEventListener('click', resetAll);

    // Close on overlay click
    document.getElementById('ai-assistant-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'ai-assistant-overlay') {
        e.target.style.display = 'none';
      }
    });
  }

  // Save API key
  function saveApiKey() {
    const apiKey = document.getElementById('ai-api-key').value.trim();
    if (apiKey) {
      state.apiKey = apiKey;
      localStorage.setItem(CONFIG.storageKeys.apiKey, apiKey);
      addMessageToUI('✅ API Key saved successfully!', 'system');
      
      // Hide the API key section after saving
      setTimeout(() => {
        document.getElementById('ai-api-key-section').style.display = 'none';
      }, 1500);
    }
  }

  // Toggle key visibility
  function toggleKeyVisibility() {
    const input = document.getElementById('ai-api-key');
    const btn = document.getElementById('ai-toggle-key');
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  }

  // Update character count
  function updateCharCount() {
    const input = document.getElementById('ai-question-input');
    const count = input.value.length;
    document.getElementById('ai-char-count').textContent = `${count} characters`;
  }

  // Context management
  let includePageContent = false;
  let includeSelection = false;

  function togglePageContext() {
    includePageContent = !includePageContent;
    const btn = document.getElementById('ai-attach-page');
    btn.classList.toggle('active', includePageContent);
    updateContextIndicator();
  }

  function toggleSelectionContext() {
    const selection = getSelectedText();
    if (selection) {
      includeSelection = !includeSelection;
      state.selectedText = includeSelection ? selection : '';
      const btn = document.getElementById('ai-attach-selection');
      btn.classList.toggle('active', includeSelection);
      updateContextIndicator();
    } else {
      addMessageToUI('⚠️ Please select some text on the page first.', 'system');
    }
  }

  function clearContext() {
    includePageContent = false;
    includeSelection = false;
    state.selectedText = '';
    state.conversationHistory = [];
    document.getElementById('ai-attach-page').classList.remove('active');
    document.getElementById('ai-attach-selection').classList.remove('active');
    updateContextIndicator();
    addMessageToUI('🗑️ Context and conversation history cleared.', 'system');
  }

  function updateContextIndicator() {
    const indicator = document.getElementById('ai-context-indicator');
    const parts = [];
    if (includePageContent) parts.push('📄 Page');
    if (includeSelection) parts.push('📌 Selection');
    indicator.textContent = parts.length ? `Context: ${parts.join(', ')}` : '';
  }

  // Switch tabs
  function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.ai-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.ai-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  }

  // Add message to UI
  function addMessageToUI(content, role) {
    const messagesDiv = document.getElementById('ai-chat-messages');
    
    // Remove welcome message if exists
    const welcome = messagesDiv.querySelector('.ai-welcome-message');
    if (welcome) welcome.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `ai-message ${role}`;
    
    // Format content (support markdown-like formatting)
    const formattedContent = formatMessage(content);
    messageDiv.innerHTML = formattedContent;

    // Add action buttons for assistant messages
    if (role === 'assistant') {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'ai-message-actions';
      actionsDiv.innerHTML = `
        <button class="ai-message-btn" onclick="navigator.clipboard.writeText(\`${content.replace(/`/g, '\\`')}\`)">📋 Copy</button>
        <button class="ai-message-btn ai-read-aloud">🔊 Read</button>
        <button class="ai-message-btn ai-favorite">⭐ Save</button>
      `;
      messageDiv.appendChild(actionsDiv);
    }

    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Format message with basic markdown support
  function formatMessage(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // Send message
  async function sendMessage() {
    if (state.isProcessing) return;

    const input = document.getElementById('ai-question-input');
    const question = input.value.trim();

    if (!question) return;

    const apiKey = document.getElementById('ai-api-key')?.value.trim() || state.apiKey;
    if (!apiKey) {
      addMessageToUI('❌ Please enter your OpenAI API key first.', 'error');
      return;
    }

    // Add user message
    addMessageToUI(question, 'user');
    state.chatHistory.push({ role: 'user', content: question, timestamp: Date.now() });
    input.value = '';
    updateCharCount();

    // Show typing indicator
    const messagesDiv = document.getElementById('ai-chat-messages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'ai-message assistant';
    typingDiv.innerHTML = `
      <div class="ai-typing-indicator">
        <div class="ai-typing-dot"></div>
        <div class="ai-typing-dot"></div>
        <div class="ai-typing-dot"></div>
      </div>
    `;
    messagesDiv.appendChild(typingDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Disable send button
    state.isProcessing = true;
    const sendBtn = document.getElementById('ai-send-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="ai-loading"></span>';

    try {
      // Build context
      const messages = buildMessageContext(question);

      // Call API
      const response = await callOpenAI(messages);

      // Remove typing indicator
      typingDiv.remove();

      // Add response
      addMessageToUI(response, 'assistant');
      state.chatHistory.push({ role: 'assistant', content: response, timestamp: Date.now() });
      state.conversationHistory.push({ role: 'user', content: question });
      state.conversationHistory.push({ role: 'assistant', content: response });

      // Trim history
      if (state.chatHistory.length > CONFIG.maxHistoryLength) {
        state.chatHistory = state.chatHistory.slice(-CONFIG.maxHistoryLength);
      }

      saveState();
      renderChatHistory();

    } catch (error) {
      typingDiv.remove();
      addMessageToUI(`❌ Error: ${error.message}`, 'error');
    } finally {
      state.isProcessing = false;
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span class="ai-send-icon">▶</span>';
    }
  }

  // Build message context for API
  function buildMessageContext(question) {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant that helps users understand and analyze web pages. Provide clear, concise, and accurate responses. Use formatting when helpful.'
      }
    ];

    // Add page context if enabled
    if (includePageContent) {
      const pageData = getPageContent();
      messages.push({
        role: 'system',
        content: `Current webpage information:
Title: ${pageData.metadata.title}
URL: ${pageData.metadata.url}
Description: ${pageData.metadata.description}

Page content (excerpt):
${pageData.text.substring(0, 4000)}`
      });
    }

    // Add selected text if enabled
    if (includeSelection && state.selectedText) {
      messages.push({
        role: 'system',
        content: `Selected text from page: "${state.selectedText}"`
      });
    }

    // Add conversation history (last 10 messages)
    const recentHistory = state.conversationHistory.slice(-10);
    messages.push(...recentHistory);

    // Add current question
    messages.push({
      role: 'user',
      content: question
    });

    return messages;
  }

  // Render quick actions
  function renderQuickActions() {
    const container = document.getElementById('ai-quick-actions');
    container.innerHTML = '';

    Object.entries(PROMPT_TEMPLATES).forEach(([key, template]) => {
      const btn = document.createElement('button');
      btn.className = 'ai-quick-action-btn';
      btn.textContent = template.name;
      btn.addEventListener('click', () => {
        document.getElementById('ai-question-input').value = template.prompt;
        document.getElementById('ai-question-input').focus();
      });
      container.appendChild(btn);
    });
  }

  // Render chat history
  function renderChatHistory() {
    const container = document.getElementById('ai-history-list');
    container.innerHTML = '';

    if (state.chatHistory.length === 0) {
      container.innerHTML = '<div class="ai-empty-state">No history yet</div>';
      return;
    }

    // Get last 10 user messages
    const userMessages = state.chatHistory
      .filter(msg => msg.role === 'user')
      .slice(-10)
      .reverse();

    userMessages.forEach(msg => {
      const item = document.createElement('div');
      item.className = 'ai-history-item';
      item.textContent = msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : '');
      item.title = msg.content;
      item.addEventListener('click', () => {
        document.getElementById('ai-question-input').value = msg.content;
        document.getElementById('ai-question-input').focus();
      });
      container.appendChild(item);
    });
  }

  // Clear history
  function clearHistory() {
    if (confirm('Clear all chat history?')) {
      state.chatHistory = [];
      state.conversationHistory = [];
      saveState();
      
      const messagesDiv = document.getElementById('ai-chat-messages');
      messagesDiv.innerHTML = '<div class="ai-welcome-message"><h4>👋 Chat history cleared!</h4><p>Start a new conversation.</p></div>';
      
      renderChatHistory();
    }
  }

  // Update page analysis
  function updatePageAnalysis() {
    const pageData = getPageContent();
    const wordCount = pageData.text.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / 200); // Average reading speed

    const links = document.querySelectorAll('a[href]');
    const externalLinks = Array.from(links).filter(a => {
      try {
        return new URL(a.href).hostname !== window.location.hostname;
      } catch {
        return false;
      }
    });

    // Update UI
    document.getElementById('info-title').textContent = document.title;
    document.getElementById('info-url').textContent = window.location.href;
    document.getElementById('info-words').textContent = wordCount.toLocaleString();
    document.getElementById('info-readtime').textContent = `${readTime} min`;
    document.getElementById('info-links').textContent = links.length;
    document.getElementById('info-external').textContent = externalLinks.length;
    document.getElementById('info-internal').textContent = links.length - externalLinks.length;
    document.getElementById('info-images').textContent = document.querySelectorAll('img').length;
    document.getElementById('info-videos').textContent = document.querySelectorAll('video').length;
    document.getElementById('info-description').textContent = pageData.metadata.description || 'None';
    document.getElementById('info-keywords').textContent = pageData.metadata.keywords || 'None';
  }

  // Perform deep AI analysis
  async function performDeepAnalysis() {
    const btn = document.getElementById('ai-analyze-btn');
    const resultDiv = document.getElementById('ai-deep-analysis');

    btn.disabled = true;
    btn.textContent = '🤖 Analyzing...';
    resultDiv.classList.remove('visible');

    try {
      const pageData = getPageContent();
      const messages = [
        {
          role: 'system',
          content: 'You are an expert web content analyzer. Provide detailed, structured analysis of web pages.'
        },
        {
          role: 'user',
          content: `Please provide a comprehensive analysis of this webpage:

Title: ${pageData.metadata.title}
URL: ${pageData.metadata.url}

Content:
${pageData.text.substring(0, 5000)}

Please analyze:
1. Main topic and purpose
2. Target audience
3. Content quality and credibility
4. Key points and takeaways
5. Tone and style
6. Any biases or limitations`
        }
      ];

      const response = await callOpenAI(messages, { maxTokens: 2000 });
      resultDiv.innerHTML = formatMessage(response);
      resultDiv.classList.add('visible');

    } catch (error) {
      resultDiv.innerHTML = `<div class="ai-message error">❌ Error: ${error.message}</div>`;
      resultDiv.classList.add('visible');
    } finally {
      btn.disabled = false;
      btn.textContent = '🤖 AI Deep Analysis';
    }
  }

  // Apply theme
  function applyTheme() {
    const oldStyle = document.getElementById('ai-assistant-styles');
    if (oldStyle) oldStyle.remove();
    
    const newStyle = createStyles();
    document.head.appendChild(newStyle);
  }

  // Export data
  function exportData() {
    const data = {
      version: CONFIG.version,
      chatHistory: state.chatHistory,
      favorites: state.favorites,
      settings: {
        currentModel: state.currentModel,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        currentTheme: state.currentTheme
      },
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-assistant-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addMessageToUI('✅ Data exported successfully!', 'system');
  }

  // Import data
  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            
            if (data.chatHistory) state.chatHistory = data.chatHistory;
            if (data.favorites) state.favorites = data.favorites;
            if (data.settings) {
              state.currentModel = data.settings.currentModel || state.currentModel;
              state.temperature = data.settings.temperature || state.temperature;
              state.maxTokens = data.settings.maxTokens || state.maxTokens;
              state.currentTheme = data.settings.currentTheme || state.currentTheme;
            }

            saveState();
            initializeUI();
            renderChatHistory();
            applyTheme();

            addMessageToUI('✅ Data imported successfully!', 'system');
          } catch (error) {
            addMessageToUI(`❌ Error importing data: ${error.message}`, 'error');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  // Reset all data
  function resetAll() {
    if (confirm('This will delete all your data including chat history, settings, and API key. Are you sure?')) {
      Object.values(CONFIG.storageKeys).forEach(key => {
        localStorage.removeItem(key);
      });
      
      addMessageToUI('✅ All data has been reset. Please refresh the page.', 'system');
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }

  // Initialize everything
  init();

  // Global exposure for inline event handlers
  window.aiAssistant = {
    sendMessage,
    saveApiKey,
    clearHistory,
    exportData,
    importData,
    resetAll
  };

})();

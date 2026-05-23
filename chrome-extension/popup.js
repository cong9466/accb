// DOM Elements
const btnSettings = document.getElementById('btn-settings');
const goToOptions = document.getElementById('go-to-options');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const matchingRulesContainer = document.getElementById('matching-rules');

let mcpServerUrl = '';
let rules = [];
let activeTab = null;

// ==========================================
// 1. 初始化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('[ACCB Popup] DOMContentLoaded triggered.');
  initPopup().catch(err => {
    console.error('[ACCB Popup] Initialization error:', err);
  });
});

async function initPopup() {
  console.log('[ACCB Popup] Initializing...');
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      activeTab = tabs[0];
      console.log('[ACCB Popup] Active tab queried:', activeTab.url);
    } else {
      console.warn('[ACCB Popup] No active tab found.');
    }
  } catch (e) {
    console.error('[ACCB Popup] Failed to query active tab:', e);
  }

  chrome.storage.local.get(['mcpServerUrl', 'rules'], (result) => {
    mcpServerUrl = result.mcpServerUrl || '';
    rules = result.rules || [];
    console.log('[ACCB Popup] Configuration loaded. Server:', mcpServerUrl, 'Rules count:', rules.length);

    if (mcpServerUrl) {
      checkServerStatus().catch(err => console.error('Status check error:', err));
    } else {
      updateStatusUI(false);
    }

    findMatchingRules();
  });

  if (btnSettings) {
    btnSettings.addEventListener('click', openOptions);
  }
  if (goToOptions) {
    goToOptions.addEventListener('click', openOptions);
  }
}

function openOptions(e) {
  if (e) e.preventDefault();
  chrome.runtime.openOptionsPage();
}

// ==========================================
// 2. 检查连接状态
// ==========================================
async function checkServerStatus() {
  console.log('[ACCB Popup] Checking connection to server:', mcpServerUrl);
  try {
    const formattedUrl = mcpServerUrl.endsWith('/') ? mcpServerUrl.slice(0, -1) : mcpServerUrl;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${formattedUrl}/v1/status`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('[ACCB Popup] Server response:', data);
      if (data.status === 'ok') {
        updateStatusUI(true);
        return;
      }
    }
    updateStatusUI(false);
  } catch (error) {
    console.warn('[ACCB Popup] Server status check failed:', error.message);
    updateStatusUI(false);
  }
}

function updateStatusUI(connected) {
  if (statusDot && statusText) {
    if (connected) {
      statusDot.className = 'status-dot connected';
      statusText.innerText = '已连接';
    } else {
      statusDot.className = 'status-dot';
      statusText.innerText = '未连接';
    }
  }
}

// ==========================================
// 3. 匹配当前网页规则
// ==========================================
function findMatchingRules() {
  if (!matchingRulesContainer) return;

  if (!activeTab || !activeTab.url) {
    matchingRulesContainer.innerHTML = `
      <div class="no-match" style="font-size: 0.8rem;">
        无法读取当前标签页 (可能是保护页面或空白页)
      </div>
    `;
    return;
  }

  const url = activeTab.url;
  
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    matchingRulesContainer.innerHTML = `
      <div class="no-match" style="font-size: 0.8rem;">
        系统保护页面，无法读取
      </div>
    `;
    return;
  }

  const matched = rules.filter(rule => matchesUrl(url, rule.urlPattern));
  console.log('[ACCB Popup] Matched rules for current url:', matched.length);

  if (matched.length === 0) {
    matchingRulesContainer.innerHTML = `
      <div class="no-match">
        当前网站没有匹配的提取规则
      </div>
    `;
    return;
  }

  matchingRulesContainer.innerHTML = '';
  matched.forEach(rule => {
    const item = document.createElement('div');
    item.className = 'matching-rule-item';

    item.innerHTML = `
      <div>
        <div class="rule-name">${rule.name}</div>
        <div class="rule-type-badge">${rule.sourceType}</div>
      </div>
      <button class="sync-btn" data-id="${rule.id}">提取推送</button>
    `;

    item.querySelector('.sync-btn').addEventListener('click', () => {
      console.log('[ACCB Popup] Push button clicked for rule:', rule.name);
      triggerManualSync(rule);
    });

    matchingRulesContainer.appendChild(item);
  });
}

function matchesUrl(url, pattern) {
  try {
    let regStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp('^' + regStr + '$', 'i');
    return regex.test(url);
  } catch (e) {
    return false;
  }
}

// ==========================================
// 4. 手动推送逻辑 (纯手动提取 localStorage/cookie，然后直接 fetch 本地服务)
// ==========================================
async function triggerManualSync(rule) {
  const syncBtn = document.querySelector(`.sync-btn[data-id="${rule.id}"]`);
  if (!syncBtn) return;

  const originalText = syncBtn.innerText;
  syncBtn.innerText = '同步中...';
  syncBtn.disabled = true;

  try {
    let tokenValue = '';
    console.log(`[ACCB Popup] Starting extraction for rule: ${rule.name}, source: ${rule.sourceType}`);
    
    // 1. 读取数据
    if (rule.sourceType === 'localStorage' || rule.sourceType === 'sessionStorage') {
      console.log(`[ACCB Popup] Querying tab scripting injection on tab ${activeTab.id}...`);
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (storageType, key) => {
          try {
            return window[storageType].getItem(key);
          } catch (e) {
            return null;
          }
        },
        args: [rule.sourceType, rule.sourceKey]
      });

      console.log('[ACCB Popup] Injection response received:', results);
      if (results && results[0] && results[0].result) {
        tokenValue = results[0].result;
      }
    } else if (rule.sourceType === 'cookie') {
      const parsedUrl = new URL(activeTab.url);
      console.log(`[ACCB Popup] Reading cookies for origin ${parsedUrl.origin}, key: ${rule.sourceKey}`);
      const cookie = await chrome.cookies.get({
        url: parsedUrl.origin,
        name: rule.sourceKey
      });
      console.log('[ACCB Popup] Cookie read response:', cookie);
      if (cookie) {
        tokenValue = cookie.value;
      }
    }

    console.log('[ACCB Popup] Extracted token value length:', tokenValue ? tokenValue.length : 0);

    if (!tokenValue) {
      throw new Error('未在对应字段中提取到值，或页面无权限访问');
    }

    // 2. 直接由 Popup 向本地 HTTP 发送请求
    if (!mcpServerUrl) {
      throw new Error('插件未配置本地服务地址，请前往 Options 配置！');
    }

    const formattedUrl = mcpServerUrl.endsWith('/') ? mcpServerUrl.slice(0, -1) : mcpServerUrl;
    const endpoint = `${formattedUrl}/v1/credentials`;

    console.log('[ACCB Popup] Sending HTTP POST directly to local server:', endpoint);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: rule.targetKey,
        value: tokenValue,
        domain: new URL(activeTab.url).hostname,
        source: `${rule.sourceType}_manual`
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const responseData = await response.json();
      console.log('[ACCB Popup] Server Response data:', responseData);
      
      console.log('[ACCB Popup] Sync complete successfully.');
      syncBtn.innerText = '成功 ✔';
      setTimeout(() => {
        syncBtn.innerText = originalText;
        syncBtn.disabled = false;
      }, 1500);
    } else {
      const errText = await response.text();
      throw new Error(`Server returned error: ${response.status} - ${errText}`);
    }

  } catch (error) {
    console.error('[ACCB Popup] Sync failed error catch:', error);
    syncBtn.innerText = '失败 ✖';
    syncBtn.style.background = 'var(--danger-color)';
    setTimeout(() => {
      syncBtn.innerText = originalText;
      syncBtn.style.background = '';
      syncBtn.disabled = false;
    }, 2000);
  }
}

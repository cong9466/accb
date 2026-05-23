// ==========================================
// 1. 核心自动提取与推送逻辑
// ==========================================
function extractAndPush() {
  chrome.storage.local.get(['rules'], (result) => {
    const rules = result.rules || [];
    const url = window.location.href;
    
    // 过滤出匹配当前 URL 的规则
    const matched = rules.filter(rule => matchesUrl(url, rule.urlPattern));
    
    matched.forEach(rule => {
      console.log(`[ACCB Content] URL matches rule: ${rule.name}. Initiating auto onload extraction.`);
      
      if (rule.sourceType === 'localStorage' || rule.sourceType === 'sessionStorage') {
        let tokenValue = '';
        try {
          const store = rule.sourceType === 'localStorage' ? window.localStorage : window.sessionStorage;
          tokenValue = store.getItem(rule.sourceKey);
        } catch (e) {
          console.error('[ACCB Content] Storage access failed:', e);
        }

        if (tokenValue) {
          console.log(`[ACCB Content] Extracted storage token for ${rule.targetKey}. Sending to background...`);
          chrome.runtime.sendMessage({
            action: 'pushCredential',
            data: {
              key: rule.targetKey,
              value: tokenValue,
              domain: window.location.hostname,
              source: 'auto_onload_storage'
            }
          });
        }
      } else if (rule.sourceType === 'cookie') {
        // Cookie 涉及 HttpOnly 和跨域，通知 background 代为获取和推送
        console.log(`[ACCB Content] Requesting background to fetch cookie: ${rule.sourceKey}`);
        chrome.runtime.sendMessage({
          action: 'readCookieAndPush',
          data: {
            domain: window.location.hostname,
            cookieName: rule.sourceKey,
            targetKey: rule.targetKey
          }
        });
      }
    });
  });
}

// 辅助：匹配 URL Glob 模式
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
// 2. 页面就绪监听
// ==========================================
if (document.readyState === 'complete') {
  extractAndPush();
} else {
  window.addEventListener('load', extractAndPush);
}

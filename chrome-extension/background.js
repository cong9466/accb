// ==========================================
// 1. 消息分发处理器 (中继推送与 Cookie 读取)
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ACCB Background] Action received:', message.action);

  if (message.action === 'pushCredential') {
    const { key, value, domain, source } = message.data;
    
    chrome.storage.local.get(['mcpServerUrl'], (result) => {
      const serverUrl = result.mcpServerUrl || '';
      if (!serverUrl) {
        sendResponse({ success: false, error: 'Server URL not configured.' });
        return;
      }

      const formattedUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
      fetch(`${formattedUrl}/v1/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value, domain, source })
      })
      .then(res => res.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true; // 异步返回
  }

  if (message.action === 'readCookieAndPush') {
    const { domain, cookieName, targetKey } = message.data;
    
    chrome.cookies.get({ url: `https://${domain}`, name: cookieName }, (cookie) => {
      if (cookie && cookie.value) {
        console.log(`[ACCB Background] Read cookie ${cookieName} for domain ${domain}. Pushing...`);
        
        chrome.storage.local.get(['mcpServerUrl'], (result) => {
          const serverUrl = result.mcpServerUrl || '';
          if (serverUrl) {
            const formattedUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
            fetch(`${formattedUrl}/v1/credentials`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                key: targetKey,
                value: cookie.value,
                domain: domain,
                source: 'auto_onload_cookie'
              })
            }).catch(e => console.error('[ACCB Background] Fetch error:', e));
          }
        });
      }
    });
    sendResponse({ success: true });
    return true;
  }
});

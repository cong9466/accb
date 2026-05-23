// DOM Elements
const mcpServerUrlInput = document.getElementById('mcp-server-url');
const btnTestConnection = document.getElementById('btn-test-connection');
const connectionStatus = document.getElementById('connection-status');
const rulesListContainer = document.getElementById('rules-list');

const btnNewRule = document.getElementById('btn-new-rule');
const ruleModal = document.getElementById('rule-modal');
const modalClose = document.getElementById('modal-close');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');
const ruleForm = document.getElementById('rule-form');
const modalTitle = document.getElementById('modal-title');

// Form inputs
const ruleIdInput = document.getElementById('rule-id');
const ruleNameInput = document.getElementById('rule-name');
const urlPatternInput = document.getElementById('url-pattern');
const targetKeyInput = document.getElementById('target-key');
const sourceTypeSelect = document.getElementById('source-type');
const sourceKeyInput = document.getElementById('source-key');

const toast = document.getElementById('toast');

// Global State
let rules = [];

// ==========================================
// 1. 初始化加载
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  // 从 Chrome Storage 读取配置
  chrome.storage.local.get(['mcpServerUrl', 'rules'], (result) => {
    if (result.mcpServerUrl) {
      mcpServerUrlInput.value = result.mcpServerUrl;
    }
    rules = result.rules || [];
    renderRules();
    
    if (result.mcpServerUrl) {
      testConnection(result.mcpServerUrl);
    }
  });

  setupEventListeners();
});

// ==========================================
// 2. 事件监听
// ==========================================
function setupEventListeners() {
  // 测试连接
  btnTestConnection.addEventListener('click', () => {
    const url = mcpServerUrlInput.value.trim();
    if (!url) {
      showToast('请填写完整的 URL！');
      return;
    }
    testConnection(url);
  });

  // 模态框控制
  btnNewRule.addEventListener('click', () => openModal());
  modalClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);
  btnSave.addEventListener('click', saveRule);
}

// ==========================================
// 3. 连接测试逻辑
// ==========================================
async function testConnection(url) {
  connectionStatus.innerText = '测试中...';
  connectionStatus.className = 'status-badge disconnected';

  try {
    const formattedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    const response = await fetch(`${formattedUrl}/v1/status`, {
      method: 'GET'
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'ok') {
        connectionStatus.innerText = '已连接';
        connectionStatus.className = 'status-badge connected';
        showToast('连接成功，配置已保存！');
        chrome.storage.local.set({ mcpServerUrl: url });
        return;
      }
    }
    throw new Error('Response verification failed');
  } catch (error) {
    console.error('Connection test failed:', error);
    connectionStatus.innerText = '连接失败';
    connectionStatus.className = 'status-badge disconnected';
    showToast('无法连接到本地服务，请确认 MCP 正常运行！');
  }
}

// ==========================================
// 4. 规则列表渲染
// ==========================================
function renderRules() {
  rulesListContainer.innerHTML = '';
  
  if (rules.length === 0) {
    rulesListContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-muted);">
        暂无规则。点击“新建提取规则”开始配置。
      </div>
    `;
    return;
  }

  rules.forEach((rule) => {
    const item = document.createElement('div');
    item.className = 'rule-item';

    item.innerHTML = `
      <div class="rule-info">
        <div class="rule-title">${rule.name}</div>
        <div class="rule-meta">
          <span class="meta-tag" style="color: var(--primary-color)">${rule.sourceType.toUpperCase()}</span>
          <span class="meta-tag">推送键: ${rule.targetKey}</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
          对应字段: ${rule.sourceKey} <br/> 匹配域名: <code style="color: #cbd5e1">${rule.urlPattern}</code>
        </div>
      </div>
      <div class="rule-actions">
        <button class="secondary edit-btn" data-id="${rule.id}">编辑</button>
        <button class="danger delete-btn" data-id="${rule.id}">删除</button>
      </div>
    `;

    item.querySelector('.edit-btn').addEventListener('click', () => openModal(rule.id));
    item.querySelector('.delete-btn').addEventListener('click', () => deleteRule(rule.id));

    rulesListContainer.appendChild(item);
  });
}

// ==========================================
// 5. 模态框增删改操作
// ==========================================
function openModal(id = null) {
  ruleForm.reset();
  
  if (id) {
    modalTitle.innerText = '编辑规则';
    const rule = rules.find(r => r.id === id);
    if (rule) {
      ruleIdInput.value = rule.id;
      ruleNameInput.value = rule.name;
      urlPatternInput.value = rule.urlPattern;
      targetKeyInput.value = rule.targetKey;
      sourceTypeSelect.value = rule.sourceType;
      sourceKeyInput.value = rule.sourceKey || '';
    }
  } else {
    modalTitle.innerText = '新建规则';
    ruleIdInput.value = '';
  }

  ruleModal.classList.add('active');
}

function closeModal() {
  ruleModal.classList.remove('active');
}

async function saveRule() {
  const name = ruleNameInput.value.trim();
  const urlPattern = urlPatternInput.value.trim();
  const targetKey = targetKeyInput.value.trim();
  const sourceType = sourceTypeSelect.value;
  const sourceKey = sourceKeyInput.value.trim();

  if (!name || !urlPattern || !targetKey || !sourceKey) {
    showToast('请填写必填字段！');
    return;
  }

  const id = ruleIdInput.value || Date.now().toString();
  const ruleData = {
    id,
    name,
    urlPattern,
    targetKey,
    sourceType,
    sourceKey
  };

  const existingIndex = rules.findIndex(r => r.id === id);
  if (existingIndex > -1) {
    rules[existingIndex] = ruleData;
  } else {
    rules.push(ruleData);
  }

  chrome.storage.local.set({ rules }, () => {
    closeModal();
    renderRules();
    showToast('规则保存成功！');
  });
}

function deleteRule(id) {
  if (confirm('确定要删除这条规则吗？')) {
    rules = rules.filter(r => r.id !== id);
    chrome.storage.local.set({ rules }, () => {
      renderRules();
      showToast('规则已删除！');
    });
  }
}

// ==========================================
// 6. Toast 提示逻辑
// ==========================================
let toastTimeout;
function showToast(message) {
  toast.innerText = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

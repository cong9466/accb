# accb (Agent Context & Credential Bridge)

一个通用的浏览器上下文变量（会话值 / Cookie 等）自动推送与本地 AI Agent 中继服务。

本项目旨在提供极致的**简单性**与**易用性**：零配置、零鉴权、无需手动启动服务。仅在您打开或刷新匹配页面时自动推送；同时保留 Popup 气泡上的**手动一键同步**作为备用。

---

## 🚀 核心特性

- **零配置即插即用**：脚本自动检测本地服务是否运行，未运行时自动后台拉起，无需手动启动或编辑配置文件。
- **可配置本地端口**：支持在 `server/config.json` 中自定义端口号（默认 `4099`）。
- **页面加载自动推送**：匹配网页加载/刷新完毕时，由 `content.js` 自动提取并推送，确保本地数据永远最新。
- **免鉴权极速中继**：插件数据直接 POST 推送到本地服务，开箱即用。
- **多实例共享**：多个 IDE / Agent 窗口共享同一个后台服务实例，互不冲突。

---

## 📂 项目结构

```text
accb/
├── SKILL.md                  # 技能描述文件，供大模型阅读后自动掌握使用方法
├── script/
│   └── get_token.js          # 一条命令获取值（自动启动服务 + 请求 + 输出）
├── chrome-extension/         # Chrome 浏览器插件
│   ├── manifest.json
│   ├── popup.html/js         # 气泡控制面板（手动推送）
│   ├── options.html/js       # 规则配置管理页
│   └── content.js            # 页面加载时自动提取脚本
├── server/                   # 本地 HTTP 服务端
│   ├── dist/
│   │   └── index.cjs         # 预编译零依赖单文件（仅需 Node.js）
│   ├── src/
│   │   └── index.ts          # 源码 (TypeScript)
│   └── config.json           # 端口配置（可选修改）
├── test-stdio.js             # 联合测试脚本
└── prd.md                    # 产品需求文档
```

---

## 🛠️ 快速开始

### 1. 获取上下文值（一条命令）

```bash
node script/get_token.js <key>
```

脚本会自动处理一切：
- 本地服务未运行 → **自动后台启动**
- 本地服务已运行 → 直接请求，毫秒级返回
- 成功时输出原始值到 stdout，失败时输出原因到 stderr

### 2. 安装 Chrome 浏览器插件

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角 **"开发者模式"**
3. 点击 **"加载已解压的扩展程序"**，选择项目中的 `chrome-extension` 目录
4. 进入插件选项页，确认本地地址为 `http://127.0.0.1:4099`，添加抓取规则
5. 打开或刷新目标网页，值会自动推送到本地

### 3. 自定义端口（可选）

编辑 `server/config.json`：
```json
{
  "port": 4099
}
```

---

## 🔌 多种读取方式

### 方式一：脚本调用（推荐）
```bash
node script/get_token.js clouddevops_token
```

### 方式二：HTTP 接口
```bash
# 获取特定 key 的值
curl http://127.0.0.1:4099/v1/credentials/clouddevops_token

# 列出所有已推送的值
curl http://127.0.0.1:4099/v1/credentials
```

---

## 🤖 AI Agent 集成

整个项目就是一个即插即用的 Skill。大模型读取根目录下的 `SKILL.md` 后，即可自动掌握使用方式：
- 需要上下文值时，执行 `node script/get_token.js <key>`
- 获取失败时，引导用户安装浏览器插件

### MCP 挂载（可选增强）

如果您的 Agent 客户端支持 MCP 协议，也可以挂载本服务以获得原生工具调用能力：

**Cline / Cursor**：
```json
{
  "mcpServers": {
    "accb-server": {
      "command": "node",
      "args": ["<project_root>/server/dist/index.cjs"]
    }
  }
}
```

**Codex / OpenCode**：
```toml
[mcp_servers.accb_server]
command = "node"
args = ["<project_root>/server/dist/index.cjs"]
enabled = true
startup_timeout_sec = 30
```

挂载后可通过 MCP Tool 调用 `get_credential` 和 `list_credentials`。

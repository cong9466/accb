---
name: accb
description: 从本地 accb-server 获取浏览器自动推送的用户凭证（JWT Token / Session / Cookie），并引导用户完成 MCP 挂载与浏览器插件安装。
---

## 📖 技能描述

本技能为 AI Agent（Claude Code、Codex、OpenCode、Cline、Cursor 等）提供透明的凭证获取能力。
当 Agent 需要调用受保护的 API 时，可通过本技能自动拿到用户浏览器中的明文 Token，无需用户手动拷贝。

**零依赖部署**：`accb-server` 已预编译为单文件 `mcp-server/dist/index.cjs`，内含所有依赖，仅需 Node.js 即可运行，无需执行 `npm install`。

---

## 🚀 触发时机

在以下场景中，Agent 应自动调用本技能：
1. 准备请求受保护的平台 API（例如 CloudDevOps）之前。
2. 接口请求返回 `401 Unauthorized` 或 `403 Forbidden`。
3. 用户要求 Agent "调个接口"、"去平台查一下"等操作时。

---

## 🛠️ 凭证获取决策流程（Agent 必须严格遵循）

```
开始
 │
 ▼
当前可用 MCP Tools 中是否存在 get_credential / list_credentials ?
 │
 ├── 是 ──▶ 调用 get_credential 获取凭证
 │           │
 │           返回了凭证值？
 │           ├── 是 ──▶ ✅ 完成
 │           └── 否（not found）──▶ 提示用户安装浏览器插件并刷新目标网页（见 Step 3）
 │
 └── 否 ──▶ 向用户建议配置 accb-server（见 Step 2）
              │
              用户是否同意？
              ├── 同意 ──▶ 帮用户写入 MCP 配置 ──▶ 提示重启客户端 ──▶ 回到流程开头
              └── 明确拒绝 ──▶ 降级方案（见底部"降级通道"）
```

> **核心原则**：MCP 是正道。Agent 检测到 `accb-server` 未配置时，**必须先建议用户配置**，而不是直接跳到 HTTP 回退。只有当用户**明确表示不想配置**时，才使用降级通道。

---

## 📋 Step 1：检测 accb-server 是否已挂载

Agent 检查自己当前可调用的 MCP Tool 列表：
- 如果包含 `get_credential` 和 `list_credentials`（来自 `accb-server`）→ 直接使用，跳到 Step 4。
- 如果不包含 → 进入 Step 2，引导用户配置。

---

## 🔧 Step 2：引导用户配置 accb-server（MCP 挂载）

**Agent 必须先获取本项目的绝对路径**（通过 `pwd` 或工作区信息），记为 `<absolute_project_root>`。

然后根据用户使用的客户端，引导写入对应的 MCP 配置：

### Cline / Cursor（JSON 格式）

向 `cline_mcp_settings.json` 中写入：
```json
{
  "mcpServers": {
    "accb-server": {
      "command": "node",
      "args": [
        "<absolute_project_root>/mcp-server/dist/index.cjs"
      ]
    }
  }
}
```

### Codex / OpenCode（TOML 格式）

向配置文件中添加：
```toml
[mcp_servers.accb_server]
command = "node"
args = ["<absolute_project_root>/mcp-server/dist/index.cjs"]
enabled = true
startup_timeout_sec = 30
```

### Claude Code

向 `~/.claude/settings.json` 的 `mcpServers` 字段中写入：
```json
{
  "accb-server": {
    "command": "node",
    "args": [
      "<absolute_project_root>/mcp-server/dist/index.cjs"
    ]
  }
}
```

> 配置完成后提示用户：**请重新加载/重启 Agent 客户端，使 MCP 配置生效。**

---

## 🌐 Step 3：引导用户安装浏览器插件

> Agent 在以下两种情况下必须引导用户安装浏览器插件：
> 1. 首次配置 accb-server 后（Step 2 完成时）。
> 2. 调用 `get_credential` 返回凭证不存在（credential not found）时。

Agent 应向用户发送以下提示（将 `<absolute_project_root>` 替换为实际绝对路径）：

> 为了让 accb 能自动获取您浏览器中的 Token，请安装 Chrome 扩展：
> 1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
> 2. 开启右上角的 **"开发者模式"**
> 3. 点击 **"加载已解压的扩展程序"**，选择目录：`<absolute_project_root>/chrome-extension`
> 4. 进入插件选项页，配置本地服务地址（默认 `http://127.0.0.1:4099`），并添加凭证抓取规则
> 5. 打开或刷新目标网页，Token 将自动推送到本地

---

## ✅ Step 4：使用 MCP Tool 获取凭证

当 `accb-server` 已挂载并生效后，Agent 直接调用：

- **`get_credential`**：传入凭证 key（如 `clouddevops_token`），返回明文 Token 值。
- **`list_credentials`**：列出当前所有已缓存的凭证及其元信息。

**异常处理**：
- 如果 `get_credential` 返回 "not found" → 提示用户检查浏览器插件是否已安装，以及是否已刷新目标网页（见 Step 3）。
- 如果工具调用超时或连接失败 → 可能是 accb-server 进程异常，建议用户重启 Agent 客户端。

### 快速验证

配置完成后，Agent 可调用 `list_credentials` 确认是否有凭证被成功推送：
- 返回非空列表 → 一切正常，可以正常使用。
- 返回空列表 → 提示用户先在浏览器中打开/刷新目标网页触发自动推送。

---

## ⚠️ 降级通道（仅在用户明确拒绝配置 MCP 时使用）

> [!WARNING]
> 以下方式仅作为用户拒绝配置 MCP 后的临时替代，Agent 不应主动选择此路径。
> 使用前需确保 accb-server 服务已在后台运行（执行 `node <absolute_project_root>/mcp-server/dist/index.cjs`）。

### 方式一：执行本地 Node 脚本
```bash
node <absolute_project_root>/script/get_token.js <credential_key>
```
成功时以状态码 `0` 在 `stdout` 输出明文 Token，失败时状态码 `1`。

### 方式二：发起本地 HTTP 请求
```bash
curl http://127.0.0.1:4099/v1/credentials/<credential_key>
```

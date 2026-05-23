# Agent Context & Credential Bridge (ACCB)

一个通用的浏览器凭证（Token/Cookie）手动/自动推送与本地 AI Agent 中继网桥。

本项目旨在提供极致的**简单性**与**易用性**：零鉴权、无后台常驻脚本、无页面注入拦截。仅在您打开或刷新匹配页面时自动推送；同时保留 Popup 气泡上的**手动一键同步**作为备用。

---

## 🚀 核心特性

- **可配置本地端口**：支持在 `mcp-server/config.json` 中自定义端口号，无需修改源码，完美兼容端口冲突场景。
- **端口强杀机制**：如果本地服务的端口已被其它进程占用，启动时会自动对其执行 **Force Kill 强杀并释放**，确保持续可用，彻底告别 `EADDRINUSE` 报错。
- **页面加载 (Onload) 自动推送**：无需点击、无定时器挂起，仅当匹配的网页在浏览器中加载/刷新完毕时，由 `content.js` 自动瞬时触发提取并推送，确保本地 Token 永远最新。
- **免鉴权极速中继**：插件数据可免鉴权直接 POST 推送到本地服务，开箱即用。
- **双通道极简读取**：
  - **MCP 协议通道**：AI Agent (如 Cline/Cursor/Antigravity) 直接调用 `get_credential` 工具获取明文 Token。
  - **极简 HTTP 接口通道**：其他本地普通 Skill/脚本，直接发送一个 `GET` 请求（如 `curl http://127.0.0.1:4099/v1/credentials/clouddevops_token`）便能瞬间拿到明文 Token，无需任何鉴权。

---

## 📂 项目结构

```text
clouddevops/ (即插即用的 accb skill 项目)
├── SKILL.md                  # 技能描述文件，供大模型阅读快速掌握并指导 MCP 挂载与插件安装
├── script/                   # 本地轻量执行脚本目录
│   └── get_token.js          # 纯 Node 执行脚本，直接输出明文 Token
├── chrome-extension/         # Chrome 插件目录
│   ├── manifest.json         # 插件配置文件 (极简配置)
│   ├── popup.html/js         # 气泡控制面板 (手动一键强制推送)
│   ├── options.html/js       # 规则配置后台管理页 (暗黑科技风格 UI)
│   └── content.js            # 页面就绪 (onload) 时自动拦截和提取脚本
├── mcp-server/               # 本地 MCP & HTTP 服务端目录
│   ├── src/
│   │   └── index.ts          # Express 接收器及 MCP 逻辑 (TypeScript)
│   ├── config.json           # 端口及基础属性配置文件 (可自由修改端口)
│   ├── package.json          # TS 项目依赖及脚本声明
│   └── tsconfig.json         # TS 编译输出配置 (ESM)
├── test-stdio.js             # 本地全自动 Stdio/HTTP 联合模拟测试脚本
└── prd.md                    # 产品需求文档
```

---

## 🛠️ 快速开始

### 1. 启动本地服务
若要修改监听端口，请直接编辑项目下的 `mcp-server/config.json` 文件：
```json
{
  "port": 4099
}
```
然后在 `mcp-server` 目录，安装依赖、编译并启动服务：
```bash
cd mcp-server
npm install
npm run build
npm run start
```
服务启动时会去自动读取 `config.json` 下的 `port` 属性（如果配置占用了其它端口，也会在启动时自动强杀释放）。

### 2. 安装与配置 Chrome 插件
1. 打开 Chrome 浏览器，访问 `chrome://extensions/`。
2. 开启右上角的 **“开发者模式”**。
3. 点击 **“加载已解压的扩展程序”**，选择 `clouddevops/chrome-extension` 目录载入。
4. 进入插件的**“选项”**页面，填写您在 `config.json` 中配置的本地服务地址（如 `http://127.0.0.1:4099`），点击测试连接保存。
5. 开启“新建规则”，配置您的提取字段与目标 URL Pattern。当目标网页加载完成后，数据会自动静默推送到本地。

---

## 🔌 其它本地 Skill 读取凭证（HTTP 接口与 AI Agent 专用 Skill 插件）

为了方便其他 AI Agent（如 Claude Code, Codex, OpenCode 等）加载和使用，或普通的 Python 脚本、Shell 脚本直接调取明文凭证，我们提供了以下接口：

### 方式一：加载本项目的 `accb` 技能 (推荐)
整个项目本身就是一个即插即用的技能（Skill），当通过 `npx skills add` 等方式挂载本目录后，大模型将自动读取并使用：
- **`SKILL.md`**：项目根目录下的技能描述文件，大模型阅读后可自动掌握其使用时机与调用规范，自动配置 MCP Server 并提示用户安装 Chrome 插件。
- **`script/get_token.js`**：纯 CommonJS 编写的极简执行脚本，无任何依赖包，100% 保证在任意环境下调用成功：
```bash
# 语法: node script/get_token.js <credential_key>
node script/get_token.js clouddevops_token
```
> **返回值**：成功时直接将 Token 明文输出到 stdout（无多余空格与 JSON 封装），进程退出码为 0。

### 方式二：直接发起 curl 请求 (以 4099 端口为例)
* **获取当前所有的凭证列表 (JSON)**：
  ```bash
  curl http://127.0.0.1:4099/v1/credentials
  ```
* **直接获取特定 Token 的明文值 (Text)**（例如获取 `clouddevops_token`）：
  ```bash
  curl http://127.0.0.1:4099/v1/credentials/clouddevops_token
  ```

---

## 🤖 在 Agent (如 Cline / Cursor / Codex) 中挂载使用

### 1. Cline / Cursor (JSON 格式)
在您的 Agent 客户端配置文件（例如 Cline 中的 `cline_mcp_settings.json`）中加入本服务（请替换其中的 `<absolute_project_root>` 为您的项目实际绝对路径，斜杠建议使用 `/`）：

```json
{
  "mcpServers": {
    "accb-server": {
      "command": "node",
      "args": [
        "<absolute_project_root>/mcp-server/dist/index.js"
      ]
    }
  }
}
```

### 2. Codex / OpenCode (TOML 格式)
在您的 Codex / OpenCode 的配置文件中添加以下 TOML 挂载规则（同样请替换其中的 `<absolute_project_root>`，斜杠建议使用 `/`）：

```toml
[mcp_servers.accb_server]
command = "node"
args = ["<absolute_project_root>/mcp-server/dist/index.js"]
enabled = true
startup_timeout_sec = 30
```

挂载后，Agent 可通过以下 Tool 直接调用：
- **`get_credential`**: 输入指定的 key，获取当前保存在本地服务中的**明文 Token 值**。
- **`list_credentials`**: 列出当前所有的凭证及对应的域名与更新时间。

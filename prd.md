# Product Requirement Document (PRD)
# Agent Context & Credential Bridge (ACCB)

## 1. 概述与背景 (Overview & Background)

在日常使用 AI Agent (如 Antigravity) 执行自动化任务或调用内部开发平台 (如 CloudDevOps) 时，Agent 经常因为缺少单点登录 (SSO) Token、JWT 凭证或 session 状态而导致接口请求失败。

**Agent Context & Credential Bridge (ACCB)** 提供了一个**极简、通用、零手动干预**的本地解决方案：
- **前端 (浏览器插件)**: 允许用户通过图形界面配置提取规则，从当前网页的 `localStorage`、`sessionStorage` 或 `Cookie` 中获取 Token。**支持在页面加载完毕（load 事件）后自动提取并推送至本地服务，实现网页刷新后 Token 永远最新。**
- **后端 (MCP Server)**: 在本地运行并监听端口，接收插件推送的凭证，并以标准 MCP Tool 以及普通 HTTP GET 接口的形式提供给 AI Agent 或其它本地 Skill 脚本。

---

## 2. 核心功能需求 (Core Functional Requirements)

### 2.1 浏览器插件 (Chrome Extension - Manifest V3)

#### 2.1.1 动态提取规则配置 (Extraction Rule Settings)
用户可以在插件配置页中增删改查不同的提取规则，每个规则包含：
1. **Rule Name**: 规则名称（例如：`CloudDevOps JWT`）。
2. **Domain/URL Pattern**: 匹配的域名或 URL Glob 表达式（例如：`*.clouddevops.com`）。
3. **Target MCP Key**: 推送到 MCP 时的键名（例如：`clouddevops_token`）。
4. **Data Source (数据源)**:
   - `LocalStorage`: 读取指定 Key 的值。
   - `SessionStorage`: 读取指定 Key 的值。
   - `Cookie`: 读取指定 Name 的值。
5. **Trigger Mode (触发机制)**:
   - `Auto Onload` (自动触发 - 页面就绪时): 匹配域名网页的 `load` 事件触发时，自动提取对应值并通过 background 发送到本地。
   - `Manual` (手动触发 - 备用): 用户点击插件面板上的“一键推送”按钮触发提取。

#### 2.1.2 凭证网络传输 (Relay Client)
- 提取到值后，通过 Background 中继发送 `POST` 请求到本地 MCP Server（免鉴权）：
  ```json
  {
    "key": "clouddevops_token",
    "value": "eyJhbGciOi...",
    "domain": "clouddevops.com",
    "source": "auto_onload_storage",
    "updated_at": 1716480000000
  }
  ```

---

### 2.2 本地 MCP Server

#### 2.2.1 本地 HTTP 接口 (Credential Receiver & Reader)
- 暴露一个本地监听端口（如 `127.0.0.1:4099`），**无任何鉴权**，方便本地工具极速读写。
- **`POST /v1/credentials`**: 接收插件推送上来的凭证。
- **`GET /v1/credentials`**: 返回当前缓存的全部凭证列表。
- **`GET /v1/credentials/:key`**: 直接返回指定 key 的明文 Token 字符串。

#### 2.2.2 MCP Tools (向 AI Agent 暴露的能力)
MCP Server 将作为 Agent 的扩展工具运行，提供以下标准 tools：

1. **`get_credential`**
   - **描述**: 根据凭证 Key 查出对应的明文 Token 实值。
   - **参数**:
     - `key` (string, 必须): 凭证的 Key 名。
   - **返回**: 凭证明文值。

2. **`list_credentials`**
   - **描述**: 列出当前缓存在本地 MCP 服务中的所有凭证列表，包含其 Key, 明文 Value, 关联域名及同步时间。
   - **参数**: 无.
   - **返回**: 完整凭证列表。

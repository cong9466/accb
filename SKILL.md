---
name: accb
description: 从本地 `accb-server` 中拉取浏览器捕获并推送上来的用户敏感凭证（如 JWT Token、Session ID 或 Cookie 等），或者引导用户快速配置 `accb-server` 本地 MCP 服务和安装 `accb` 浏览器插件。
---

## 📖 技能描述 (Description)

本技能供 AI Agent (如 Claude Code、Codex、OpenCode 等) 在执行开发任务或发起 API 请求时使用：
1. **获取凭证**：大模型可以通过本地执行命令快速获取 Token，无需提示用户手动拷贝或泄露私密配置。
2. **引导安装与配置 (自动/半自动)**：如果大模型发现本地 `accb-server` 尚未启动或未配置 MCP 协议，可读取本技能指南自动帮用户生成配置或引导用户配置启动。

---

## 🚀 触发时机 (Triggers)

在大模型遇到以下情况时应当自动调用本技能：
1. Agent 准备请求内部或外部受保护的平台 API (例如 `clouddevops` API) 之前。
2. 之前的接口请求返回了 `401 Unauthorized` 或 `403 Forbidden`。
3. 用户要求 Agent “调个接口”或者“去开发平台查看项目列表”时。
4. **[初次使用]** Agent 被加载到此项目目录时，如果检测到本地 MCP 服务尚未运行或未注册，**应优先引导用户进行 MCP 挂载与浏览器插件安装**。

---

## 🛠️ 调用与配置规范 (Execution & Configuration Guide)

### 1. 凭证获取通道优先级策略 (Credential Access Priority)

大模型在需要读取目标凭证时，**必须遵循以下优先级路径**：

*   **【首选】通道一：MCP Server 直接调用**
    如果大模型检测到当前可用 MCP Tools 列表中包含 `get_credential` 与 `list_credentials`（且注册服务为 `accb-server`），**应优先且直接使用 MCP Tool 进行查询**。这是性能最高且最推荐的通道。
*   **【备选】通道二：本地脚本 / HTTP 接口回退**
    如果检测到当前环境下没有加载 `accb-server`（如不支持 MCP 挂载，或者主服务离线），则**回退使用以下两种方式之一获取**：
    1. **执行 Node.js 脚本**：
       ```bash
       node script/get_token.js <credential_key>
       ```
       > **参数说明**：`credential_key` 为凭证键名（如 `clouddevops_token`），脚本成功执行将以状态码 `0` 在 `stdout` 中输出明文 Token。
    2. **直接发起本地 HTTP 请求**（以默认端口 4099 为例）：
       ```bash
       curl http://127.0.0.1:4099/v1/credentials/<credential_key>
       ```

### 2. 自动/引导配置 MCP 服务 (Agent Configures MCP)

`accb` 提供了完整的本地 MCP Server（位于 `mcp-server/` 目录下）。为了让大模型在 Cline/Cursor 等客户端中能直接以 Tool 形式调用 `get_credential` 工具，Agent 可以**协助用户完成以下配置**：

*   **获取绝对路径**：
    大模型在配置前，**必须先获取此项目（或本 `SKILL.md` 文件）在用户本地的绝对路径** `<absolute_project_root>`（例如可通过命令行 `pwd`，或者查看当前工作区路径获取）。
*   **Cline / VS Code Extension 挂载配置 (JSON)**：
    向 `C:/Users/用户名/AppData/Roaming/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` 中自动或引导写入以下配置（请将下面的 `<absolute_project_root>` 替换为获取到的实际 absolute 路径，Windows 系统下路径中的斜杠建议使用 `/`）：
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
*   **Codex / OpenCode 挂载配置 (TOML)**：
    向 Codex / OpenCode 的配置文件中写入或引导用户添加以下配置（请同样将下面的 `<absolute_project_root>` 替换为实际 absolute 路径，斜杠建议使用 `/`）：
    ```toml
    [mcp_servers.accb_server]
    command = "node"
    args = ["<absolute_project_root>/mcp-server/dist/index.js"]
    enabled = true
    startup_timeout_sec = 30
    ```
*   **启动/测试本地服务**：
    指示用户或由 Agent 直接在 `mcp-server` 目录下运行：
    ```bash
    cd mcp-server
    npm install
    npm run build
    npm run start
    ```

### 3. 引导安装浏览器插件 (Prompt User to Install Extension)

> [!IMPORTANT]
> Agent 应主动向用户发送友好提示，引导其加载 `accb` 浏览器插件。

**Agent 回复话术模板**：
> "为了使 accb 正常工作，请在 Chrome 浏览器中加载本项目中的浏览器扩展：
> 1. 打开 Chrome 浏览器并访问 `chrome://extensions/`
> 2. 开启右上角的 **“开发者模式”**
> 3. 点击 **“加载已解压的扩展程序”**，选择项目中的 `chrome-extension/` 目录
> 4. 在插件选项页中配置本地地址（默认 `http://127.0.0.1:4099`）并添加抓取规则。"

---

## 📝 开发者备注

1. 使用本技能前，请确认本地的 `accb-server` 服务已经运行，且浏览器中安装的配置插件已处于“已连接”状态。
2. 插件会在您刷新匹配的网页时自动执行 Onload 提取并推送到本地，无需手动处理。

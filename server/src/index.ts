import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import http from "http";

// ==========================================
// 1. 数据结构定义与内存存储
// ==========================================
interface Credential {
  key: string;
  value: string;
  domain: string;
  source: string;
  updatedAt: number;
}

const credentialStore = new Map<string, Credential>();

// 从配置文件中动态读取端口号，如果不存在则退回环境变量或默认 4099
let HTTP_PORT = 4099;
if (process.env.ACCB_PORT) {
  HTTP_PORT = parseInt(process.env.ACCB_PORT);
} else {
  try {
    const configPath = path.join(process.cwd(), "config.json");
    if (fs.existsSync(configPath)) {
      const configRaw = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(configRaw);
      if (config.port) {
        HTTP_PORT = parseInt(config.port);
        console.error(`[accb] 端口配置已加载: ${HTTP_PORT}`);
      }
    }
  } catch (err: any) {
    console.error(`[accb] 配置文件解析失败，使用默认端口 4099。错误:`, err.message);
  }
}

// ==========================================
// 2. 启动 Express 服务 (无任何鉴权，方便极速调用)
// ==========================================
const app = express();
app.use(cors());
app.use(express.json());

// 接口 1: 保存或更新凭证 (POST)
app.post("/v1/credentials", (req, res) => {
  const { key, value, domain, source } = req.body;

  if (!key || !value) {
    res.status(400).json({ error: "Missing required fields: key and value" });
    return;
  }

  const credential: Credential = {
    key,
    value,
    domain: domain || "unknown",
    source: source || "manual",
    updatedAt: Date.now(),
  };

  credentialStore.set(key, credential);
  console.error(`[accb] 已保存: key=${key}, source=${source}, length=${value.length}`);
  res.json({ success: true, message: `Credential '${key}' saved successfully.` });
});

// 接口 2: 获取所有凭证列表 (GET) - 方便其他本地非 MCP 脚本/Skill 直接读取
app.get("/v1/credentials", (req, res) => {
  const list = Array.from(credentialStore.values());
  res.json(list);
});

// 接口 3: 直接读取特定 key 的明文 (GET) - 方便最极简的 curl/fetch 读取明文
app.get("/v1/credentials/:key", (req, res) => {
  const cred = credentialStore.get(req.params.key);
  if (!cred) {
    res.status(404).json({ error: `Credential '${req.params.key}' not found` });
    return;
  }
  // 直接以 text 形式返回明文 value，最方便使用
  res.setHeader("Content-Type", "text/plain");
  res.send(cred.value);
});

// 接口 4: 心跳与状态检查
app.get("/v1/status", (req, res) => {
  res.json({
    status: "ok",
    active_keys: Array.from(credentialStore.keys()),
  });
});

// ==========================================
// Mock 站点服务（用于本地联合调试）
// ==========================================
app.post("/mock/login", (req, res) => {
  console.error("[accb Mock] Mock Login API triggered");
  res.json({
    status: "success",
    data: {
      token: "mock-token-secret-xyz-777888"
    }
  });
});

app.get("/mock/index.html", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>ACCB Test Site</title>
      <style>
        body { background: #0f172a; color: #f1f5f9; font-family: system-ui, sans-serif; padding: 40px; text-align: center; }
        .card { background: #1e293b; border-radius: 8px; padding: 20px; max-width: 500px; margin: 20px auto; border: 1px solid rgba(255,255,255,0.1); }
        button { background: #3b82f6; border: none; color: white; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; margin: 10px; }
        button:hover { background: #2563eb; }
        #status-log { font-family: monospace; background: #000; padding: 10px; border-radius: 4px; color: #10b981; max-height: 150px; overflow-y: auto; text-align: left; }
      </style>
    </head>
    <body>
      <h1>ACCB Mock Test Platform</h1>
      <p>用于验证浏览器插件的 LocalStorage 定时/事件读取，以及登录网络请求拦截能力。</p>
      
      <div class="card">
        <h3>模拟动作</h3>
        <button id="btn-login">1. 模拟登录 (触发 Fetch POST)</button>
        <button id="btn-set-storage">2. 修改 LocalStorage</button>
        <button id="btn-clear">3. 清除数据</button>
      </div>

      <div class="card">
        <h3>系统日志</h3>
        <div id="status-log">等待操作...</div>
      </div>

      <script>
        const log = (msg) => {
          const div = document.getElementById('status-log');
          div.innerHTML += '<div>[' + new Date().toLocaleTimeString() + '] ' + msg + '</div>';
          div.scrollTop = div.scrollHeight;
        };

        document.getElementById('btn-login').addEventListener('click', async () => {
          log('发送 POST /mock/login 请求...');
          try {
            const res = await fetch('/mock/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: 'test-user', password: 'password123' })
            });
            const data = await res.json();
            log('登录成功，接口返回 Token: ' + data.data.token);
            localStorage.setItem('my_app_jwt', data.data.token);
            log('同时写入 localStorage: my_app_jwt = ' + data.data.token);
          } catch(e) {
            log('登录请求失败: ' + e);
          }
        });

        document.getElementById('btn-set-storage').addEventListener('click', () => {
          const randomVal = 'storage_token_' + Math.floor(Math.random() * 100000);
          localStorage.setItem('my_app_jwt', randomVal);
          log('写入 localStorage: my_app_jwt = ' + randomVal);
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
          localStorage.removeItem('my_app_jwt');
          log('已清除 localStorage 中的 my_app_jwt');
        });
      </script>
    </body>
    </html>
  `);
});

// 检查并强杀占用该端口的本地进程 (防止 EADDRINUSE)
function killProcessOnPort(port: number) {
  try {
    console.error(`[accb] 检查端口 ${port} 占用情况...`);
    let stdout = "";
    if (process.platform === "win32") {
      try {
        stdout = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, { encoding: "utf8" });
      } catch (e) {
        console.error(`[accb] 端口 ${port} 空闲`);
        return;
      }

      const lines = stdout.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0" && parseInt(pid) !== process.pid) {
            console.error(`[accb] 端口 ${port} 被 PID ${pid} 占用，正在释放...`);
            try {
              execSync(`taskkill /F /PID ${pid}`);
              console.error(`[accb] 已终止进程 ${pid}`);
            } catch (err: any) {
              console.error(`[accb] 无法终止进程 ${pid}:`, err.message);
            }
          }
        }
      }
    } else {
      // 兼容 Unix/Mac 平台
      try {
        stdout = execSync(`lsof -t -i:${port}`, { encoding: "utf8" });
        const pids = stdout.split("\n").filter(Boolean);
        for (const pid of pids) {
          if (parseInt(pid) !== process.pid) {
            console.error(`[accb] 端口 ${port} 被 PID ${pid} 占用，正在释放...`);
            execSync(`kill -9 ${pid}`);
          }
        }
      } catch (e) {}
    }
    // 等待 300ms 确保 OS 释放端口
    execSync(`node -e "setTimeout(() => {}, 300)"`);
  } catch (err: any) {
    console.error(`[accb] 检查/释放端口 ${port} 时出错:`, err.message);
  }
}

// ==========================================
// 2.5 检查端口健康状态
// ==========================================
function checkPortHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/v1/status`, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === "ok");
        } catch (e) {
          resolve(false);
        }
      });
    });
    req.on("error", () => {
      resolve(false);
    });
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// ==========================================
// 3. 启动 MCP Server (Stdio 传输)
// ==========================================
const mcpServer = new Server(
  {
    name: "accb-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_credential",
        description: "Retrieve a stored context value by its key.",
        inputSchema: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "The unique key of the credential to look up.",
            },
          },
          required: ["key"],
        },
      },
      {
        name: "list_credentials",
        description: "List all currently stored context values with their metadata.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_credential") {
      const key = args?.key as string;
      if (!key) {
        throw new Error("Missing parameter 'key'");
      }

      const cred = credentialStore.get(key);
      if (!cred) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Credential for key '${key}' not found.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: cred.value,
          },
        ],
      };
    }

    if (name === "list_credentials") {
      const list = Array.from(credentialStore.values()).map((cred) => ({
        key: cred.key,
        value: cred.value,
        domain: cred.domain,
        source: cred.source,
        updatedAt: new Date(cred.updatedAt).toISOString(),
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ credentials: list }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Tool '${name}' not found.`);
  } catch (error: any) {
    console.error(`[accb] 工具 ${name} 执行出错:`, error);
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Execution Error: ${error.message || error}`,
        },
      ],
    };
  }
});

async function main() {
  // Check if another accb instance is already healthy on this port
  const alreadyRunning = await checkPortHealth(HTTP_PORT);
  if (alreadyRunning) {
    console.error(`[accb] 服务已在端口 ${HTTP_PORT} 运行，当前实例退出。`);
    process.exit(0);
  }

  // Kill foreign process on port
  killProcessOnPort(HTTP_PORT);

  // Start HTTP server
  app.listen(HTTP_PORT, '127.0.0.1', () => {
    console.error(`[accb] HTTP 服务已启动: http://127.0.0.1:${HTTP_PORT}`);
  });

  // MCP stdio is optional (graceful failure for background/detached mode)
  try {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('[accb] MCP stdio 传输已连接');
  } catch (err) {
    console.error('[accb] MCP stdio 不可用，仅以 HTTP 模式运行。');
  }
}

main().catch((err) => {
  console.error("[accb] 启动时发生致命错误:", err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const http = require('http');

// 动态读取配置文件的端口号 (处理多路径兼容)
function getPort() {
  try {
    const possiblePaths = [
      path.join(__dirname, '..', 'mcp-server', 'config.json'),
      path.join(process.cwd(), 'mcp-server', 'config.json')
    ];
    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.port) {
          return parseInt(config.port);
        }
      }
    }
  } catch (e) {
    // 忽略异常
  }
  return 4099; // 降级到默认端口
}

const key = process.argv[2];
if (!key) {
  console.error('用法: node script/get_token.js <credential_key>');
  process.exit(1);
}

const port = getPort();
const url = `http://127.0.0.1:${port}/v1/credentials/${key}`;

// 发起原生 HTTP GET 请求 (无需任何第三方 npm 包依赖，保证通用性)
http.get(url, (res) => {
  if (res.statusCode !== 200) {
    if (res.statusCode === 404) {
      console.error(`[ACCB Skill] 错误: 凭证 '${key}' 尚未缓存在本地服务中。`);
      console.error(`             请打开对应网页刷新，以便插件自动捕获并推送该 Token。`);
    } else {
      console.error(`[ACCB Skill] 错误: 本地服务返回 HTTP ${res.statusCode}`);
    }
    process.exit(1);
  }

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    // 纯文本输出到标准输出，退出码为 0
    process.stdout.write(data.trim());
    process.exit(0);
  });
}).on('error', (err) => {
  console.error(`[ACCB Skill] 错误: 无法连接到本地服务 (端口 ${port})。`);
  console.error(`             请先运行 'npm run start' 启动本地 mcp-server 服务。`);
  process.exit(1);
});

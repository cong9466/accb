import { spawn } from 'child_process';

// 1. 推送 Token 函数
async function simulatePluginPush() {
  console.log('2. 正在模拟 Chrome 插件直接将 Token 投递到本地服务 (port 4200)...');
  try {
    const res = await fetch('http://127.0.0.1:4200/v1/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'my_mock_token',
        value: 'mock-token-secret-xyz-777888', // 测试明文 token
        domain: '127.0.0.1',
        source: 'manual'
      })
    });

    const data = await res.json();
    console.log('   推送结果:', data);
    return true;
  } catch (err) {
    console.error('   推送失败:', err.message);
    return false;
  }
}

// 2. 执行主调用
function run() {
  console.log('1. 拉起 MCP 进程 (指定端口 4200)...');

  const mcp = spawn('node', ['mcp-server/dist/index.js'], {
    env: {
      ...process.env,
      ACCB_PORT: '4200'
    }
  });

  let responseBuffer = '';
  let serverReady = false;

  mcp.stdout.on('data', (data) => {
    responseBuffer += data.toString();
    console.log('\n--- Received on stdout ---');
    console.log(data.toString());
    console.log('--------------------------');
  });

  mcp.stderr.on('data', async (data) => {
    const logLine = data.toString().trim();
    if (logLine) {
      console.log('   [MCP Log]:', logLine);
    }

    if (logLine.includes('HTTP Server listening') && !serverReady) {
      serverReady = true;
      
      // 等待 200 毫秒确保端口绑定完成
      setTimeout(async () => {
        const pushSuccess = await simulatePluginPush();
        if (pushSuccess) {
          sendToolCall(mcp);
        } else {
          mcp.kill();
        }
      }, 200);
    }
  });

  mcp.on('close', (code) => {
    console.log(`4. MCP 进程退出，退出码: ${code}`);
    try {
      const response = JSON.parse(responseBuffer.trim());
      console.log('\n--- Agent 成功接收到 MCP 返回结果 ---');
      console.log(JSON.stringify(response, null, 2));
      console.log('------------------------------------');
    } catch (e) {
      console.error('解析 MCP 响应失败，原始输出为:', responseBuffer);
    }
  });
}

function sendToolCall(mcp) {
  console.log('3. 发送 JSON-RPC 格式的 get_credential 指令，直接获取明文 Token...');

  const toolCallPayload = {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 'test-call-1',
    params: {
      name: 'get_credential',
      arguments: {
        key: 'my_mock_token'
      }
    }
  };

  mcp.stdin.write(JSON.stringify(toolCallPayload) + '\n');

  // 等待 1 秒后关闭 stdin，让 mcp 进程自然结束退出
  setTimeout(() => {
    mcp.stdin.end();
  }, 1000);
}

run();

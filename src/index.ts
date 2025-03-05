import { DirectClient } from "@elizaos/client-direct";
import {
  AgentRuntime,
  elizaLogger,
  settings,
  stringToUuid,
  type Character,
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { createNodePlugin } from "@elizaos/plugin-node";
import { solanaPlugin } from "@elizaos/plugin-solana";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDbCache } from "./cache/index.ts";
import { character } from "./character.ts";
import { startChat } from "./chat/index.ts";
import { initializeClients } from "./clients/index.ts";
import {
  getTokenForProvider,
  loadCharacters,
  parseArguments,
} from "./config/index.ts";
import { initializeDatabase } from "./database/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  elizaLogger.error('未捕获的异常:', error);
  // 根据错误的严重程度决定是否退出
  if (error.message.includes('FATAL') || error.message.includes('CRITICAL')) {
    process.exit(1);
  }
});

// 处理未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  elizaLogger.error('未处理的 Promise 拒绝:', reason);
  // 将未处理的 rejection 转换为未捕获的异常
  promise.catch((error) => {
    throw error;
  });
});

// 处理程序退出
process.on('exit', (code) => {
  elizaLogger.log(`程序即将退出，退出码: ${code}`);
  // 在这里执行任何必要的清理工作
});

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
  const waitTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

let nodePlugin: any | undefined;

export function createAgent(
  character: Character,
  db: any,
  cache: any,
  token: string
) {
  elizaLogger.success(
    elizaLogger.successesTitle,
    "Creating runtime for character",
    character.name,
  );

  nodePlugin ??= createNodePlugin();

  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    plugins: [
      bootstrapPlugin,
      nodePlugin,
      character.settings?.secrets?.WALLET_PUBLIC_KEY ? solanaPlugin : null,
    ].filter(Boolean),
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache,
  });
}

async function startAgent(character: Character, directClient: DirectClient) {
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getTokenForProvider(character.modelProvider, character);
    const dataDir = path.join(__dirname, "../data");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log('Initializing database...');
    const db = initializeDatabase(dataDir);

    console.log('Initializing database connection...');
    await db.init();

    console.log('Initializing cache...');
    const cache = initializeDbCache(character, db);
    const runtime = createAgent(character, db, cache, token);

    await runtime.initialize();

    runtime.clients = await initializeClients(character, runtime);

    directClient.registerAgent(runtime);

    // report to console
    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

    return runtime;
  } catch (error) {
    elizaLogger.error(
      `Error starting agent for character ${character.name}:`,
      error,
    );
    console.error(error);
    throw error;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

const startAgents = async () => {
  try {
    const directClient = new DirectClient();
    let serverPort = parseInt(settings.SERVER_PORT || "3000");
    const args = parseArguments();

    let charactersArg = args.characters || args.character;
    let characters = [character];

    elizaLogger.log("正在加载角色配置...");
    if (charactersArg) {
      characters = await loadCharacters(charactersArg);
    }
    elizaLogger.log("已加载角色:", characters.map(c => c.name).join(', '));

    for (const character of characters) {
      try {
        await startAgent(character, directClient as DirectClient);
      } catch (error) {
        elizaLogger.error(`启动角色 ${character.name} 时出错:`, error);
        // 继续启动其他角色
        continue;
      }
    }

    while (!(await checkPortAvailable(serverPort))) {
      elizaLogger.warn(`端口 ${serverPort} 已被占用，尝试端口 ${serverPort + 1}`);
      serverPort++;
    }

    directClient.startAgent = async (character: Character) => {
      return startAgent(character, directClient);
    };

    directClient.start(serverPort);

    if (serverPort !== parseInt(settings.SERVER_PORT || "3000")) {
      elizaLogger.log(`服务器已在备用端口 ${serverPort} 上启动`);
    }

    const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
    if(!isDaemonProcess) {
      elizaLogger.log("聊天已启动。输入 'exit' 退出。");
      const chat = startChat(characters);
      chat();
    }
  } catch (error) {
    elizaLogger.error("启动代理时发生错误:", error);
    throw error; // 重新抛出错误以触发全局错误处理
  }
};

// 使用 async/await 包装主函数调用
const main = async () => {
  try {
    await startAgents();
  } catch (error) {
    elizaLogger.error("程序启动失败:", error);
    process.exit(1);
  }
};

main();

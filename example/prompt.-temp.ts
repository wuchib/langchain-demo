/**
 * 
 * 这一篇的主线可以压成下面这个顺序：
 * 先创建 Agent
 * 再用 ChatPromptTemplate 整理这一轮输入
 * 如果有历史消息，就加 MessagesPlaceholder
 * 把模板生成的消息交给 agent.invoke() 或 agent.stream()
 * 
 */

import dotenv from "dotenv";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

dotenv.config({ path: new URL("../.env.local", import.meta.url) });

// 定义模型
const model = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  },
});
// 定义模板骨架
const prompt = ChatPromptTemplate.fromMessages([
  new MessagesPlaceholder({
    variableName: "history",
    optional: true,
  }),
  [
    "user",
    ["用户昵称：{nickname}", "当前场景：{scene}", "本轮输入：{input}"].join(
      "\n",
    ),
  ],
]);
// 具体模板信息
const messages = await prompt.formatMessages({
  history: [
    {
      role: "user",
      content: "今天开会又改需求了。",
    },
    {
      role: "assistant",
      content: "听起来你已经有点烦了，最麻烦的是哪一段？",
    },
  ],
  nickname: "小林",
  scene: "下班路上，还在想白天的事情",
  input: "最烦的是昨天刚定下来，今天又推翻了。",
});

// 定义 Agent
const agent = createAgent({
  model,
  tools: [],
  systemPrompt: "你是一个善解人意的陪伴助手",
});

// 定义 message
const inputMessages = {
  role: "user",
  content: "请用一句话说明当前是 Agent 流式调用验证。",
};

// Agent 调用 stream 流式输出，返回的是消息流
const stream = await agent.stream(
  {
    messages,
  },
  {
    // 设置 streamMode 为 messages，返回的是消息流
    streamMode: "messages",
  },
);

process.stdout.write("agent stream result:\n");

for await (const [messageChunk] of stream) {
  if (messageChunk.content) {
    process.stdout.write(messageChunk.text);
  }
}

process.stdout.write("\n");

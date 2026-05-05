/**
 * 如果 description 只写「查询信息」「执行操作」，模型很难判断它什么时候该用这个工具。
描述里最好直接写清楚：

这个工具解决什么问题
用户说到什么场景时该调用
参数大概是什么含义
 */


import { createAgent, tool } from "langchain";
import { z } from "zod";
import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";

dotenv.config({ path: new URL("../../.env.local", import.meta.url) });

const model = new ChatOpenAI({
  model: "deepseek-chat",
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  },
});
const getWeather = tool(
  async ({ city }) => {
    const data: Record<string, string> = {
      上海: "明天小雨，17-22 度",
      北京: "明天晴，12-25 度",
    };
    return data[city] ?? `${city}：暂无数据`;
  },
  {
    name: "get_weather",
    description: "查询某个城市未来的天气情况",
    schema: z.object({
      city: z.string().describe("要查询天气的城市名"),
    }),
  },
);

const createReminder = tool(
  async ({ content, time }) => {
    return `提醒已创建：${time} - ${content}`;
  },
  {
    name: "create_reminder",
    description: "帮用户创建一个提醒事项",
    schema: z.object({
      content: z.string().describe("提醒的具体内容"),
      time: z.string().describe("提醒时间，例如 明天早上 8 点"),
    }),
  },
);

const querySchedule = tool(
  async ({ date }) => {
    const schedules: Record<string, string> = {
      明天: "10:00 产品评审会，14:00 和小李 1v1",
      后天: "全天无日程",
    };
    return schedules[date] ?? `${date}：没有找到日程`;
  },
  {
    name: "query_schedule",
    description: "查询用户某一天的日程安排",
    schema: z.object({
      date: z.string().describe("要查询的日期，例如 今天、明天、后天"),
    }),
  },
);

const agent = createAgent({
  model,
  tools: [getWeather, createReminder, querySchedule],
  systemPrompt: `
你是用户的 AI 伴侣。
当用户请求涉及天气、提醒和日程时，使用对应工具。
如果用户只是在聊天，就直接回复，不要硬调工具。
  `.trim(),
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "明天上海天气怎么样？如果下雨，明早提醒我带伞。顺便看看我明天有什么安排。",
    },
  ],
});

console.log(result.messages.at(-1)?.text);

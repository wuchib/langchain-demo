/**
 * 第一，不要把 Few-Shot 写成“堆例子比赛”。
示例越多，不一定越稳。无关样例一多，反而会把当前输入淹没。

第二，不要让 Few-Shot 和 Agent 的长期设定打架。
Agent 已经有 systemPrompt，few-shot 就主要负责补样板，不要再在示例里夹带一套相反的风格要求。

这一篇放回整章主线里，位置其实很清楚：

Prompt Template 负责把输入组织好
Few-Shot 负责把回答样板补进去
Agent 再根据这份上下文继续运行
 */

import dotenv from 'dotenv'
import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import {
  ChatPromptTemplate,
  FewShotChatMessagePromptTemplate,
  MessagesPlaceholder,
} from '@langchain/core/prompts'

dotenv.config({ path: new URL('../.env.local', import.meta.url) })


const model = new ChatOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const agent = createAgent({
  model,
  tools: [],
  systemPrompt: '你是一名面向前端开发者的陪伴助手。先共情，再给建议，控制在 3 句话以内。',
})

// 准备示例数据
const examples = [
  {
    input: '今天开会被否了 3 次，我有点怀疑自己。',
    output:
      '被连续否定确实很伤状态，但这不等于你能力不行。先把被否的点拆成“需求变化”和“表达问题”两类，你会更容易看清哪里该改。今晚先别继续内耗，把问题归档下来就够了。',
  },
  {
    input: '我明知道要学 React 19，可一下班就只想躺着刷手机。',
    output:
      '你不是不想学，你只是下班后已经没有整块意志力了。今晚别定大目标，只看 15 分钟一个小点。先把启动门槛降下来，反而更容易重新进入状态。',
  },
]

// 规定每条示例怎样变成消息
const examplePrompt = ChatPromptTemplate.fromMessages([
  ['user', '{input}'],
  ['assistant', '{output}'],
])

// 把所有示例拼成一个可插入的模板块
const fewShotPrompt = new FewShotChatMessagePromptTemplate({
  examples,
  examplePrompt,
  inputVariables: [],
})

// const prompt = ChatPromptTemplate.fromMessages([
//   ...(await fewShotPrompt.formatMessages({})),
//   ['user', '{input}'],
// ])

const finalPrompt = ChatPromptTemplate.fromMessages([
  ...await fewShotPrompt.formatMessages({}),
  new MessagesPlaceholder('history'),
  ['user', '{input}'],  
])

// const promptValue = await prompt.invoke({
//   input: '今天被改了好多次需求，我现在真的有点烦。',
// })

// const result = await agent.invoke({
//   messages: promptValue.toChatMessages(),
// })

const promptValue = await finalPrompt.invoke({
  history: [
    {
      role: 'user',
      content: '今天开会又改需求了。',
    },
    {
      role: 'assistant',
      content: '听起来你已经有点烦了，最麻烦的是哪一段？',
    },
  ],
  input: '最烦的是昨天刚定下来，今天又推翻了。',
})

const result = await agent.invoke({
  messages: promptValue.toChatMessages(),
})

console.log(result.messages.at(-1)?.text)



// Agent 调用 stream 流式输出，返回的是消息流
// const stream = await agent.stream(
//   {
//     messages: [],
//   },
//   {
//     // 设置 streamMode 为 messages，返回的是消息流
//     streamMode: "messages",
//   },
// );

// process.stdout.write("agent stream result:\n");

// for await (const [messageChunk] of stream) {
//   if (messageChunk.content) {
//     process.stdout.write(messageChunk.text);
//   }
// }

// process.stdout.write("\n");
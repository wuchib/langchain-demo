/**
 * LCEL 最常见的落点，不是替代 Agent，而是放在 Agent 前后做一些稳定的小链路。

用一个具体例子来说：用户发来一句话，程序先清洗输入，再做本地优先级判断，最后把整理好的结果交给 Agent。


如果拆成流程看，就是：

用户原始输入先进入 LCEL 前置链
前置链补出 trimmedInput 和 priority
程序把这两个字段整理进一条消息
再交给 agent.invoke()
*/

import { createAgent } from 'langchain'
import { ChatOpenAI } from '@langchain/openai'
import { RunnableLambda, RunnablePassthrough } from '@langchain/core/runnables'
import dotenv from 'dotenv'

dotenv.config({ path: new URL('../../.env.local', import.meta.url) })



// 先保留原始输入，再补一个去空格后的字段。
const enrichInput = RunnablePassthrough.assign({
  trimmedInput: ({ input }: { input: string }) => input.trim(),
})

// 插入一小段本地规则，用来判断这条输入是否更紧急。
const detectPriority = RunnableLambda.from(
  ({ trimmedInput }: { trimmedInput: string }) => {
    const priority = trimmedInput.includes('线上') ? 'high' : 'normal'

    return {
      trimmedInput,
      priority,
    }
  }
)

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

// 这条链只负责 Agent 之前的预处理。
const preProcess = enrichInput.pipe(detectPriority)

// Agent 负责拿到整理后的消息，生成最终回复。
const agent = createAgent({
  model,
  tools: [],
  systemPrompt: [
    '你是一个前端陪伴助手。',
    '如果 priority=high，先帮用户稳住情绪，再给一个动作建议。',
    '如果 priority=normal，就正常交流，不要过度放大情绪。',
  ].join('\n'),
})

// 先跑前置链，拿到清洗后的输入和优先级。
const preProcessed = await preProcess.invoke({
  input: '  线上刚出故障，今晚估计又得加班。  ',
})

console.log(preProcessed);


// 再把前置链的结果整理成消息，交给 Agent。
const result = await agent.invoke({
  messages: [
    {
      role: 'user',
      content: [
        `priority=${preProcessed.priority}`,
        `input=${preProcessed.trimmedInput}`,
      ].join('\n'),
    },
  ],
})

// Agent 最后一条消息就是这一轮最终回复。
console.log(result.messages.at(-1)?.text ?? '')
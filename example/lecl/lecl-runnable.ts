/**
 * 一旦链路里再塞进「本地预处理」「规则判断」「结构化分析」这些步骤，你就得手动维护越来越多的中间变量。
LCEL 的价值就在这里：把「节点之间怎么接」写成显式结构。
 */

import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'
import dotenv from "dotenv";
import { RunnablePassthrough, RunnableLambda } from '@langchain/core/runnables'
dotenv.config({ path: new URL('../../.env.local', import.meta.url) })

const prompt = ChatPromptTemplate.fromMessages([
  ['system', '你是一个前端开发助手，回答简洁。'],
  ['user', '{input}'],
])

const model = new ChatOpenAI({
  model: 'deepseek-chat',
  apiKey: process.env.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
  },
})

const parser = new StringOutputParser()

const chain = prompt.pipe(model).pipe(parser)

// const result = await chain.invoke({
//   input: '解释一下 Runnable 为什么重要。',
// })
// console.log(result)

// RunnablePassthrough 不是“什么都不做”，而是“原样保留，再补一点派生信息”。
// const enrichInput = RunnablePassthrough.assign({
//   trimmedInput: ({ input }: { input: string }) => input.trim(),
//   inputLength: ({ input }: { input: string }) => input.trim().length,
// })

// const result = await enrichInput.invoke({
//   input: '  线上刚修完故障，我现在有点乱。  ',
// })

// console.log(result)


/**
 * RunnableLambda 适合放一小段本地逻辑。

比如你想在调模型前，先根据输入内容判断优先级。这个判断不需要模型，只是一点简单规则：
它适合承接这些轻量逻辑：

输入预处理
本地规则判断
补 Prompt 所需字段
一小段同步或异步计算
如果一段逻辑已经开始变得很长，里面全是分支、状态和副作用，那它就不该继续塞在一个 RunnableLambda 里了。
 */
const detectPriority = RunnableLambda.from(
  ({ trimmedInput }: { trimmedInput: string }) => {
    const urgentWords = ['线上', '故障', '崩溃', '来不及']
    const isUrgent = urgentWords.some((word) => trimmedInput.includes(word))

    return {
      trimmedInput,
      priority: isUrgent ? 'high' : 'normal',
    }
  }
)

const result = await detectPriority.invoke({
  trimmedInput: '线上刚修完故障，我现在有点乱。',
})

console.log(result)

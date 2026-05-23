/**
 * 比如模型超时、搜索接口临时抖一下、外部服务偶发返回空。碰到这种情况，最常见的做法就是在状态里加一个计数器，再留一条回边。
 */

import {
  StateGraph,
  StateSchema,
  START,
  END,
  Command,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const State = new StateSchema({
  query: z.string().default(''),
  result: z.string().default(''),
  retryCount: z.number().default(0),
  status: z.string().default('idle'),
  lastError: z.string().default(''),
})

const callSearchApi: GraphNode<typeof State> = async (state) => {
  try {
    const result = await fetchSearchResult(state.query)

    return {
      result,
      status: 'success',
      lastError: '',
    }
  } catch (error) {
    // 到这里说明这一次调用失败了，
    // 下面要决定的是继续重试，还是直接切到降级节点
    if (state.retryCount >= 2) {
      return new Command({
        update: {
          status: 'failed',
          lastError: error instanceof Error ? error.message : '搜索接口调用失败',
        },
        goto: 'fallbackAnswer',
      })
    }

    return new Command({
      update: {
        retryCount: state.retryCount + 1,
        status: 'retrying',
        lastError: error instanceof Error ? error.message : '搜索接口调用失败',
      },
      goto: 'callSearchApi',
    })
  }
}

const fallbackAnswer: GraphNode<typeof State> = (state) => {
  return {
    result: `最终降级：重试 ${state.retryCount} 次后仍然失败。`,
  }
}

const graph = new StateGraph(State)
  .addNode('callSearchApi', callSearchApi, { ends: ['callSearchApi', 'fallbackAnswer'] })
  .addNode('fallbackAnswer', fallbackAnswer)
  .addEdge(START, 'callSearchApi')
  .addEdge('fallbackAnswer', END)
  .compile()
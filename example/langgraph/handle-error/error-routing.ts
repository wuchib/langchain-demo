import {
  StateGraph,
  StateSchema,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode, ConditionalEdgeRouter } from '@langchain/langgraph'
import { z } from 'zod'

const State = new StateSchema({
  query: z.string().default(''),
  searchResult: z.string().default(''),
  status: z.string().default('idle'),
  lastError: z.string().default(''),
})

const callSearchApi: GraphNode<typeof State> = async (state) => {
  try {
    const result = await fetchSearchResult(state.query)

    return {
      searchResult: result,
      status: 'search-success',
      lastError: '',
    }
  } catch (error) {
    return {
      searchResult: '',
      status: 'search-failed',
      lastError: error instanceof Error ? error.message : '搜索接口调用失败',
    }
  }
}

const fallbackAnswer: GraphNode<typeof State> = (state) => {
  return {
    searchResult: `降级回答：当前外部搜索暂时不可用，错误信息是 ${state.lastError}`,
  }
}

const shouldContinue: ConditionalEdgeRouter<typeof State, 'fallbackAnswer'> = (state) => {
  if (state.status === 'search-failed') return 'fallbackAnswer'
  return END
}

const graph = new StateGraph(State)
  .addNode('callSearchApi', callSearchApi)
  .addNode('fallbackAnswer', fallbackAnswer)
  .addEdge(START, 'callSearchApi')
  .addConditionalEdges('callSearchApi', shouldContinue, ['fallbackAnswer'])
  .addEdge('fallbackAnswer', END)
  .compile()
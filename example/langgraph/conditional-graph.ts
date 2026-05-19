/**
 *  LangGraph 的核心设计思想：把 AI 的非确定性推理和系统的确定性流程控制分开。 模型负责「理解」和「生成」，图负责「流转」和「控制」
 * 
 * LangChain 提供的是组件——ChatModel、Tool、Prompt、OutputParser、Retriever。它解决的是「怎么和模型交互」的问题
   LangGraph 提供的是编排——节点、边、状态、持久化。它解决的是「多个步骤怎么组合在一起」的问题
 */
import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const State = new StateSchema({
  messages: MessagesValue,
  mood: z.enum(['happy', 'sad', 'neutral']).default('neutral'),
})

// 分析情绪的节点
const analyzeMood: GraphNode<typeof State> = (state) => {
  const lastMsg = state.messages.at(-1)?.content?.toString() ?? ''
  let mood: 'happy' | 'sad' | 'neutral' = 'neutral'
  if (lastMsg.includes('开心') || lastMsg.includes('高兴')) mood = 'happy'
  if (lastMsg.includes('难过') || lastMsg.includes('伤心')) mood = 'sad'
  return { mood }
}

// 不同情绪对应不同回复节点
const happyReply: GraphNode<typeof State> = () => ({
  messages: [{ role: 'assistant', content: '很高兴听到你这么开心！继续保持好心情 😊' }],
})

const sadReply: GraphNode<typeof State> = () => ({
  messages: [{ role: 'assistant', content: '别难过，有什么我能帮你的吗？' }],
})

const neutralReply: GraphNode<typeof State> = () => ({
  messages: [{ role: 'assistant', content: '你好，有什么可以帮你的？' }],
})

// 路由函数：根据状态中的 mood 字段决定走哪条边
type MoodRoute = 'happyReply' | 'sadReply' | 'neutralReply'

const moodRouter = (state: typeof State.State): MoodRoute => {
  switch (state.mood) {
    case 'happy': return 'happyReply'
    case 'sad': return 'sadReply'
    default: return 'neutralReply'
  }
}

const graph = new StateGraph(State)
  .addNode('analyzeMood', analyzeMood)
  .addNode('happyReply', happyReply)
  .addNode('sadReply', sadReply)
  .addNode('neutralReply', neutralReply)
  .addEdge(START, 'analyzeMood')
  // 条件边：analyzeMood 执行完后，根据 moodRouter 的返回值决定走哪个节点
  // 第三个参数列出这条边可能到达的目标，方便做结构校验和类型收窄。
  .addConditionalEdges('analyzeMood', moodRouter, [
    'happyReply', 'sadReply', 'neutralReply',
  ])
  .addEdge('happyReply', END)
  .addEdge('sadReply', END)
  .addEdge('neutralReply', END)
  .compile()

const result = await graph.invoke({
  messages: [{ role: 'user', content: '今天好开心啊' }],
})

console.log(result.messages.at(-1)?.content)
// → '很高兴听到你这么开心！继续保持好心情 😊'

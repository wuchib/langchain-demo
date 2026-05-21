/**
 * ends 要一起写上

用 Command 做路由时，addNode 的 ends 最好和节点一起声明。这样一来，图编译时能先知道这个节点可能跳到哪些目标；二来读代码时也能一眼看清这个节点的出口范围。

ends 的作用是告诉 LangGraph：这个节点可能会动态跳到哪些目标。图编译时需要这个信息来验证结构完整性和生成可视化。

Send 的并行结果需要 reducer

多个 Send 并行写同一个状态字段时，必须给这个字段声明 reducer（第三篇讲过的 ReducedValue）。没有 reducer 的话，多个并行写入会互相覆盖，最后只留下其中一个的值。

Command 和条件边可以混用

一张图里可以同时有用 Command 路由的节点和用条件边路由的节点。选哪种取决于那个节点的具体场景，不需要全图统一
 */

import {
  StateGraph,
  StateSchema,
  MessagesValue,
  ReducedValue,
  Command,
  Send,
  START,
  END,
} from '@langchain/langgraph'
import type { GraphNode } from '@langchain/langgraph'
import { z } from 'zod'

const appendStrings = (current: string[], update: string[]) => {
  return [...current, ...update]
}

const State = new StateSchema({
  messages: MessagesValue,
  cities: z.array(z.string()).default([]),
  weatherResults: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: appendStrings },
  ),
})

// 1. 解析节点：从用户消息里提取城市列表，然后扇出到查询节点
const parseCities: GraphNode<typeof State> = (state) => {
  const userMsg = state.messages.at(-1)?.content?.toString() ?? ''

  // 实际项目里这里会用 LLM 做实体提取，这里简化处理
  const knownCities = ['北京', '上海', '深圳', '广州', '杭州']
  const found = knownCities.filter((c) => userMsg.includes(c))

  if (found.length === 0) {
    // 没找到城市，直接结束
    return new Command({
      update: {
        messages: [{ role: 'assistant', content: '没有识别到城市名称。' }],
      },
      goto: END,
    })
  }

  // 找到了城市，更新城市列表 + 并行扇出查询
  return new Command({
    update: { cities: found },
    goto: found.map((city) => new Send('queryWeather', { cities: [city] })),
  })
}

// 2. 查询节点：查单个城市的天气（会被并行调用多次）
const queryWeather: GraphNode<typeof State> = (state) => {
  const city = state.cities[0]
  const data: Record<string, string> = {
    北京: '晴，12-25°C',
    上海: '小雨，17-22°C',
    深圳: '多云，26-30°C',
    广州: '阵雨，24-29°C',
    杭州: '晴转多云，15-27°C',
  }
  return {
    weatherResults: [`${city}：${data[city] ?? '暂无数据'}`],
  }
}

// 3. 汇总节点：把所有天气结果组织成最终回复
const formatReport: GraphNode<typeof State> = (state) => {
  const report = state.weatherResults.join('\n')
  return {
    messages: [{
      role: 'assistant',
      content: `查询到 ${state.cities.length} 个城市的天气：\n\n${report}`,
    }],
  }
}

const graph = new StateGraph(State)
  .addNode('parseCities', parseCities, { ends: ['queryWeather', END] })
  .addNode('queryWeather', queryWeather)
  .addNode('formatReport', formatReport)
  .addEdge(START, 'parseCities')
  .addEdge('queryWeather', 'formatReport')
  .addEdge('formatReport', END)
  .compile()

const result = await graph.invoke({
  messages: [{ role: 'user', content: '北京、上海和深圳今天天气怎么样？' }],
})

console.log(result.messages.at(-1)?.content)
// → 查询到 3 个城市的天气：
// →
// → 北京：晴，12-25°C
// → 上海：小雨，17-22°C
// → 深圳：多云，26-30°C
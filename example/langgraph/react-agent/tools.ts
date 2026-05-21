import { tool } from '@langchain/core/tools'
import * as z from 'zod'

// 查天气
const getWeather = tool(
  async ({ city }) => {
    const data: Record<string, string> = {
      北京: '晴，12-25°C',
      上海: '小雨，17-22°C',
      深圳: '多云，26-30°C',
    }
    return data[city] ?? `暂无 ${city} 的天气数据`
  },
  {
    name: 'get_weather',
    description: '查询指定城市的天气',
    schema: z.object({
      city: z.string().describe('城市名称'),
    }),
  },
)

// 做计算
const calculate = tool(
  async ({ expression }) => {
    try {
      // 生产环境请用安全的表达式解析器，这里仅做演示
      const result = new Function(`return ${expression}`)()
      return `${expression} = ${result}`
    } catch {
      return `无法计算: ${expression}`
    }
  },
  {
    name: 'calculate',
    description: '计算数学表达式',
    schema: z.object({
      expression: z.string().describe('数学表达式，例如 "2 + 3 * 4"'),
    }),
  },
)

// 查时间
const getCurrentTime = tool(
  async () => {
    return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
  },
  {
    name: 'get_current_time',
    description: '获取当前北京时间',
    schema: z.object({}),
  },
)

const tools = [getWeather, calculate, getCurrentTime]

export default tools
import { tool } from 'langchain'
import { z } from 'zod'

// 这个工具只负责查天气。
// 模型看到 description 和 schema 后，才知道什么时候该调它、该怎么传参。
export const getWeather = tool(
  async ({ city }) => {
    const fakeWeatherMap: Record<string, string> = {
      上海: '明天小雨，17-22 度',
      北京: '明天晴，12-25 度',
      深圳: '明天多云，26-30 度',
    }

    return fakeWeatherMap[city] ?? `${city}：暂无天气数据`
  },
  {
    name: 'get_weather',
    description: '查询某个城市未来的天气情况',
    schema: z.object({
      city: z.string().describe('要查询天气的城市名'),
    }),
  },
)

// 这个工具只负责创建提醒。
// 返回对象没有问题，后面模型照样能继续读取字段内容。
export const createReminder = tool(
  async ({ content, time }) => {
    return {
      ok: true,
      message: `提醒已创建：${time} - ${content}`,
    }
  },
  {
    name: 'create_reminder',
    description: '帮用户创建一个提醒事项',
    schema: z.object({
      content: z.string().describe('提醒的具体内容'),
      time: z.string().describe('提醒时间，例如 明天早上 8 点'),
    }),
  },
)
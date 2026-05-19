/**
 * 真实项目里的状态，通常不是只有一个字段。
而且不同字段往往需要不同的合并方式。
 */

import { StateSchema, MessagesValue, ReducedValue } from '@langchain/langgraph'
import { z } from 'zod'

const addNumber = (current: number, update: number) => current + update
const appendStrings = (current: string[], update: string[]) => [...current, ...update]

const State = new StateSchema({
  messages: MessagesValue,
  totalTokens: new ReducedValue(
    z.number().default(0),
    { reducer: addNumber },
  ),
  intermediateResults: new ReducedValue(
    z.array(z.string()).default([]),
    { reducer: appendStrings },
  ),
  finalAnswer: z.string().default(''),
})
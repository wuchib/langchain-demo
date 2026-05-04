/**
 * chunkSize 到底该设多少？chunkOverlap 到底该留多少？
 * 最直接的办法：

准备 5 到 10 个真实问题
跑一次检索
看返回的块是不是完整
一般只会遇到两种问题：

检索出来的信息总像缺半句
这通常是块太小，或者 overlap 不够

检索出来的内容什么都沾一点
这通常是块太大，几个话题混在一起了

调参数时，不要追求一开始就“最优”。
先让检索结果看起来像是能回答问题的，再继续细调。
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

const splitter = new RecursiveCharacterTextSplitter({
  // 每个块的最大长度。
  // 这里不是越大越好，太大了后面检索出来会不够聚焦。
  chunkSize: 800,
  // 相邻两个块保留一小段重叠，减少一句话刚好被切断的情况。
  chunkOverlap: 120,
})

// createDocuments 适合直接从纯文本字符串开始切。
// 如果前面已经有 Loader 产出的 Document[]，后面更常用的是 splitDocuments。
const chunks = await splitter.createDocuments([
  `请假流程分为三步。

第一步，员工需要在系统里提交申请。
第二步，直属主管审批。
第三步，人事确认并归档。`,
])

console.log(chunks.length)
// 看一眼切出来的第一块，确认它是不是一个完整的小段，而不是半句话。
console.log(chunks[0].pageContent)
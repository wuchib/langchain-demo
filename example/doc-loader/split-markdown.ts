import { MarkdownTextSplitter } from '@langchain/textsplitters'

const splitter = new MarkdownTextSplitter({
  // Markdown 文档通常希望尽量沿着标题结构切。
  chunkSize: 900,
  chunkOverlap: 120,
})

const chunks = await splitter.createDocuments([
  `# 员工手册

## 请假流程

员工提交申请后，需要主管审批。

## 报销流程

报销需要上传票据和审批单。`,
])

console.log(chunks);


// 这里切出来的块，通常会比普通分割更容易保持章节完整。
import { Document } from '@langchain/core/documents'

// Document 是后面整条检索链里最基础的数据结构。
// 不管原始内容来自 PDF、Markdown 还是网页，读进来以后都会先变成它。
const doc = new Document({
  // pageContent 放真正要参与 embedding 和检索的正文。
  pageContent: '这是文档正文',
  metadata: {
    // metadata 不直接参与语义匹配，但后面可以拿来标记来源、页码、时间等信息。
    source: 'notes.txt',
    page: 1,
  },
})
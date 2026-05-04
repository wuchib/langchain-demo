import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const pdfPath = join(currentDir, '入门前端.pdf')

// 这里先把原始 PDF 接进来。
// 这一步只负责“读文件”，还没有开始切块。
const loader = new PDFLoader(pdfPath)

// 这里拿到的是按页拆开的 Document[]。
const docs = await loader.load()

// 先看一眼整体数量，通常等于 PDF 页数。
console.log(docs.length)
// 再看正文内容，确认 Loader 真的把文字读出来了。
console.log(docs[0].pageContent.slice(0, 80))
// metadata 里通常会带 source、页码之类的信息，后面检索结果回显时会很有用。
console.log(docs[0].metadata)

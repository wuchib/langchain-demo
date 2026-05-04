/**
 * 通用文本：RecursiveCharacterTextSplitter
Markdown：MarkdownTextSplitter
代码：fromLanguage(...)
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

// 代码文档不要只按自然语言段落切。
// fromLanguage 会优先参考函数、代码块这些更像“代码边界”的位置。
const splitter = RecursiveCharacterTextSplitter.fromLanguage('js', {
  chunkSize: 1200,
  chunkOverlap: 150,
})

const chunks = await splitter.createDocuments([
  `function login() {
  // ...
}

function logout() {
  // ...
}`,
])

// 这样切出来的块，后面做代码类检索时通常更稳定。
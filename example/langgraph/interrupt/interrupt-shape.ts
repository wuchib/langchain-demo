import { interrupt } from '@langchain/langgraph'

// interrupt 接收一个参数：暂停时带出去的信息
// 这个信息会出现在调用方拿到的结果里，告诉调用方「为什么暂停了、需要什么输入」
const answer = interrupt('请确认是否继续')

// 当图被恢复时，interrupt() 的返回值就是调用方传入的回复
console.log(answer) // → 调用方恢复时传入的值
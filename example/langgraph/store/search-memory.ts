import { InMemoryStore } from '@langchain/langgraph'

const store = new InMemoryStore()
const namespace = ['users', 'user_001', 'memories']

await store.put(namespace, 'm1', {
  text: '用户偏好周末上午开会',
  kind: 'schedule-preference',
})

await store.put(namespace, 'm2', {
  text: '用户希望邮件语气尽量简短直接',
  kind: 'writing-preference',
})

// search 更像是在一组长期资料里找与当前问题有关的内容
const items = await store.search(namespace, {
  query: '会议时间偏好',
})

console.log(items.map(item => item.value.text))


/**
 * 这里有一点要讲清楚：search() 适合的是「资料多起来以后，再找相关内容」。如果你现在只是在读某一个固定 profile，那么 get() 会更直接。

也可以把这三个动作简单分一下：

get() 是按名字拿一条固定资料
put() 是把一条资料写进去
search() 是资料多起来以后，再按当前问题去找相关内容
 */
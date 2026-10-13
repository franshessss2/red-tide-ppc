import { test } from 'node:test'
import assert from 'node:assert/strict'
import { client, loadPosts, publish, REPOSITORY } from './community-discussions.mjs'

const categories = [{ id: 'test-announcements', name: 'Announcements' }, { id: 'test-ideas', name: 'Ideas' }]
const posts = [{ title: 'Synthetic welcome', category: 'Announcements', body: 'Synthetic body' }, { title: 'Synthetic ideas', category: 'Ideas', body: 'Synthetic body' }]
const base = { repository: REPOSITORY, ref: 'refs/heads/main', posts, log() {} }
function mock({ categoryList = categories, pages = [[]] } = {}) {
  const writes = []
  let page = 0
  const request = async (query, variables) => {
    if (query.includes('discussionCategories')) return { repository: { id: 'test-repo', discussionCategories: { nodes: categoryList, pageInfo: { hasNextPage: false } } } }
    if (query.startsWith('mutation')) {
      writes.push(variables.input)
      return { createDiscussion: { discussion: { id: 'test-created', url: `https://github.com/${REPOSITORY}/discussions/${9000 + writes.length}` } } }
    }
    const nodes = pages[page++]
    return { repository: { discussions: { nodes, pageInfo: { hasNextPage: page < pages.length, endCursor: `test-page-${page}` } } } }
  }
  return { request, writes }
}
const item = (post, categoryId) => ({ id: 'test-existing', title: post.title, category: { id: categoryId }, url: `https://github.com/${REPOSITORY}/discussions/8999` })

test('real manifest has two non-empty bodies in the intended categories', async () => {
  const actual = await loadPosts()
  assert.deepEqual(actual.map(post => post.category), ['Announcements', 'Ideas'])
  assert.ok(actual.every(post => post.body.length > 100))
})
test('forks and non-main refs fail before any API request', async () => {
  const request = () => { throw new Error('API must not be called') }
  await assert.rejects(publish({ ...base, repository: 'test-owner/test-fork', request }), /restricted/)
  await assert.rejects(publish({ ...base, ref: 'refs/pull/103/merge', request }), /restricted/)
})
test('fresh setup creates only the two intended posts with exact bodies and categories', async () => {
  const f = mock()
  const urls = await publish({ ...base, request: f.request })
  assert.equal(urls.length, 2)
  assert.deepEqual(f.writes, posts.map((post, i) => ({ repositoryId: 'test-repo', categoryId: categories[i].id, title: post.title, body: post.body })))
})
test('pagination finds later existing posts and a rerun makes no writes', async () => {
  const f = mock({ pages: [[], [item(posts[0], categories[0].id), item(posts[1], categories[1].id)]] })
  assert.equal((await publish({ ...base, request: f.request })).length, 2)
  assert.deepEqual(f.writes, [])
})
test('missing categories and ambiguous existing posts fail before any write', async () => {
  const missing = mock({ categoryList: categories.slice(0, 1) })
  await assert.rejects(publish({ ...base, request: missing.request }), /category/)
  assert.deepEqual(missing.writes, [])
  const duplicate = item(posts[1], categories[1].id)
  const ambiguous = mock({ pages: [[duplicate, duplicate]] })
  await assert.rejects(publish({ ...base, request: ambiguous.request }), /Multiple/)
  assert.deepEqual(ambiguous.writes, [])
})
test('API failure is explicit without exposing raw error bodies or credentials', async () => {
  const token = 'synthetic-test-only-token'
  const denied = client(token, async () => ({ ok: false, status: 403, json: () => { throw new Error(token) } }))
  await assert.rejects(denied('query', {}), error => error.message.includes('403') && !error.message.includes(token))
  const graphql = client(token, async () => ({ ok: true, json: async () => ({ errors: [{ message: token }] }) }))
  await assert.rejects(graphql('query', {}), error => /permissions/.test(error.message) && !error.message.includes(token))
})

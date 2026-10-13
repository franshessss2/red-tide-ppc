import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const REPOSITORY = 'franshessss2/red-tide-ppc'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function loadPosts() {
  const folder = path.join(root, 'docs/community/discussions')
  const entries = JSON.parse(await fs.readFile(path.join(folder, 'posts.json'), 'utf8'))
  if (!Array.isArray(entries) || entries.length !== 2) throw new Error('Expected exactly two starter discussions.')
  const titles = new Set()
  return Promise.all(entries.map(async entry => {
    if (!entry.title?.trim() || !['Announcements', 'Ideas'].includes(entry.category) ||
        !/^[a-z-]+\.md$/.test(entry.file) || titles.has(entry.title)) throw new Error('Invalid or duplicate starter discussion.')
    titles.add(entry.title)
    const body = await fs.readFile(path.join(folder, entry.file), 'utf8')
    if (!body.trim() || body.length > 60000) throw new Error('Starter body is empty or too long.')
    return { title: entry.title, category: entry.category, body }
  }))
}

export function client(token, fetcher = fetch) {
  if (!token) throw new Error('GITHUB_TOKEN is required for publication.')
  return async (query, variables) => {
    const response = await fetcher('https://api.github.com/graphql', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15000),
    })
    // Never print requests, token values or raw API error bodies.
    if (!response.ok) throw new Error(`GitHub GraphQL request failed (HTTP ${response.status}).`)
    const payload = await response.json()
    if (payload.errors?.length || !payload.data) throw new Error('GitHub GraphQL returned an error. Check repository Discussions and workflow permissions.')
    return payload.data
  }
}

export async function publish({ repository, ref, request, posts, log = console.log }) {
  // Guard in code as well as YAML: never publish from a fork or a non-main ref.
  if (repository !== REPOSITORY || ref !== 'refs/heads/main') throw new Error('Publication is restricted to franshessss2/red-tide-ppc main.')
  const [owner, name] = repository.split('/')
  const metadata = await request(`query($owner:String!,$name:String!){repository(owner:$owner,name:$name){id discussionCategories(first:100){nodes{id name} pageInfo{hasNextPage}}}}`, { owner, name })
  const repo = metadata.repository
  if (!repo?.id || repo.discussionCategories.pageInfo.hasNextPage) throw new Error('Repository or complete category list unavailable.')
  const categories = repo.discussionCategories.nodes
  // Validate every category before making any write.
  const prepared = posts.map(post => {
    const matches = categories.filter(category => category.name === post.category)
    if (matches.length !== 1) throw new Error(`Expected one existing category named ${post.category}.`)
    return { ...post, categoryId: matches[0].id }
  })
  const existing = []
  let cursor = null
  do {
    const page = await request(`query($owner:String!,$name:String!,$cursor:String){repository(owner:$owner,name:$name){discussions(first:100,after:$cursor){nodes{id title url category{id}} pageInfo{hasNextPage endCursor}}}}`, { owner, name, cursor })
    const connection = page.repository?.discussions
    if (!connection) throw new Error('Discussion list unavailable.')
    existing.push(...connection.nodes)
    const next = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null
    if (connection.pageInfo.hasNextPage && (!next || next === cursor)) throw new Error('Invalid Discussion pagination cursor.')
    cursor = next
  } while (cursor)
  const decisions = prepared.map(post => {
    const matches = existing.filter(item => item.title === post.title && item.category.id === post.categoryId)
    if (matches.length > 1) throw new Error(`Multiple existing discussions match ${post.title}; inspect them before rerunning.`)
    return { post, existing: matches[0] }
  })
  const published = []
  for (const decision of decisions) {
    if (decision.existing) {
      log(`Preserved existing: ${decision.existing.url}`)
      published.push(decision.existing.url)
      continue
    }
    const { post } = decision
    const result = await request(`mutation($input:CreateDiscussionInput!){createDiscussion(input:$input){discussion{id url}}}`, {
      input: { repositoryId: repo.id, categoryId: post.categoryId, title: post.title, body: post.body },
    })
    const url = result.createDiscussion?.discussion?.url
    if (!url?.startsWith(`https://github.com/${REPOSITORY}/discussions/`)) throw new Error('Created Discussion URL unavailable or unexpected. Check GitHub before retrying.')
    log(`Created: ${url}`)
    published.push(url)
  }
  return published
}

async function main() {
  const posts = await loadPosts()
  if (process.argv.includes('--check')) {
    console.log(`Checked ${posts.length} starter Discussion sources.`)
    return
  }
  await publish({ repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF,
    request: client(process.env.GITHUB_TOKEN), posts })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}

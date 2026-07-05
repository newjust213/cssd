import { firebaseEnabled, loadRemote, saveRemote } from './firebase'

const KEY = 'cssd-progress-v1'

const EMPTY = {
  plan: {},        // { taskId: true }
  quiz: {},        // { qid: { correct, wrong, last } }
  wrong: {},       // { qid: true }  오답노트
  cards: {},       // { cardId: { level, due, last } }
  exams: [],       // [{ ts, excel, access, note }] 모의고사 기록
  updatedAt: 0,
}

let state = load()
let currentUid = null
let saveTimer = null
const listeners = new Set()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY }
  } catch {
    return { ...EMPTY }
  }
}

export function getProgress() {
  return state
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function emit() {
  listeners.forEach((fn) => fn())
}

export function update(mutator) {
  const next = structuredClone(state)
  mutator(next)
  next.updatedAt = Date.now()
  state = next
  localStorage.setItem(KEY, JSON.stringify(state))
  if (firebaseEnabled && currentUid) {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveRemote(currentUid, state).catch(console.error), 1500)
  }
  emit()
}

// 로그인 시: 원격/로컬 진도 병합 (많은 정보 우선)
export async function syncOnLogin(uid) {
  currentUid = uid
  const remote = await loadRemote(uid)
  if (remote) {
    state = mergeProgress(state, remote)
    localStorage.setItem(KEY, JSON.stringify(state))
    emit()
  }
  await saveRemote(uid, state)
}

export function clearUid() {
  currentUid = null
}

function mergeProgress(a, b) {
  const out = structuredClone(EMPTY)
  out.plan = { ...a.plan, ...b.plan }
  out.wrong = { ...a.wrong, ...b.wrong }
  const qids = new Set([...Object.keys(a.quiz), ...Object.keys(b.quiz)])
  for (const q of qids) {
    const x = a.quiz[q], y = b.quiz[q]
    out.quiz[q] = !x ? y : !y ? x : (x.last >= y.last ? x : y)
  }
  const cids = new Set([...Object.keys(a.cards), ...Object.keys(b.cards)])
  for (const c of cids) {
    const x = a.cards[c], y = b.cards[c]
    out.cards[c] = !x ? y : !y ? x : (x.last >= y.last ? x : y)
  }
  // 모의고사 기록: ts 기준 합집합
  const byTs = new Map()
  for (const e of [...(a.exams || []), ...(b.exams || [])]) byTs.set(e.ts, e)
  out.exams = [...byTs.values()].sort((x, y) => x.ts - y.ts)
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0)
  return out
}

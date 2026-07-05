import { firebaseConfig } from './firebase-config'

export const firebaseEnabled = !!firebaseConfig

let readyPromise = null

// firebase 패키지는 config가 있을 때만 동적 로드 (로컬 모드에서 번들 낭비 없음)
function ready() {
  if (!firebaseEnabled) return Promise.resolve(null)
  if (!readyPromise) {
    readyPromise = (async () => {
      const { initializeApp } = await import('firebase/app')
      const authMod = await import('firebase/auth')
      const fsMod = await import('firebase/firestore')
      const app = initializeApp(firebaseConfig)
      const auth = authMod.getAuth(app)
      const db = fsMod.getFirestore(app)
      return { auth, db, authMod, fsMod }
    })()
  }
  return readyPromise
}

export function watchAuth(callback) {
  let unsub = () => {}
  if (!firebaseEnabled) {
    callback(null)
    return () => {}
  }
  ready().then((ctx) => {
    unsub = ctx.authMod.onAuthStateChanged(ctx.auth, callback)
  })
  return () => unsub()
}

export async function signIn() {
  const ctx = await ready()
  if (!ctx) return null
  const provider = new ctx.authMod.GoogleAuthProvider()
  const result = await ctx.authMod.signInWithPopup(ctx.auth, provider)
  return result.user
}

export async function signOutUser() {
  const ctx = await ready()
  if (ctx) await ctx.authMod.signOut(ctx.auth)
}

export async function loadRemote(uid) {
  const ctx = await ready()
  if (!ctx) return null
  const snap = await ctx.fsMod.getDoc(ctx.fsMod.doc(ctx.db, 'users', uid, 'data', 'progress'))
  return snap.exists() ? snap.data() : null
}

export async function saveRemote(uid, data) {
  const ctx = await ready()
  if (!ctx) return
  await ctx.fsMod.setDoc(ctx.fsMod.doc(ctx.db, 'users', uid, 'data', 'progress'), data)
}

import { useSyncExternalStore } from 'react'
import { subscribe, getProgress } from './store'

export function useProgress() {
  return useSyncExternalStore(subscribe, getProgress)
}

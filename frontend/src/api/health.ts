import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_URL } from './client'

export type HealthStatus = 'checking' | 'warming_up' | 'ready' | 'error'

export interface HealthState {
  status: HealthStatus
  attempts: number
  startedAt: number
  readyAt?: number
  error?: string
}

type HealthListener = (state: HealthState) => void

let currentState: HealthState = {
  status: 'checking',
  attempts: 0,
  startedAt: typeof Date !== 'undefined' ? Date.now() : 0,
}

const listeners = new Set<HealthListener>()

function notify() {
  listeners.forEach((fn) => fn(currentState))
}

let healthPromise: Promise<boolean> | null = null

export function getHealthState(): HealthState {
  return currentState
}

export function subscribeHealth(listener: HealthListener): () => void {
  listeners.add(listener)
  listener(currentState)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Pings /health on the backend with automatic retry loop up to maxWaitMs (default 5 minutes / 300,000ms).
 */
export function startHealthCheck(maxWaitMs = 300_000): Promise<boolean> {
  if (healthPromise) {
    return healthPromise
  }

  const startTime = Date.now()
  currentState = {
    status: 'checking',
    attempts: 0,
    startedAt: startTime,
  }
  notify()

  healthPromise = new Promise<boolean>((resolve) => {
    let attempt = 0

    const check = async () => {
      attempt++
      currentState.attempts = attempt

      // After 3 seconds of checking without response, transition to warming_up status
      if (Date.now() - startTime > 3000 && currentState.status === 'checking') {
        currentState.status = 'warming_up'
        notify()
      }

      try {
        const res = await axios.get(`${API_URL}/health`, {
          timeout: 10_000,
          headers: { 'Cache-Control': 'no-cache' },
        })

        if (res.status === 200 && res.data?.status === 'ok') {
          currentState = {
            status: 'ready',
            attempts: attempt,
            startedAt: startTime,
            readyAt: Date.now(),
          }
          notify()
          resolve(true)
          return
        }
      } catch {
        // Network error / timeout / cold start waiting
      }

      // If max timeout (5 minutes) reached, abort with error
      if (Date.now() - startTime >= maxWaitMs) {
        currentState = {
          status: 'error',
          attempts: attempt,
          startedAt: startTime,
          error: 'Backend did not respond within 5 minutes. Please check server hosting.',
        }
        notify()
        resolve(false)
        return
      }

      currentState.status = 'warming_up'
      notify()

      // Retry every 3 seconds
      setTimeout(check, 3000)
    }

    check()
  })

  return healthPromise
}

/**
 * Returns a promise that resolves when the backend health check confirms it is ready (up to 5 mins).
 */
export async function waitForBackendReady(timeoutMs = 300_000): Promise<boolean> {
  if (currentState.status === 'ready') {
    return true
  }
  return startHealthCheck(timeoutMs)
}

/**
 * React hook to observe real-time health check state.
 */
export function useBackendHealth(): HealthState {
  const [state, setState] = useState<HealthState>(getHealthState)

  useEffect(() => {
    return subscribeHealth(setState)
  }, [])

  return state
}

// Automatically trigger health check as soon as this module is loaded on website open
if (typeof window !== 'undefined') {
  startHealthCheck()
}


'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { getSocket, disconnectSocket } from './socket'
import type { Socket } from 'socket.io-client'

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export function useSocket() {
  const [status, setStatus] = useState<SocketStatus>('idle')
  const socketRef = useRef<Socket | null>(null)

  const connect = useCallback(() => {
    const s = getSocket()
    socketRef.current = s

    if (s.connected) {
      setStatus('connected')
      return s
    }

    setStatus('connecting')

    s.on('connect', () => {
      setStatus('connected')
    })

    s.on('disconnect', () => {
      setStatus('idle')
    })

    s.on('reconnect_attempt', () => {
      setStatus('reconnecting')
    })

    s.on('connect_error', () => {
      setStatus('error')
    })

    s.connect()
    return s
  }, [])

  const disconnect = useCallback(() => {
    disconnectSocket()
    socketRef.current = null
    setStatus('idle')
  }, [])

  return {
    getSocketInstance: () => socketRef.current || getSocket(),
    status,
    connect,
    disconnect,
  }
}

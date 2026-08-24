'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { voiceChatService, VoiceUser } from './voice-chat-service'
import { useAuth } from './auth-context'

interface VoiceContextValue {
  isInVoice: boolean
  isMuted: boolean
  isDeafened: boolean
  isListenerOnly: boolean
  hasMicPermission: boolean | null
  activeParticipants: string[]
  isSpeakingMap: Record<string, boolean>
  mutedUsers: Record<string, boolean>
  userVolumes: Record<string, number>
  activeRoomCode: string | null
  joinVoiceRoom: (roomCode: string, targetFriendUids?: string[]) => Promise<void>
  leaveVoiceRoom: (stopHardwareMic?: boolean) => void
  toggleMute: () => boolean
  toggleDeafen: () => boolean
  enableMicrophone: () => Promise<{ success: boolean; reason?: 'insecure_context' | 'denied' | 'unsupported' }>
  muteUser: (uid: string, muted: boolean) => void
  setUserVolume: (uid: string, volume: number) => void
}

const VoiceContext = createContext<VoiceContextValue | null>(null)

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null)
  const [voiceState, setVoiceState] = useState({
    isInVoice: false,
    isMuted: false,
    isDeafened: false,
    isListenerOnly: true,
    hasMicPermission: null as boolean | null,
    activeParticipants: [] as string[],
    isSpeakingMap: {} as Record<string, boolean>,
    mutedUsers: {} as Record<string, boolean>,
    userVolumes: {} as Record<string, number>
  })

  useEffect(() => {
    const unsub = voiceChatService.subscribe((state) => {
      setVoiceState(state)
    })
    return () => unsub()
  }, [])

  const joinVoiceRoom = useCallback(async (roomCode: string, targetFriendUids: string[] = []) => {
    if (!roomCode) return
    const localUser: VoiceUser = {
      uid: user?.uid || `guest_${Math.floor(Math.random() * 10000)}`,
      name: user?.nickname || user?.displayName || 'Jugador'
    }
    setActiveRoomCode(roomCode)
    await voiceChatService.joinRoom(roomCode, localUser, targetFriendUids)
  }, [user])

  const leaveVoiceRoom = useCallback((stopHardwareMic = false) => {
    setActiveRoomCode(null)
    voiceChatService.leaveRoom(stopHardwareMic)
  }, [])

  const toggleMute = useCallback(() => {
    return voiceChatService.toggleMute()
  }, [])

  const toggleDeafen = useCallback(() => {
    return voiceChatService.toggleDeafen()
  }, [])

  const enableMicrophone = useCallback(async () => {
    return await voiceChatService.enableMicrophone()
  }, [])

  const muteUser = useCallback((uid: string, muted: boolean) => {
    voiceChatService.muteUser(uid, muted)
  }, [])

  const setUserVolume = useCallback((uid: string, volume: number) => {
    voiceChatService.setUserVolume(uid, volume)
  }, [])

  const value = useMemo<VoiceContextValue>(() => ({
    ...voiceState,
    activeRoomCode,
    joinVoiceRoom,
    leaveVoiceRoom,
    toggleMute,
    toggleDeafen,
    enableMicrophone,
    muteUser,
    setUserVolume
  }), [voiceState, activeRoomCode, joinVoiceRoom, leaveVoiceRoom, toggleMute, toggleDeafen, enableMicrophone, muteUser, setUserVolume])

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoiceChat() {
  const context = useContext(VoiceContext)
  if (!context) {
    throw new Error('useVoiceChat must be used within a VoiceProvider')
  }
  return context
}

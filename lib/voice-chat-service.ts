// -----------------------------------------------------------------------------
// Sugar Ludo - Professional WebRTC Full-Mesh Voice Chat Service ($0.00 Cost)
// Provides HD Opus Audio, real-time speaking detection (AnalyserNode),
// non-blocking Listen-Only fallback with bidirectional transceivers for 2-6 friends.
// -----------------------------------------------------------------------------

import { sendP2PData, subscribeToP2PData } from './friends-service'
import { globalLogger } from './logger'

export interface VoiceUser {
  uid: string
  name: string
}

export type VoiceStateListener = (state: {
  isInVoice: boolean
  isMuted: boolean
  isDeafened: boolean
  isListenerOnly: boolean
  hasMicPermission: boolean | null
  activeParticipants: string[]
  isSpeakingMap: Record<string, boolean>
  mutedUsers: Record<string, boolean>
}) => void

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
}

class VoiceChatService {
  private static instance: VoiceChatService
  private localStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private localAnalyser: AnalyserNode | null = null
  private peerConnections = new Map<string, RTCPeerConnection>()
  private remoteStreams = new Map<string, MediaStream>()
  private remoteAudioElements = new Map<string, HTMLAudioElement>()
  private remoteAnalysers = new Map<string, AnalyserNode>()
  private userVolumes = new Map<string, number>()
  private mutedUsers = new Set<string>()

  private currentRoomCode: string | null = null
  private localUser: VoiceUser | null = null
  private isMuted: boolean = false
  private isDeafened: boolean = false
  private isListenerOnly: boolean = true
  private hasMicPermission: boolean | null = null
  private activeParticipants = new Set<string>()
  private speakingMap: Record<string, boolean> = {}

  private listeners = new Set<VoiceStateListener>()
  private p2pUnsub: (() => void) | null = null
  private analyserInterval: any = null

  private constructor() {}

  public static getInstance(): VoiceChatService {
    if (!VoiceChatService.instance) {
      VoiceChatService.instance = new VoiceChatService()
    }
    return VoiceChatService.instance
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener)
    this.notify()
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    const state = {
      isInVoice: this.currentRoomCode !== null,
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      isListenerOnly: this.isListenerOnly,
      hasMicPermission: this.hasMicPermission,
      activeParticipants: Array.from(this.activeParticipants),
      isSpeakingMap: { ...this.speakingMap },
      mutedUsers: Object.fromEntries(Array.from(this.mutedUsers).map(u => [u, true]))
    }
    this.listeners.forEach(cb => {
      try { cb(state) } catch {}
    })
  }

  /**
   * Initializes or re-attaches to a voice room for friends
   */
  public async joinRoom(roomCode: string, user: VoiceUser, targetFriendUids: string[] = []) {
    // If already in this room, synchronize any new participants directly
    if (this.currentRoomCode === roomCode) {
      globalLogger.log('SYSTEM', `[VoiceChat] Sincronizando participantes para sala de voz: ${roomCode}`)
      this.syncParticipants(targetFriendUids)
      return
    }

    // Leave any previous room
    if (this.currentRoomCode && this.currentRoomCode !== roomCode) {
      this.leaveRoom()
    }

    this.currentRoomCode = roomCode
    this.localUser = user
    this.initAudioContext()

    // Listen to P2P Voice Signaling
    this.p2pUnsub = subscribeToP2PData((data) => {
      if (!data || typeof data !== 'object' || data.roomCode !== this.currentRoomCode) return
      if (data.type?.startsWith('voice_')) {
        this.handleSignalingMessage(data)
      }
    })

    // Try background stream only if permission was previously granted
    if (this.hasMicPermission === true) {
      await this.initLocalStream()
    } else {
      this.isListenerOnly = true
    }

    // Announce presence in voice room and start WebRTC offers with target peers
    this.syncParticipants(targetFriendUids)

    this.startSpeakingDetection()
    this.notify()
  }

  public syncParticipants(uids: string[]) {
    uids.forEach(uid => {
      if (uid && uid !== this.localUser?.uid) {
        this.activeParticipants.add(uid)

        // If no active WebRTC peer connection exists yet with this friend, initiate negotiation
        if (!this.peerConnections.has(uid) && this.currentRoomCode && this.localUser) {
          sendP2PData(uid, {
            type: 'voice_join',
            senderUid: this.localUser.uid,
            senderName: this.localUser.name,
            roomCode: this.currentRoomCode
          })
          this.createPeerConnectionAndOffer(uid)
        }
      }
    })
  }

  public initAudioContext() {
    try {
      if (!this.audioContext && typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass()
        }
      }
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {})
      }
    } catch (e) {
      console.warn('[VoiceChat] AudioContext init error:', e)
    }
  }

  /**
   * Explicit user interaction trigger for requesting microphone permissions (Mobile / Gesture safe)
   */
  public async enableMicrophone(): Promise<{ success: boolean; reason?: 'insecure_context' | 'denied' | 'unsupported' }> {
    try {
      this.initAudioContext()
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume().catch(() => {})
      }

      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' || 
        window.location.protocol === 'https:'
      )

      if (typeof window !== 'undefined' && !window.isSecureContext && !isLocalhost) {
        globalLogger.log('SYSTEM', `[VoiceChat] Micrófono bloqueado por el navegador: se requiere HTTPS en accesos remotos/LAN.`)
        return { success: false, reason: 'insecure_context' }
      }

      let stream: MediaStream | null = null

      if (navigator?.mediaDevices?.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        })
      } else if ((navigator as any)?.getUserMedia) {
        stream = await new Promise((resolve, reject) => {
          (navigator as any).getUserMedia({ audio: true, video: false }, resolve, reject)
        })
      } else if ((navigator as any)?.webkitGetUserMedia) {
        stream = await new Promise((resolve, reject) => {
          (navigator as any).webkitGetUserMedia({ audio: true, video: false }, resolve, reject)
        })
      }

      if (!stream) {
        throw new Error('No se pudo inicializar la captura de audio')
      }

      this.localStream = stream
      this.hasMicPermission = true
      this.isListenerOnly = false
      this.isMuted = false

      // Setup local audio analyzer for speaking detection
      if (this.audioContext) {
        try {
          const source = this.audioContext.createMediaStreamSource(stream)
          this.localAnalyser = this.audioContext.createAnalyser()
          this.localAnalyser.fftSize = 256
          this.localAnalyser.smoothingTimeConstant = 0.4
          source.connect(this.localAnalyser)
        } catch {}
      }

      // Hot-replace or add audio track on all existing WebRTC peer connections
      const audioTrack = stream.getAudioTracks()[0]
      if (audioTrack) {
        for (const [peerUid, pc] of this.peerConnections.entries()) {
          const senders = pc.getSenders()
          const audioSender = senders.find(s => s.track?.kind === 'audio' || !s.track)
          if (audioSender) {
            audioSender.replaceTrack(audioTrack).catch(() => {})
          } else {
            pc.addTrack(audioTrack, stream)
            this.createPeerConnectionAndOffer(peerUid)
          }
        }
      }

      this.startSpeakingDetection()
      this.notify()
      globalLogger.log('SYSTEM', `[VoiceChat] Micrófono habilitado por el usuario con éxito`)
      return { success: true }
    } catch (err: any) {
      console.warn('[VoiceChat] Permiso de micrófono denegado o no disponible:', err)
      this.hasMicPermission = false
      this.isListenerOnly = true
      this.notify()
      return { success: false, reason: 'denied' }
    }
  }

  private async initLocalStream() {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      })

      this.localStream = stream
      this.hasMicPermission = true
      this.isListenerOnly = false

      if (this.audioContext) {
        try {
          const source = this.audioContext.createMediaStreamSource(stream)
          this.localAnalyser = this.audioContext.createAnalyser()
          this.localAnalyser.fftSize = 256
          this.localAnalyser.smoothingTimeConstant = 0.4
          source.connect(this.localAnalyser)
        } catch {}
      }
    } catch (err: any) {
      this.isListenerOnly = true
      this.localStream = null
    }
  }

  /**
   * Signaling message dispatcher
   */
  private async handleSignalingMessage(data: any) {
    const fromUid = data.senderUid
    if (!fromUid || fromUid === this.localUser?.uid) return

    this.activeParticipants.add(fromUid)

    switch (data.type) {
      case 'voice_join': {
        // When a friend announces presence, initiate WebRTC offer immediately
        this.createPeerConnectionAndOffer(fromUid)
        break
      }
      case 'voice_offer': {
        await this.handleOffer(fromUid, data.sdp)
        break
      }
      case 'voice_answer': {
        await this.handleAnswer(fromUid, data.sdp)
        break
      }
      case 'voice_ice': {
        await this.handleCandidate(fromUid, data.candidate)
        break
      }
      case 'voice_speaking': {
        this.speakingMap[fromUid] = !!data.isSpeaking
        this.notify()
        break
      }
      case 'voice_leave': {
        this.cleanupPeer(fromUid)
        this.activeParticipants.delete(fromUid)
        delete this.speakingMap[fromUid]
        this.notify()
        break
      }
    }
  }

  private getOrCreatePeerConnection(peerUid: string): RTCPeerConnection {
    let pc = this.peerConnections.get(peerUid)
    if (pc && pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
      return pc
    }

    pc = new RTCPeerConnection(RTC_CONFIG)
    this.peerConnections.set(peerUid, pc)

    // Add local tracks if available, OR add transceiver in recvonly mode to guarantee incoming audio
    if (this.localStream && this.localStream.getAudioTracks().length > 0) {
      this.localStream.getTracks().forEach(track => {
        pc!.addTrack(track, this.localStream!)
      })
    } else {
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' })
      } catch {}
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentRoomCode && this.localUser) {
        sendP2PData(peerUid, {
          type: 'voice_ice',
          senderUid: this.localUser.uid,
          roomCode: this.currentRoomCode,
          candidate: event.candidate
        })
      }
    }

    // Remote Track Handler
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      if (remoteStream) {
        this.handleRemoteStream(peerUid, remoteStream)
      } else if (event.track) {
        const stream = new MediaStream([event.track])
        this.handleRemoteStream(peerUid, stream)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'disconnected' || pc?.connectionState === 'failed') {
        this.cleanupPeer(peerUid)
      }
    }

    return pc
  }

  private handleRemoteStream(peerUid: string, stream: MediaStream) {
    this.remoteStreams.set(peerUid, stream)

    // Audio Element for playback
    let audioEl = this.remoteAudioElements.get(peerUid)
    if (!audioEl && typeof document !== 'undefined') {
      audioEl = document.createElement('audio')
      audioEl.autoplay = true
      audioEl.playsInline = true
      audioEl.style.display = 'none'
      document.body.appendChild(audioEl)
      this.remoteAudioElements.set(peerUid, audioEl)
    }

    if (audioEl) {
      audioEl.srcObject = stream
      audioEl.muted = this.isDeafened || this.mutedUsers.has(peerUid)
      audioEl.volume = this.userVolumes.get(peerUid) ?? 1.0

      const playAudio = () => {
        audioEl?.play().catch(() => {
          const unlock = () => {
            audioEl?.play().catch(() => {})
            window.removeEventListener('click', unlock)
            window.removeEventListener('touchstart', unlock)
          }
          window.addEventListener('click', unlock, { once: true })
          window.addEventListener('touchstart', unlock, { once: true })
        })
      }
      playAudio()
    }

    // Setup remote analyzer for speaking indicator
    if (this.audioContext) {
      try {
        const source = this.audioContext.createMediaStreamSource(stream)
        const analyser = this.audioContext.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.4
        source.connect(analyser)
        this.remoteAnalysers.set(peerUid, analyser)
      } catch {}
    }
  }

  private async createPeerConnectionAndOffer(peerUid: string) {
    try {
      const pc = this.getOrCreatePeerConnection(peerUid)
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
      })
      await pc.setLocalDescription(offer)

      if (this.currentRoomCode && this.localUser) {
        sendP2PData(peerUid, {
          type: 'voice_offer',
          senderUid: this.localUser.uid,
          roomCode: this.currentRoomCode,
          sdp: offer
        })
      }
    } catch (e) {
      console.warn('[VoiceChat] Error creating offer for', peerUid, e)
    }
  }

  private async handleOffer(fromUid: string, sdp: RTCSessionDescriptionInit) {
    try {
      const pc = this.getOrCreatePeerConnection(fromUid)
      await pc.setRemoteDescription(new RTCSessionDescription(sdp))

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      if (this.currentRoomCode && this.localUser) {
        sendP2PData(fromUid, {
          type: 'voice_answer',
          senderUid: this.localUser.uid,
          roomCode: this.currentRoomCode,
          sdp: answer
        })
      }
    } catch (e) {
      console.warn('[VoiceChat] Error handling offer from', fromUid, e)
    }
  }

  private async handleAnswer(fromUid: string, sdp: RTCSessionDescriptionInit) {
    try {
      const pc = this.peerConnections.get(fromUid)
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      }
    } catch (e) {
      console.warn('[VoiceChat] Error handling answer from', fromUid, e)
    }
  }

  private async handleCandidate(fromUid: string, candidate: RTCIceCandidateInit) {
    try {
      const pc = this.peerConnections.get(fromUid)
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      }
    } catch {}
  }

  private startSpeakingDetection() {
    if (this.analyserInterval) clearInterval(this.analyserInterval)

    const buffer = new Uint8Array(128)

    this.analyserInterval = setInterval(() => {
      let changed = false

      // 1. Check local microphone speaking level
      if (this.localAnalyser && !this.isMuted && !this.isListenerOnly && this.localUser) {
        this.localAnalyser.getByteFrequencyData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i++) sum += buffer[i]
        const avg = sum / buffer.length
        const isSpeakingNow = avg > 14

        if (this.speakingMap[this.localUser.uid] !== isSpeakingNow) {
          this.speakingMap[this.localUser.uid] = isSpeakingNow
          changed = true

          // Broadcast speaking state
          this.broadcastSignal({
            type: 'voice_speaking',
            senderUid: this.localUser.uid,
            roomCode: this.currentRoomCode,
            isSpeaking: isSpeakingNow
          })
        }
      } else if (this.localUser && this.speakingMap[this.localUser.uid]) {
        this.speakingMap[this.localUser.uid] = false
        changed = true
      }

      // 2. Check remote peers speaking levels
      this.remoteAnalysers.forEach((analyser, peerUid) => {
        if (this.mutedUsers.has(peerUid) || this.isDeafened) {
          if (this.speakingMap[peerUid]) {
            this.speakingMap[peerUid] = false
            changed = true
          }
          return
        }

        analyser.getByteFrequencyData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i++) sum += buffer[i]
        const avg = sum / buffer.length
        const isSpeaking = avg > 12

        if (this.speakingMap[peerUid] !== isSpeaking) {
          this.speakingMap[peerUid] = isSpeaking
          changed = true
        }
      })

      if (changed) {
        this.notify()
      }
    }, 120)
  }

  private broadcastSignal(payload: any, specificUids?: string[]) {
    const targets = specificUids || Array.from(this.activeParticipants)
    targets.forEach(uid => {
      if (uid !== this.localUser?.uid) {
        sendP2PData(uid, payload)
      }
    })
  }

  /**
   * UI Controls
   */
  public toggleMute(): boolean {
    if (this.isListenerOnly || !this.localStream) {
      this.enableMicrophone()
      return false
    }

    this.isMuted = !this.isMuted

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted
      })
    }

    if (this.localUser) {
      this.speakingMap[this.localUser.uid] = false
    }

    this.notify()
    return this.isMuted
  }

  public toggleDeafen(): boolean {
    this.isDeafened = !this.isDeafened

    this.remoteAudioElements.forEach((audio, uid) => {
      audio.muted = this.isDeafened || this.mutedUsers.has(uid)
    })

    this.notify()
    return this.isDeafened
  }

  public muteUser(uid: string, muted: boolean) {
    if (muted) {
      this.mutedUsers.add(uid)
    } else {
      this.mutedUsers.delete(uid)
    }

    const audio = this.remoteAudioElements.get(uid)
    if (audio) {
      audio.muted = this.isDeafened || muted
    }

    this.notify()
  }

  public setUserVolume(uid: string, volume: number) {
    const clamped = Math.max(0, Math.min(1, volume))
    this.userVolumes.set(uid, clamped)

    const audio = this.remoteAudioElements.get(uid)
    if (audio) {
      audio.volume = clamped
    }
  }

  private cleanupPeer(peerUid: string) {
    const pc = this.peerConnections.get(peerUid)
    if (pc) {
      try { pc.close() } catch {}
      this.peerConnections.delete(peerUid)
    }

    const audio = this.remoteAudioElements.get(peerUid)
    if (audio) {
      audio.pause()
      audio.srcObject = null
      try { audio.remove() } catch {}
      this.remoteAudioElements.delete(peerUid)
    }

    this.remoteStreams.delete(peerUid)
    this.remoteAnalysers.delete(peerUid)
  }

  public leaveRoom() {
    if (!this.currentRoomCode) return

    if (this.localUser) {
      this.broadcastSignal({
        type: 'voice_leave',
        senderUid: this.localUser.uid,
        roomCode: this.currentRoomCode
      })
    }

    if (this.analyserInterval) {
      clearInterval(this.analyserInterval)
      this.analyserInterval = null
    }

    if (this.p2pUnsub) {
      this.p2pUnsub()
      this.p2pUnsub = null
    }

    this.peerConnections.forEach((pc) => {
      try { pc.close() } catch {}
    })
    this.peerConnections.clear()

    this.remoteAudioElements.forEach((audio) => {
      audio.pause()
      audio.srcObject = null
      try { audio.remove() } catch {}
    })
    this.remoteAudioElements.clear()
    this.remoteStreams.clear()
    this.remoteAnalysers.clear()

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop())
      this.localStream = null
    }

    this.currentRoomCode = null
    this.activeParticipants.clear()
    this.speakingMap = {}
    this.isMuted = false
    this.isDeafened = false
    this.isListenerOnly = true

    this.notify()
    globalLogger.log('SYSTEM', `[VoiceChat] Sala de voz cerrada con éxito.`)
  }
}

export const voiceChatService = VoiceChatService.getInstance()

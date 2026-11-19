import { joinRoom } from 'trystero'
import type { BattleFormat } from '../store/teamStore'
type SignalMsg = {
    type: string
    payload: string
}
const APP_ID = 'pkmn-p2p-battle-v1'
const RTC_CONFIG: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
    ],
}
export function startRandomMatchmaking(
    format: BattleFormat,
    onMatched: (roomId: string) => void
) {
    const room = joinRoom({ appId: APP_ID, rtcConfig: RTC_CONFIG }, `lobby-${format}`)
    const selfReady = room.getSelf()
    const matchAction = room.makeAction<SignalMsg>('match')
    let done = false
    room.onPeerJoin(({ peerId }) => {
        void selfReady.then(({ peerId: myPeerId }) => {
            if (done) return
            if (myPeerId < peerId) {
                const code = `m${myPeerId.slice(0, 4)}${Math.random().toString(36).slice(2, 6)}`
                void matchAction.send({ type: 'INVITE', payload: code }, { target: peerId })
            }
        })
    })
    matchAction.onMessage((data, { peerId }) => {
        if (done) return
        if (data.type === 'INVITE' && data.payload) {
            done = true
            void matchAction.send({ type: 'ACCEPT', payload: data.payload }, { target: peerId })
            setTimeout(() => {
                void room.leave()
                onMatched(data.payload)
            }, 180)
        } else if (data.type === 'ACCEPT' && data.payload) {
            done = true
            void room.leave()
            onMatched(data.payload)
        }
    })
    return {
        cancel() {
            done = true
            void room.leave()
        },
    }
}
export interface P2PSessionCallbacks {
    onRoleAssigned: (role: 'p1' | 'p2') => void
    onGuestTeam: (guestPaste: string) => void
    onGuestChoice: (choice: string) => void
    onProtocol: (chunk: string) => void
    onOpponentLeft: () => void
    onFormatMismatch?: (peerFormat: string) => void
    onStatusChange?: (stage: 'connecting' | 'handshaking' | 'refreshing') => void
}
export interface P2PSession {
    sendProtocolToGuest: (chunk: string) => void
    sendChoiceToHost: (choice: string) => void
    reconnect: () => void
    leave: () => void
}
export function connectP2PRoom(
    roomId: string,
    format: BattleFormat,
    myTeamPaste: string,
    callbacks: P2PSessionCallbacks
): P2PSession {
    const cleanRoom = roomId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const roomKey = `pkmn-room-v3-${cleanRoom}`
    let opponentId = ''
    let isHost = false
    let handshakeDone = false
    let hostStarted = false
    let closed = false
    let mounting = false
    let mountSeq = 0
    let lastMountAt = 0
    let activeRoom: ReturnType<typeof joinRoom> | null = null
    let sendSignal: ((data: SignalMsg, target: string) => void) | null = null
    let helloTimer: ReturnType<typeof setInterval> | null = null
    let retryTimer: ReturnType<typeof setInterval> | null = null
    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    const clearHello = () => {
        if (helloTimer) {
            clearInterval(helloTimer)
            helloTimer = null
        }
    }
    const clearRetry = () => {
        if (retryTimer) {
            clearInterval(retryTimer)
            retryTimer = null
        }
    }
    const clearRefresh = () => {
        if (refreshTimer) {
            clearTimeout(refreshTimer)
            refreshTimer = null
        }
    }
    const clearAllTimers = () => {
        clearHello()
        clearRetry()
        clearRefresh()
    }
    const scheduleRefresh = () => {
        clearRefresh()
        if (closed || opponentId) return
        const delay = 22000 + Math.floor(Math.random() * 8000)
        refreshTimer = setTimeout(() => {
            if (!closed && !opponentId && document.visibilityState === 'visible') {
                void mountRoom(true)
            }
        }, delay)
    }
    const mountRoom = async (withCooldown: boolean) => {
        if (closed || opponentId || mounting) return
        mounting = true
        const seq = ++mountSeq
        try {
            if (activeRoom) {
                callbacks.onStatusChange?.('refreshing')
                const prev = activeRoom
                activeRoom = null
                sendSignal = null
                try {
                    await prev.leave()
                } catch {
                    void 0
                }
                if (closed || opponentId || seq !== mountSeq) return
                if (withCooldown) {
                    await new Promise((resolve) => setTimeout(resolve, 800))
                }
            }
            if (closed || opponentId || seq !== mountSeq) return
            lastMountAt = Date.now()
            callbacks.onStatusChange?.('connecting')
            const room = joinRoom({ appId: APP_ID, rtcConfig: RTC_CONFIG }, roomKey)
            activeRoom = room
            const selfReady = room.getSelf()
            const battleAction = room.makeAction<SignalMsg>('battle')
            const isCurrent = () => !closed && activeRoom === room
            sendSignal = (data: SignalMsg, target: string) => {
                if (isCurrent()) {
                    void battleAction.send(data, { target })
                }
            }
            const startHello = (peerId: string) => {
                void selfReady.then(({ peerId: myPeerId }) => {
                    if (!isCurrent() || opponentId) return
                    clearRefresh()
                    opponentId = peerId
                    isHost = myPeerId < peerId
                    callbacks.onStatusChange?.('handshaking')
                    const pushHello = () => {
                        if (isCurrent() && opponentId && !handshakeDone) {
                            sendSignal?.({ type: 'HELLO', payload: format }, opponentId)
                        }
                    }
                    pushHello()
                    helloTimer = setInterval(pushHello, 800)
                })
            }
            room.onPeerJoin(({ peerId }) => {
                startHello(peerId)
            })
            battleAction.onMessage((data, { peerId }) => {
                if (!isCurrent()) return
                if (data.type === 'HELLO') {
                    void selfReady.then(({ peerId: myPeerId }) => {
                        if (!isCurrent()) return
                        if (!opponentId && peerId) {
                            clearRefresh()
                            opponentId = peerId
                            isHost = myPeerId < peerId
                            callbacks.onStatusChange?.('handshaking')
                        }
                        if (peerId !== opponentId) return
                        if (data.payload !== format) {
                            clearAllTimers()
                            closed = true
                            document.removeEventListener('visibilitychange', onVisibilityChange)
                            callbacks.onFormatMismatch?.(data.payload)
                            void room.leave()
                            activeRoom = null
                            return
                        }
                        if (!handshakeDone) {
                            handshakeDone = true
                            clearHello()
                            sendSignal?.({ type: 'HELLO', payload: format }, opponentId)
                            callbacks.onRoleAssigned(isHost ? 'p1' : 'p2')
                            if (!isHost) {
                                const pushTeam = () => {
                                    if (isCurrent() && opponentId) {
                                        sendSignal?.({ type: 'TEAM', payload: myTeamPaste }, opponentId)
                                    }
                                }
                                pushTeam()
                                retryTimer = setInterval(pushTeam, 1000)
                            }
                        }
                    })
                } else if (isHost && data.type === 'TEAM' && !hostStarted) {
                    hostStarted = true
                    callbacks.onGuestTeam(data.payload)
                } else if (isHost && data.type === 'CHOICE') {
                    callbacks.onGuestChoice(data.payload)
                } else if (!isHost && data.type === 'PROTO') {
                    clearRetry()
                    callbacks.onProtocol(data.payload)
                } else if (data.type === 'LEAVE') {
                    clearAllTimers()
                    callbacks.onOpponentLeft()
                }
            })
            room.onPeerLeave(({ peerId }) => {
                if (isCurrent() && peerId === opponentId) {
                    clearAllTimers()
                    callbacks.onOpponentLeft()
                }
            })
            scheduleRefresh()
        } finally {
            mounting = false
        }
    }
    const onVisibilityChange = () => {
        if (document.visibilityState === 'visible' && !closed && !opponentId && !mounting) {
            if (Date.now() - lastMountAt >= 6000) {
                void mountRoom(true)
            }
        }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    void mountRoom(false)
    return {
        sendProtocolToGuest(chunk: string) {
            if (!closed && isHost && opponentId) {
                sendSignal?.({ type: 'PROTO', payload: chunk }, opponentId)
            }
        },
        sendChoiceToHost(choice: string) {
            if (!closed && !isHost && opponentId) {
                sendSignal?.({ type: 'CHOICE', payload: choice }, opponentId)
            }
        },
        reconnect() {
            if (!closed && !opponentId) {
                void mountRoom(true)
            }
        },
        leave() {
            if (closed) return
            closed = true
            mountSeq += 1
            clearAllTimers()
            document.removeEventListener('visibilitychange', onVisibilityChange)
            if (opponentId) {
                sendSignal?.({ type: 'LEAVE', payload: '' }, opponentId)
            }
            const room = activeRoom
            activeRoom = null
            sendSignal = null
            if (room) {
                void room.leave()
            }
        },
    }
}
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
}
export interface P2PSession {
    sendProtocolToGuest: (chunk: string) => void
    sendChoiceToHost: (choice: string) => void
    leave: () => void
}
export function connectP2PRoom(
    roomId: string,
    format: BattleFormat,
    myTeamPaste: string,
    callbacks: P2PSessionCallbacks
): P2PSession {
    const cleanRoom = roomId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    const roomKey = `pkmn-room-v2-${cleanRoom}`
    let opponentId = ''
    let isHost = false
    let handshakeDone = false
    let hostStarted = false
    let closed = false
    let sendSignal: ((data: SignalMsg, target: string) => void) | null = null
    let leaveActiveRoom: (() => void) | null = null
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
        const delay = 14000 + Math.floor(Math.random() * 5000)
        refreshTimer = setTimeout(() => {
            if (!closed && !opponentId) {
                mountRoom()
            }
        }, delay)
    }
    const mountRoom = () => {
        if (closed || opponentId) return
        if (leaveActiveRoom) {
            const prevLeave = leaveActiveRoom
            leaveActiveRoom = null
            sendSignal = null
            prevLeave()
        }
        const room = joinRoom({ appId: APP_ID, rtcConfig: RTC_CONFIG }, roomKey)
        const selfReady = room.getSelf()
        const battleAction = room.makeAction<SignalMsg>('battle')
        let stale = false
        leaveActiveRoom = () => {
            stale = true
            void room.leave()
        }
        sendSignal = (data: SignalMsg, target: string) => {
            if (!stale && !closed) {
                void battleAction.send(data, { target })
            }
        }
        const startHello = (peerId: string) => {
            void selfReady.then(({ peerId: myPeerId }) => {
                if (stale || closed || opponentId) return
                clearRefresh()
                opponentId = peerId
                isHost = myPeerId < peerId
                const pushHello = () => {
                    if (!stale && !closed && opponentId && !handshakeDone) {
                        sendSignal?.({ type: 'HELLO', payload: format }, opponentId)
                    }
                }
                pushHello()
                helloTimer = setInterval(pushHello, 900)
            })
        }
        room.onPeerJoin(({ peerId }) => {
            startHello(peerId)
        })
        battleAction.onMessage((data, { peerId }) => {
            if (stale || closed) return
            if (data.type === 'HELLO') {
                void selfReady.then(({ peerId: myPeerId }) => {
                    if (stale || closed) return
                    if (!opponentId && peerId) {
                        clearRefresh()
                        opponentId = peerId
                        isHost = myPeerId < peerId
                    }
                    if (peerId !== opponentId) return
                    if (data.payload !== format) {
                        clearAllTimers()
                        closed = true
                        callbacks.onFormatMismatch?.(data.payload)
                        leaveActiveRoom?.()
                        return
                    }
                    if (!handshakeDone) {
                        handshakeDone = true
                        clearHello()
                        sendSignal?.({ type: 'HELLO', payload: format }, opponentId)
                        callbacks.onRoleAssigned(isHost ? 'p1' : 'p2')
                        if (!isHost) {
                            const pushTeam = () => {
                                if (!stale && !closed && opponentId) {
                                    sendSignal?.({ type: 'TEAM', payload: myTeamPaste }, opponentId)
                                }
                            }
                            pushTeam()
                            retryTimer = setInterval(pushTeam, 1200)
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
            if (!stale && !closed && peerId === opponentId) {
                clearAllTimers()
                callbacks.onOpponentLeft()
            }
        })
        scheduleRefresh()
    }
    mountRoom()
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
        leave() {
            if (closed) return
            closed = true
            clearAllTimers()
            if (opponentId) {
                sendSignal?.({ type: 'LEAVE', payload: '' }, opponentId)
            }
            leaveActiveRoom?.()
            leaveActiveRoom = null
            sendSignal = null
        },
    }
}
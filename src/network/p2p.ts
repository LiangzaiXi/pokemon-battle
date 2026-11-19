import { joinRoom } from 'trystero'
import type { BattleFormat } from '../store/teamStore'
type SignalMsg = {
    type: string
    payload: string
}
const APP_ID = 'pkmn-p2p-battle-v1'
export function startRandomMatchmaking(
    format: BattleFormat,
    onMatched: (roomId: string) => void
) {
    const room = joinRoom({ appId: APP_ID }, `lobby-${format}`)
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
    const room = joinRoom(
        { appId: APP_ID },
        `room-${format}-${roomId.trim().toLowerCase()}`
    )
    const selfReady = room.getSelf()
    const battleAction = room.makeAction<SignalMsg>('battle')
    let opponentId = ''
    let isHost = false
    let hostStarted = false
    let closed = false
    let retryTimer: ReturnType<typeof setInterval> | null = null
    const clearRetry = () => {
        if (retryTimer) {
            clearInterval(retryTimer)
            retryTimer = null
        }
    }
    room.onPeerJoin(({ peerId }) => {
        void selfReady.then(({ peerId: myPeerId }) => {
            if (closed || opponentId) return
            opponentId = peerId
            isHost = myPeerId < peerId
            callbacks.onRoleAssigned(isHost ? 'p1' : 'p2')
            if (!isHost) {
                const pushTeam = () => {
                    if (!closed && opponentId) {
                        void battleAction.send({ type: 'TEAM', payload: myTeamPaste }, { target: opponentId })
                    }
                }
                pushTeam()
                retryTimer = setInterval(pushTeam, 1200)
            }
        })
    })
    battleAction.onMessage((data) => {
        if (closed) return
        if (isHost && data.type === 'TEAM' && !hostStarted) {
            hostStarted = true
            callbacks.onGuestTeam(data.payload)
        } else if (isHost && data.type === 'CHOICE') {
            callbacks.onGuestChoice(data.payload)
        } else if (!isHost && data.type === 'PROTO') {
            clearRetry()
            callbacks.onProtocol(data.payload)
        } else if (data.type === 'LEAVE') {
            clearRetry()
            callbacks.onOpponentLeft()
        }
    })
    room.onPeerLeave(({ peerId }) => {
        if (!closed && peerId === opponentId) {
            clearRetry()
            callbacks.onOpponentLeft()
        }
    })
    return {
        sendProtocolToGuest(chunk: string) {
            if (!closed && isHost && opponentId) {
                void battleAction.send({ type: 'PROTO', payload: chunk }, { target: opponentId })
            }
        },
        sendChoiceToHost(choice: string) {
            if (!closed && !isHost && opponentId) {
                void battleAction.send({ type: 'CHOICE', payload: choice }, { target: opponentId })
            }
        },
        leave() {
            if (closed) return
            closed = true
            clearRetry()
            if (opponentId) {
                void battleAction.send({ type: 'LEAVE', payload: '' }, { target: opponentId })
            }
            void room.leave()
        },
    }
}
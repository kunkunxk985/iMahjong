import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_WS_URL,
  type ClientView,
  type FriendInvite,
  type GameAction,
  type Settlement,
  type UserProfile,
} from '@pizhou/shared';
import { apiGetProfile, getStoredAuth, saveStoredAuth } from './api/auth';
import { AuthModal } from './components/AuthModal';
import { FriendsModal } from './components/FriendsModal';
import { HuCelebration } from './components/HuCelebration';
import { InviteToast } from './components/InviteToast';
import { ProfileModal } from './components/ProfileModal';
import { RulesModal } from './components/RulesModal';
import { SettingsModal } from './components/SettingsModal';
import { GameClient, isLoopbackWs } from './ws/client';
import { AuthView } from './views/AuthView';
import { Lobby, type NetworkStatus } from './views/Lobby';
import { SettlementModal } from './views/Settlement';
import { Table } from './views/Table';
import { WaitingRoom } from './views/WaitingRoom';

type Mode = 'home' | 'local' | 'online';

function celebrationKey(view: ClientView): string | null {
  if (!view.settlement) return null;
  return `${view.roomCode}:${view.round}:${view.settlement.winnerSeat ?? 'draw'}:${view.settlement.winType}`;
}

function initialNickname(): string {
  try {
    const savedUser = localStorage.getItem('pizhou.auth_user_v1');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      if (parsed?.nickname) return parsed.nickname;
    }
    const saved = localStorage.getItem('pizhou.nickname');
    if (saved) return saved;
  } catch {
    // localStorage is optional in restricted renderer environments.
  }
  return `玩家${String(Math.floor(Math.random() * 90) + 10)}`;
}

function savedOverrideUrl(): string {
  try {
    return localStorage.getItem('pizhou.serverUrl') || '';
  } catch {
    return '';
  }
}

export function App() {
  const [nickname, setNicknameState] = useState(initialNickname);
  const [auth, setAuth] = useState<{ token: string | null; user: UserProfile | null }>(() => getStoredAuth());
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<FriendInvite | null>(null);

  const [localUrl, setLocalUrl] = useState('');
  const [localUrlReady, setLocalUrlReady] = useState(false);
  const [overrideUrl, setOverrideUrl] = useState(savedOverrideUrl);
  const [soloIntent, setSoloIntent] = useState(false);
  const [mode, setMode] = useState<Mode>('home');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('connecting');
  const [view, setView] = useState<ClientView | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const clientRef = useRef<GameClient | null>(null);
  const requestedModeRef = useRef<Mode>('home');
  const pendingSoloRef = useRef(false);
  const seenSettlementRef = useRef<string | null>(null);

  if (!clientRef.current) {
    clientRef.current = new GameClient({
      onView: (next) => {
        setMode(requestedModeRef.current === 'local' ? 'local' : 'online');
        setView(next);
        const nextCelebrationKey = celebrationKey(next);
        if (nextCelebrationKey && nextCelebrationKey !== seenSettlementRef.current) {
          seenSettlementRef.current = nextCelebrationKey;
          setCelebrating(true);
        } else if (!nextCelebrationKey) {
          seenSettlementRef.current = null;
          setCelebrating(false);
        }
        setSettlement(next.settlement);
        setError('');
      },
      onSettlement: (nextSettlement, nextView) => {
        setMode(requestedModeRef.current === 'local' ? 'local' : 'online');
        setView(nextView);
        const nextCelebrationKey = celebrationKey(nextView);
        if (nextCelebrationKey && nextCelebrationKey !== seenSettlementRef.current) {
          seenSettlementRef.current = nextCelebrationKey;
          setCelebrating(true);
        }
        setSettlement(nextSettlement);
        setError('');
      },
      onError: (message) => setError(message),
      onStatus: (status) => setNetworkStatus(status),
      onFriendInvited: (invite) => {
        setIncomingInvite(invite);
      },
      onLeft: () => {
        pendingSoloRef.current = false;
        requestedModeRef.current = 'home';
        setSoloIntent(false);
        setMode('home');
        setView(null);
        setSettlement(null);
        seenSettlementRef.current = null;
      },
    });
  }

  useEffect(() => {
    let active = true;
    const envWsUrl = import.meta.env.VITE_WS_URL;
    if (envWsUrl) {
      setLocalUrl(envWsUrl);
      setLocalUrlReady(true);
      return undefined;
    }

    const localUrlApi = window.pizhou?.getLocalServerUrl;
    if (!localUrlApi) {
      setLocalUrl(DEFAULT_WS_URL);
      setLocalUrlReady(true);
      return undefined;
    }

    void localUrlApi().then((url) => {
      if (!active) return;
      setLocalUrl(url || DEFAULT_WS_URL);
      setLocalUrlReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const targetUrl = soloIntent
    ? (localUrl || DEFAULT_WS_URL)
    : (overrideUrl.trim() || DEFAULT_WS_URL);
  const urlReady = soloIntent ? localUrlReady : true;

  // Background refresh profile if token exists
  useEffect(() => {
    if (!targetUrl) return;
    const currentAuth = getStoredAuth();
    if (currentAuth.token) {
      apiGetProfile(targetUrl, currentAuth.token)
        .then((user) => {
          setAuth({ token: currentAuth.token, user });
          if (user.nickname) setNicknameState(user.nickname);
        })
        .catch(() => {});
    }
  }, [targetUrl]);

  useEffect(() => {
    if (!urlReady || !targetUrl) return undefined;
    clientRef.current?.connect(targetUrl);
    return () => clientRef.current?.disconnect(false);
  }, [targetUrl, urlReady]);

  // Bind authenticated user to WebSocket
  useEffect(() => {
    if (networkStatus === 'open' && auth.user && auth.token) {
      clientRef.current?.bindUser(auth.user.userId, auth.token);
    }
  }, [networkStatus, auth.user, auth.token]);

  useEffect(() => () => clientRef.current?.disconnect(), []);

  useEffect(() => {
    if (!pendingSoloRef.current) return;
    if (networkStatus !== 'open') return;
    if (!isLoopbackWs(clientRef.current?.url ?? '')) return;
    pendingSoloRef.current = false;
    clientRef.current?.createRoom(nickname.trim() || '玩家', true);
  }, [networkStatus, nickname]);

  const handleAuthSuccess = (user: UserProfile) => {
    const current = getStoredAuth();
    setAuth({ token: current.token, user });
    if (user.nickname) {
      setNicknameState(user.nickname);
    }
    if (current.token) {
      clientRef.current?.bindUser(user.userId, current.token);
    }
  };

  const handleLogout = () => {
    saveStoredAuth(null, null);
    setAuth({ token: null, user: null });
    setProfileOpen(false);
    setAuthOpen(false);
    setFriendsOpen(false);
  };

  const requireOnline = (): boolean => {
    if (!nickname.trim()) {
      setError('请先输入昵称');
      return false;
    }
    if (networkStatus !== 'open') {
      setError('还没有连上牌桌服务器，请检查服务器地址');
      return false;
    }
    setError('');
    return true;
  };

  const createRoom = () => {
    if (!requireOnline()) return;
    requestedModeRef.current = 'online';
    clientRef.current?.createRoom(nickname.trim());
  };

  const joinRoom = (roomCode: string) => {
    if (!requireOnline()) return;
    requestedModeRef.current = 'online';
    clientRef.current?.joinRoom(roomCode, nickname.trim());
  };

  const startLocal = () => {
    if (soloIntent || pendingSoloRef.current) return;
    if (!nickname.trim()) {
      setError('请先输入昵称');
      return;
    }
    setError('');
    requestedModeRef.current = 'local';
    pendingSoloRef.current = true;
    setSoloIntent(true);
    if (networkStatus === 'open' && isLoopbackWs(clientRef.current?.url ?? '')) {
      pendingSoloRef.current = false;
      clientRef.current?.createRoom(nickname.trim(), true);
    }
  };

  const sendAction = (action: GameAction) => {
    if (!view) return;
    clientRef.current?.action(view.sequence, action);
  };

  const leave = () => {
    pendingSoloRef.current = false;
    setSoloIntent(false);
    clientRef.current?.leave();
    requestedModeRef.current = 'home';
    setMode('home');
    setView(null);
    setSettlement(null);
    seenSettlementRef.current = null;
    setError('');
  };

  const again = () => clientRef.current?.again();
  const finishCelebration = useCallback(() => setCelebrating(false), []);

  const handleInviteFriend = (toUserId: string) => {
    if (!view?.roomCode) return;
    clientRef.current?.inviteFriend(toUserId, view.roomCode);
  };

  const saveServerUrl = (value: string) => {
    const next = value.trim();
    setOverrideUrl(next);
    try {
      localStorage.setItem('pizhou.serverUrl', next);
    } catch {
      // Ignore storage failures; the current session still works.
    }
    setSettingsOpen(false);
    setError('');
  };

  const inGame = Boolean(view && (view.phase === 'playing' || view.phase === 'settlement'));
  const inWaitingRoom = Boolean(mode === 'online' && view?.phase === 'lobby');
  const displayUrl = clientRef.current?.url || targetUrl;
  const soloBusy = soloIntent && networkStatus !== 'open';

  return (
    <div className="viewport">
      <div className="stage">
        {/* Real-time Friend Invite Toast */}
        {incomingInvite && (
          <InviteToast
            invite={incomingInvite}
            onAccept={(code) => {
              setIncomingInvite(null);
              joinRoom(code);
            }}
            onDecline={() => setIncomingInvite(null)}
          />
        )}

        {!auth.user ? (
          /* Step 1: Clean First-Screen Authentication / Guest Login */
          <AuthView
            serverUrl={displayUrl}
            onSuccess={handleAuthSuccess}
            onRules={() => setRulesOpen(true)}
            onSettings={() => setSettingsOpen(true)}
          />
        ) : inGame && view ? (
          /* Playing Table */
          <Table
            view={view}
            onAction={sendAction}
            onRules={() => setRulesOpen(true)}
            onLeave={leave}
            networkStatus={networkStatus}
            practice={mode === 'local'}
          />
        ) : inWaitingRoom && view ? (
          /* Online Waiting Room */
          <WaitingRoom
            view={view}
            onReady={(ready) => clientRef.current?.ready(ready)}
            onStart={() => clientRef.current?.start()}
            onLeave={leave}
            onRules={() => setRulesOpen(true)}
            onSetRate={(rate) => clientRef.current?.setConfig({ pointRate: rate })}
            onInviteFriends={() => setFriendsOpen(true)}
          />
        ) : (
          /* Step 2: Progressive Tiered Lobby */
          <Lobby
            nickname={nickname}
            error={error}
            networkStatus={networkStatus}
            serverUrl={displayUrl}
            token={auth.token}
            user={auth.user}
            soloBusy={soloBusy}
            onCreateRoom={createRoom}
            onJoinRoom={joinRoom}
            onStartLocal={startLocal}
            onRules={() => setRulesOpen(true)}
            onSettings={() => setSettingsOpen(true)}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenFriends={() => setFriendsOpen(true)}
            onLogout={handleLogout}
          />
        )}

        {settlement && view?.phase === 'settlement' && celebrating ? (
          <HuCelebration
            view={view}
            settlement={settlement}
            onFinish={finishCelebration}
          />
        ) : settlement && view?.phase === 'settlement' ? (
          <SettlementModal
            view={view}
            settlement={settlement}
            onAgain={again}
            onLeave={leave}
            readyCount={view.players.filter((player) => player.ready).length}
            alreadyReady={Boolean(view.players[view.mySeat]?.ready)}
            gameMode={mode === 'local' ? 'local' : 'online'}
            serverUrl={displayUrl}
            token={auth.token}
          />
        ) : null}

        {friendsOpen && auth.user ? (
          <FriendsModal
            serverUrl={displayUrl}
            token={auth.token}
            currentRoomCode={view?.phase === 'lobby' ? view.roomCode : null}
            onClose={() => setFriendsOpen(false)}
            onInviteFriend={handleInviteFriend}
          />
        ) : null}

        {authOpen ? (
          <AuthModal
            serverUrl={displayUrl}
            currentUser={auth.user}
            onClose={() => setAuthOpen(false)}
            onSuccess={handleAuthSuccess}
          />
        ) : null}

        {profileOpen && auth.user ? (
          <ProfileModal
            serverUrl={displayUrl}
            token={auth.token}
            user={auth.user}
            onClose={() => setProfileOpen(false)}
            onUpdate={handleAuthSuccess}
            onOpenAuth={() => {
              setProfileOpen(false);
              setAuthOpen(true);
            }}
            onLogout={handleLogout}
          />
        ) : null}

        {rulesOpen ? <RulesModal onClose={() => setRulesOpen(false)} /> : null}
        {settingsOpen ? (
          <SettingsModal serverUrl={overrideUrl} onSave={saveServerUrl} onClose={() => setSettingsOpen(false)} />
        ) : null}
        {error && inGame ? <div className="toast">{error}</div> : null}
      </div>
    </div>
  );
}

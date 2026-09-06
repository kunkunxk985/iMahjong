import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_AVATAR,
  DEFAULT_TITLE,
  DEFAULT_WS_URL,
  SERVER_PORT,
  type ClientView,
  type FriendInvite,
  type GameChatMessage,
  type GameAction,
  type Settlement,
  type UserProfile,
} from '@pizhou/shared';
import { ApiError, apiGetProfile, apiLogout, getStoredAuth, saveStoredAuth } from './api/auth';
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

const FALLBACK_LOCAL_WS_URL = `ws://127.0.0.1:${SERVER_PORT}`;

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

export function App() {
  const [nickname, setNicknameState] = useState(initialNickname);
  const [auth, setAuth] = useState<{ token: string | null; user: UserProfile | null }>(() => getStoredAuth());
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileInitialTab, setProfileInitialTab] = useState<'look' | 'stats' | 'leaderboard' | 'achievements' | 'security'>('look');
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<FriendInvite | null>(null);
  const [incomingChat, setIncomingChat] = useState<GameChatMessage | null>(null);

  const [localUrl, setLocalUrl] = useState('');
  const [localUrlReady, setLocalUrlReady] = useState(false);
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
      onChat: (chat) => setIncomingChat(chat),
      onLeft: () => {
        pendingSoloRef.current = false;
        requestedModeRef.current = 'home';
        setSoloIntent(false);
        setMode('home');
        setView(null);
        setSettlement(null);
        seenSettlementRef.current = null;
        setIncomingChat(null);
      },
    });
  }

  useEffect(() => {
    let active = true;
    const localUrlApi = window.pizhou?.getLocalServerUrl;
    if (!localUrlApi) {
      setLocalUrl(FALLBACK_LOCAL_WS_URL);
      setLocalUrlReady(true);
      return undefined;
    }

    void localUrlApi().then((url) => {
      if (!active) return;
      setLocalUrl(url || '');
      setLocalUrlReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  const targetUrl = soloIntent
    ? (localUrl || DEFAULT_WS_URL)
    : DEFAULT_WS_URL;
  const urlReady = soloIntent ? localUrlReady : true;

  // Background refresh profile if token exists
  useEffect(() => {
    let active = true;
    if (!targetUrl) return;
    const currentAuth = getStoredAuth();
    if (currentAuth.token) {
      apiGetProfile(DEFAULT_WS_URL, currentAuth.token)
        .then((user) => {
          if (!active) return;
          setAuth({ token: currentAuth.token, user });
          if (user.nickname) setNicknameState(user.nickname);
        })
        .catch((err: unknown) => {
          if (!active || !(err instanceof ApiError) || err.status !== 401) return;
          saveStoredAuth(null, null);
          setAuth({ token: null, user: null });
          setProfileOpen(false);
          setFriendsOpen(false);
        });
    }
    return () => {
      active = false;
    };
  }, []);

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

  useEffect(() => {
    if (auth.user) {
      clientRef.current?.setPlayerProfile(
        auth.user.nickname,
        auth.user.avatar || DEFAULT_AVATAR,
        auth.user.title || DEFAULT_TITLE,
        auth.user.bio,
      );
    }
  }, [auth.user]);

  useEffect(() => () => clientRef.current?.disconnect(), []);

  useEffect(() => {
    if (!pendingSoloRef.current) return;
    if (networkStatus !== 'open') return;
    if (!isLoopbackWs(clientRef.current?.url ?? '')) return;
    pendingSoloRef.current = false;
    clientRef.current?.createRoom(
      nickname.trim() || '玩家',
      auth.user?.avatar || DEFAULT_AVATAR,
      true,
      auth.user?.title || DEFAULT_TITLE,
      auth.user?.bio,
    );
  }, [networkStatus, nickname, auth.user]);

  const handleAuthSuccess = (user: UserProfile, nextToken?: string) => {
    if (
      !user ||
      typeof user !== 'object' ||
      typeof user.userId !== 'string' ||
      !user.userId.trim() ||
      typeof user.nickname !== 'string' ||
      !user.nickname.trim()
    ) {
      throw new Error('账号服务返回的资料不完整，请先部署最新 CF Worker 后重试');
    }
    const current = getStoredAuth();
    const token = nextToken ?? current.token;
    setAuth({ token, user });
    if (user.nickname) {
      setNicknameState(user.nickname);
    }
    if (token) {
      clientRef.current?.bindUser(user.userId, token);
    }
  };

  const handleLogout = () => {
    const activeToken = auth.token;
    if (activeToken) {
      void apiLogout(DEFAULT_WS_URL, activeToken).catch(() => {});
    }
    clientRef.current?.unbindUser();
    saveStoredAuth(null, null);
    setAuth({ token: null, user: null });
    setProfileOpen(false);
    setAuthOpen(false);
    setFriendsOpen(false);
    setIncomingInvite(null);
    setIncomingChat(null);
  };

  const requireOnline = (): boolean => {
    if (!nickname.trim()) {
      setError('请先输入昵称');
      return false;
    }
    if (networkStatus !== 'open') {
      setError('还没有连上牌桌服务器，请检查网络连接后重试');
      return false;
    }
    setError('');
    return true;
  };

  const createRoom = (options?: { botCount?: number; pointRate?: number }) => {
    if (!requireOnline()) return;
    requestedModeRef.current = 'online';
    clientRef.current?.createRoom(
      nickname.trim(),
      auth.user?.avatar || DEFAULT_AVATAR,
      false,
      auth.user?.title || DEFAULT_TITLE,
      auth.user?.bio,
      options?.botCount ?? 0,
      options?.pointRate ?? 0.1,
    );
  };

  const joinRoom = (roomCode: string) => {
    if (!requireOnline()) return;
    requestedModeRef.current = 'online';
    clientRef.current?.joinRoom(
      roomCode,
      nickname.trim(),
      auth.user?.avatar || DEFAULT_AVATAR,
      auth.user?.title || DEFAULT_TITLE,
    );
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
    // Re-check on demand. Startup can race a stale process or a temporarily
    // occupied port; the main process is allowed to recover and retry now.
    const localServerRequest = window.pizhou?.getLocalServerUrl?.();
    if (!localServerRequest) {
      setLocalUrl(FALLBACK_LOCAL_WS_URL);
      setLocalUrlReady(true);
    } else void localServerRequest.then((url) => {
      if (url) {
        setLocalUrl(url);
        setLocalUrlReady(true);
        return;
      }
      pendingSoloRef.current = false;
      setSoloIntent(false);
      setError('本机牌局服务没有启动成功，请关闭旧的 iMahjong 窗口后重试');
    });
    if (networkStatus === 'open' && isLoopbackWs(clientRef.current?.url ?? '')) {
      pendingSoloRef.current = false;
      clientRef.current?.createRoom(
        nickname.trim(),
        auth.user?.avatar || DEFAULT_AVATAR,
        true,
        auth.user?.title || DEFAULT_TITLE,
      );
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
    setIncomingChat(null);
    setError('');
  };

  const again = () => clientRef.current?.again();
  const finishCelebration = useCallback(() => setCelebrating(false), []);

  const handleInviteFriend = (toUserId: string) => {
    if (!view?.roomCode) return;
    clientRef.current?.inviteFriend(toUserId, view.roomCode);
  };

  const inGame = Boolean(view && (view.phase === 'playing' || view.phase === 'settlement'));
  const inWaitingRoom = Boolean(mode === 'online' && view?.phase === 'lobby');
  // Account/profile/history APIs always use the cloud, even during local practice.
  const displayUrl = DEFAULT_WS_URL;
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
            onOpenProfile={() => setProfileOpen(true)}
            onSendChat={(message, isEmote) => clientRef.current?.sendChat(message, isEmote)}
            incomingChat={incomingChat}
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
            onOpenProfile={() => setProfileOpen(true)}
            onAddBot={() => clientRef.current?.addBot()}
            onRemoveBot={(seat) => clientRef.current?.removeBot(seat)}
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
            onOpenProfile={() => {
              setProfileInitialTab('look');
              setProfileOpen(true);
            }}
            onOpenLeaderboard={() => {
              setProfileInitialTab('leaderboard');
              setProfileOpen(true);
            }}
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
            onOpenProfile={() => setProfileOpen(true)}
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
            initialTab={profileInitialTab}
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
          <SettingsModal onClose={() => setSettingsOpen(false)} />
        ) : null}
        {error && inGame ? <div className="toast">{error}</div> : null}
      </div>
    </div>
  );
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CameraOff, Check, ChevronDown, CornerUpLeft, Maximize2, Mic, MicOff, Minimize2, MonitorUp, Pencil, Phone, PhoneOff, Settings2, Signal, Trash2, Users, X } from 'lucide-react';
import type { ConnectionState, Participant, Room } from 'livekit-client';
import { api, UserSummary } from '../services/api';
import { ProfileAvatar } from './ProfileAvatar';
import { TwemojiText } from './TwemojiText';
import './VoiceCalls.css';

type CallKind = 'direct' | 'group_channel';
type CallInfo = { id: string; kind: CallKind; title: string; subtitle: string; startedAt: number; isCaller: boolean; groupId?: string; channelId?: string; conversationId?: string };
type CallInvite = { call_id: string; room_type: CallKind; conversation_id: string; caller_id: string; caller_name: string; video?: boolean };
type CallContextValue = {
  activeCall: CallInfo | null;
  room: Room | null;
  connectionState: ConnectionState;
  error: string;
  startDirectCall: (conversationId: string, title: string, video?: boolean) => Promise<void>;
  joinVoiceChannel: (groupId: string, channelId: string, title: string, groupName: string) => Promise<void>;
  clearError: () => void;
  endCallForEveryone: () => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);
export const useVoiceCalls = () => {
  const value = useContext(CallContext);
  if (!value) throw new Error('useVoiceCalls must be rendered within CallProvider');
  return value;
};

export const CallProvider: React.FC<React.PropsWithChildren<{ currentUser: UserSummary | null }>> = ({ currentUser, children }) => {
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected' as ConnectionState);
  const [error, setError] = useState('');
  const [incomingInvite, setIncomingInvite] = useState<CallInvite | null>(null);
  const [inviteNotice, setInviteNotice] = useState('');
  const roomRef = useRef<Room | null>(null);
  const callRef = useRef<CallInfo | null>(null);
  const mediaPrefs = useRef({ video: false });

  const connect = useCallback(async (credentials: any, info: Omit<CallInfo, 'startedAt'>) => {
    const { Room, RoomEvent } = await import('livekit-client');
    const nextRoom = new Room({ adaptiveStream: true, dynacast: true, stopLocalTrackOnUnpublish: true });
    setError('');
    const call = { ...info, startedAt: Date.now() };
    roomRef.current?.disconnect();
    roomRef.current = nextRoom;
    callRef.current = call;
    setRoom(nextRoom);
    setActiveCall(call);
    setConnectionState('connecting' as ConnectionState);
    nextRoom.on(RoomEvent.ConnectionStateChanged, state => setConnectionState(state));
    nextRoom.on(RoomEvent.Reconnecting, () => setConnectionState('reconnecting' as ConnectionState));
    nextRoom.on(RoomEvent.Reconnected, () => setConnectionState('connected' as ConnectionState));
    nextRoom.on(RoomEvent.Disconnected, () => setConnectionState('disconnected' as ConnectionState));
    try {
      await nextRoom.connect(credentials.server_url, credentials.token, { autoSubscribe: true });
      await nextRoom.localParticipant.setMicrophoneEnabled(false);
      if (mediaPrefs.current.video) await nextRoom.localParticipant.setCameraEnabled(true);
    } catch (cause) {
      nextRoom.disconnect();
      roomRef.current = null;
      callRef.current = null;
      setRoom(null);
      setActiveCall(null);
      setConnectionState('disconnected' as ConnectionState);
      setError(cause instanceof Error ? cause.message : 'Could not connect to the voice room.');
      throw cause;
    }
  }, []);

  const startDirectCall = useCallback(async (conversationId: string, title: string, video = false) => {
    mediaPrefs.current.video = video;
    const credentials = await api.startDirectCall(conversationId, video);
    await connect(credentials, { id: credentials.call_id, kind: 'direct', title, subtitle: video ? 'Video call' : 'Voice call', isCaller: true, conversationId });
  }, [connect]);

  const joinVoiceChannel = useCallback(async (groupId: string, channelId: string, title: string, groupName: string) => {
    mediaPrefs.current.video = false;
    const credentials = await api.joinGroupVoiceChannel(groupId, channelId);
    await connect(credentials, { id: credentials.call_id, kind: 'group_channel', title, subtitle: groupName, isCaller: Boolean(credentials.can_end), groupId, channelId });
  }, [connect]);

  const acceptInvite = useCallback(async (invite: CallInvite) => {
    try {
      const credentials = await api.joinCall(invite.call_id);
      if (invite.video) mediaPrefs.current.video = true;
      await connect(credentials, { id: invite.call_id, kind: 'direct', title: invite.caller_name, subtitle: invite.video ? 'Video call' : 'Voice call', isCaller: false, conversationId: invite.conversation_id });
      setIncomingInvite(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not join the call.'); }
  }, [connect]);

  const declineInvite = useCallback(async (invite: CallInvite) => {
    await api.declineCall(invite.call_id).catch(() => undefined);
    setIncomingInvite(null);
  }, []);

  const leaveCall = useCallback(async (endForEveryone = false) => {
    const call = callRef.current;
    roomRef.current?.disconnect();
    roomRef.current = null;
    callRef.current = null;
    setRoom(null);
    setActiveCall(null);
    setConnectionState('disconnected' as ConnectionState);
    if (endForEveryone && call?.isCaller) await api.endCall(call.id).catch(() => undefined);
  }, []);

  const endCallForEveryone = useCallback(async () => { await leaveCall(true); }, [leaveCall]);

  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail;
      if (detail?.event === 'call.invite' && detail.caller_id !== currentUser?.id) setIncomingInvite(detail as CallInvite);
      if (detail?.event === 'call.ended' && detail.call_id === callRef.current?.id) void leaveCall();
      if (detail?.event === 'call.declined' && detail.call_id === callRef.current?.id) setInviteNotice('The call was declined.');
    };
    window.addEventListener('nexus-realtime-event', onRealtime);
    return () => window.removeEventListener('nexus-realtime-event', onRealtime);
  }, [currentUser?.id, leaveCall]);

  useEffect(() => {
    if (!currentUser && callRef.current) void leaveCall();
  }, [currentUser?.id, leaveCall]);

  const value = useMemo(() => ({ activeCall, room, connectionState, error, startDirectCall, joinVoiceChannel, clearError: () => setError(''), endCallForEveryone }), [activeCall, room, connectionState, error, startDirectCall, joinVoiceChannel, endCallForEveryone]);
  return <CallContext.Provider value={value}>{children}<CallOverlay currentUser={currentUser} incomingInvite={incomingInvite} onAccept={acceptInvite} onDecline={declineInvite} inviteNotice={inviteNotice} clearInviteNotice={() => setInviteNotice('')} onLeave={leaveCall} onEndForEveryone={endCallForEveryone} /></CallContext.Provider>;
};

function participantAvatar(participant: Participant): string | undefined {
  try { return JSON.parse(participant.metadata || '{}').avatar_url || undefined; } catch { return undefined; }
}

function ParticipantTile({ participant, isLocal, revision, volume, onVolumeChange }: { participant: Participant; isLocal: boolean; revision: number; volume: number; onVolumeChange: (volume: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const camera = participant.getTrackPublication('camera' as any)?.track;
  const screen = participant.getTrackPublication('screen_share' as any)?.track;
  const hasVideo = Boolean(camera || screen);
  useEffect(() => {
    const el = screen ? screenRef.current : videoRef.current;
    if (!el) return;
    const track = screen || camera;
    if (!track) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [camera, screen, revision]);
  return <div className={`nexus-call-tile${participant.isSpeaking ? ' is-speaking' : ''}${!hasVideo ? ' audio-only' : ''}`}>
    <video ref={videoRef} autoPlay playsInline muted={isLocal} className={screen ? 'is-hidden' : ''} />
    {screen && <video ref={screenRef} autoPlay playsInline muted className="nexus-call-screen-video" />}
    {!hasVideo && <div className="nexus-call-avatar"><ProfileAvatar className="friends-avatar" user={{ username: participant.name || participant.identity, avatar_url: participantAvatar(participant) || null }} /></div>}
    <div className="nexus-call-tile-label"><span>{isLocal ? 'You' : participant.name || participant.identity}</span><span className="nexus-call-state-icons">{participant.isMicrophoneEnabled ? <Mic size={13} /> : <MicOff size={13} />}{screen && <MonitorUp size={13} />}{String(participant.connectionQuality || '')}</span>{!isLocal && <input aria-label={`Volume for ${participant.name || participant.identity}`} title="Participant volume" className="nexus-call-participant-volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={event => onVolumeChange(Number(event.target.value))} />}</div>
    {participant.isSpeaking && <span className="nexus-call-speaking-pulse" aria-label="Speaking" />}
  </div>;
}

function CallOverlay({ currentUser, incomingInvite, onAccept, onDecline, inviteNotice, clearInviteNotice, onLeave, onEndForEveryone }: {
  currentUser: UserSummary | null; incomingInvite: CallInvite | null; onAccept: (invite: CallInvite) => void; onDecline: (invite: CallInvite) => void; inviteNotice: string; clearInviteNotice: () => void; onLeave: (endForEveryone?: boolean) => void; onEndForEveryone: () => void;
}) {
  const { activeCall, room, connectionState, error, clearError } = useVoiceCalls();
  const [minimized, setMinimized] = useState(false);
  const [video, setVideo] = useState(false);
  const [muted, setMuted] = useState(true);
  const [screenShare, setScreenShare] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [revision, setRevision] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedOutput, setSelectedOutput] = useState('');
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [deviceError, setDeviceError] = useState('');
  const [deviceMenu, setDeviceMenu] = useState(false);
  const chatStartRef = useRef<number>(0);

  useEffect(() => {
    setMinimized(false); setElapsed(0); setVideo(activeCall?.subtitle === 'Video call'); setMuted(true); setScreenShare(false);
    if (activeCall) chatStartRef.current = Date.now();
  }, [activeCall?.id]);
  useEffect(() => {
    const reopen = () => setMinimized(false);
    window.addEventListener('nexus-call-reopen', reopen);
    return () => window.removeEventListener('nexus-call-reopen', reopen);
  }, []);
  useEffect(() => {
    if (!activeCall) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - activeCall.startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [activeCall?.id, activeCall?.startedAt]);
  useEffect(() => {
    if (!room) return;
    const refresh = () => setRevision(value => value + 1);
    const events = ['participantConnected', 'participantDisconnected', 'trackSubscribed', 'trackUnsubscribed', 'localTrackPublished', 'localTrackUnpublished', 'activeSpeakersChanged', 'connectionStateChanged'] as any[];
    events.forEach(event => room.on(event, refresh));
    void navigator.mediaDevices?.enumerateDevices().then(setDevices).catch(() => undefined);
    return () => { events.forEach(event => room.off(event, refresh)); };
  }, [room]);
  const people = room ? [room.localParticipant, ...room.remoteParticipants.values()] : [];
  const time = `${Math.floor(elapsed / 60).toString().padStart(2, '0')}:${(elapsed % 60).toString().padStart(2, '0')}`;
  const toggleMic = async () => { if (!room) return; const next = !room.localParticipant.isMicrophoneEnabled; await room.localParticipant.setMicrophoneEnabled(next); setMuted(!next); };
  const toggleCamera = async () => { if (!room) return; const next = !room.localParticipant.isCameraEnabled; await room.localParticipant.setCameraEnabled(next); setVideo(next); };
  const toggleScreen = async () => { if (!room) return; const next = !room.localParticipant.isScreenShareEnabled; await room.localParticipant.setScreenShareEnabled(next); setScreenShare(next); };
  const chooseDevice = async (kind: 'audioinput' | 'videoinput' | 'audiooutput', id: string) => {
    if (!room) return;
    try {
      await room.switchActiveDevice(kind, id);
      if (kind === 'audioinput') setSelectedMic(id);
      else if (kind === 'videoinput') setSelectedCamera(id);
      else setSelectedOutput(id);
    } catch { setDeviceError('This device could not be selected. Check browser permissions and try again.'); }
  };
  if (!activeCall && !incomingInvite && !error && !inviteNotice) return null;

  return <>
    {incomingInvite && !activeCall && <div className="nexus-call-invite" role="dialog" aria-label="Incoming call"><span className="nexus-call-invite-avatar"><Phone size={19} /></span><div><strong>{incomingInvite.caller_name}</strong><small>Incoming voice call</small></div><button type="button" className="accept" onClick={() => onAccept(incomingInvite)} aria-label="Accept call"><Check size={18} /></button><button type="button" className="decline" onClick={() => onDecline(incomingInvite)} aria-label="Decline call"><PhoneOff size={18} /></button></div>}
    {error && !activeCall && <div className="nexus-call-toast" role="alert"><span>{error}</span><button onClick={clearError} aria-label="Dismiss">×</button></div>}
    {inviteNotice && <button className="nexus-call-toast" onClick={clearInviteNotice}>{inviteNotice} <X size={14} /></button>}
    {activeCall && minimized && <div className="nexus-call-mini"><span className={`nexus-call-connection-dot ${connectionState.toLowerCase()}`} /><div className="nexus-call-mini-title"><strong>{activeCall.title}</strong><small>{connectionState === 'connected' ? `Connected · ${time}` : connectionState === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</small></div><button type="button" className={muted ? 'is-off' : ''} onClick={() => void toggleMic()} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} title={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff size={15} /> : <Mic size={15} />}</button><button type="button" className={video ? 'is-on' : ''} onClick={() => void toggleCamera()} aria-label={video ? 'Turn camera off' : 'Turn camera on'} title={video ? 'Turn camera off' : 'Turn camera on'}>{video ? <Camera size={15} /> : <CameraOff size={15} />}</button><button type="button" className={screenShare ? 'is-on' : ''} onClick={() => void toggleScreen()} aria-label={screenShare ? 'Stop screen share' : 'Share screen'} title={screenShare ? 'Stop screen share' : 'Share screen'}><MonitorUp size={15} /></button><button type="button" onClick={() => setMinimized(false)} aria-label="Reopen call"><Maximize2 size={16} /></button><button type="button" className="nexus-call-mini-leave" onClick={() => onLeave()} aria-label="Leave call"><PhoneOff size={16} /></button></div>}
    {activeCall && <section className={`nexus-call-overlay${minimized ? ' is-minimized' : ''}`} aria-label="Voice and video call">
      <header className="nexus-call-header"><div><span className={`nexus-call-connection-dot ${connectionState.toLowerCase()}`} /><div><strong>{activeCall.title}</strong><small>{activeCall.subtitle} · {connectionState === 'connected' ? `Connected · ${time}` : connectionState === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</small></div></div><div className="nexus-call-header-actions"><span><Users size={15} /> {people.length}</span><button type="button" title="Open voice chat" aria-label="Open voice chat" onClick={() => setChatOpen(value => !value)}>☰</button><button type="button" title="Minimize call" aria-label="Minimize call" onClick={() => setMinimized(true)}><Minimize2 size={17} /></button><button type="button" title="Leave call" aria-label="Leave call" onClick={() => onLeave()}><X size={18} /></button></div></header>
      <main className={`nexus-call-stage participant-count-${Math.min(people.length, 8)}`}>
        {connectionState === 'reconnecting' && <div className="nexus-call-reconnecting"><Signal size={16} /> Reconnecting to voice…</div>}
        {people.length ? people.map(participant => <ParticipantTile key={participant.identity} participant={participant} isLocal={participant === room?.localParticipant} revision={revision} volume={participantVolumes[participant.identity] ?? 1} onVolumeChange={value => { setParticipantVolumes(items => ({ ...items, [participant.identity]: value })); room?.remoteParticipants.get(participant.identity)?.audioTrackPublications.forEach(publication => (publication.track as any)?.setVolume(value)); }} />) : <div className="nexus-call-waiting"><span className="nexus-call-waiting-mark"><Phone size={25} /></span><strong>Connecting to call</strong><small>{activeCall.subtitle}</small></div>}
        {room && [...room.remoteParticipants.values()].map(participant => [...participant.audioTrackPublications.values()].map(pub => pub.track ? <RemoteAudio key={`${participant.identity}-${pub.trackSid}`} track={pub.track} volume={participantVolumes[participant.identity] ?? 1} outputDevice={selectedOutput} /> : null))}
      </main>
      {chatOpen && <CallChatPanel activeCall={activeCall} currentUser={currentUser} onClose={() => setChatOpen(false)} />}
      <footer className="nexus-call-controls"><button type="button" className={muted ? 'is-off' : ''} onClick={() => void toggleMic()} title={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff size={19} /> : <Mic size={19} />}<span>{muted ? 'Unmute' : 'Mute'}</span></button><button type="button" className={video ? 'is-on' : ''} onClick={() => void toggleCamera()} title={video ? 'Turn camera off' : 'Turn camera on'}>{video ? <Camera size={19} /> : <CameraOff size={19} />}<span>Camera</span></button><button type="button" className={screenShare ? 'is-on' : ''} onClick={() => void toggleScreen()} title={screenShare ? 'Stop sharing' : 'Share screen'}><MonitorUp size={19} /><span>{screenShare ? 'Stop sharing' : 'Share screen'}</span></button><button type="button" className="nexus-call-settings-button" onClick={() => setDeviceMenu(value => !value)} title="Audio and video devices"><Settings2 size={19} /><span>Devices</span></button><button type="button" className="nexus-call-hangup" onClick={() => onLeave()} title="Leave call"><PhoneOff size={20} /><span>Leave</span></button></footer>
      {deviceMenu && <div className="nexus-call-device-menu">{deviceError && <small className="nexus-call-device-error">{deviceError}</small>}<label>Microphone<select value={selectedMic} onChange={event => void chooseDevice('audioinput', event.target.value)}>{devices.filter(item => item.kind === 'audioinput').map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Microphone'}</option>)}</select></label><label>Camera<select value={selectedCamera} onChange={event => void chooseDevice('videoinput', event.target.value)}>{devices.filter(item => item.kind === 'videoinput').map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera'}</option>)}</select></label><label>Speaker<select value={selectedOutput} onChange={event => void chooseDevice('audiooutput', event.target.value)}>{devices.filter(item => item.kind === 'audiooutput').map(device => <option key={device.deviceId} value={device.deviceId}>{device.label || 'System default'}</option>)}</select></label>{activeCall.isCaller && <button onClick={() => { setDeviceMenu(false); void onEndForEveryone(); }} className="nexus-call-end-for-all"><PhoneOff size={14} /> End call for everyone</button>}<button onClick={() => setDeviceMenu(false)}><ChevronDown size={14} /> Close</button></div>}
    </section>}
  </>;
}

function RemoteAudio({ track, volume, outputDevice }: { track: any; volume: number; outputDevice: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => { track.detach(element); };
  }, [track]);
  useEffect(() => { track.setVolume(volume); }, [track, volume]);
  useEffect(() => { const element = ref.current; if (element && outputDevice && 'setSinkId' in element) void (element as any).setSinkId(outputDevice).catch(() => undefined); }, [outputDevice]);
  return <audio ref={ref} autoPlay />;
}

function CallChatPanel({ activeCall, currentUser, onClose }: { activeCall: CallInfo; currentUser: UserSummary | null; onClose: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const groupRef = useRef<{ groupId: string; channelId: string } | null>(null);
  useEffect(() => {
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail;
      if (detail?.event === 'voice.message.new' && detail.channel_id === groupRef.current?.channelId) setMessages(items => items.some(item => item.id === detail.message.id) ? items : [...items, detail.message]);
      if (detail?.event === 'voice.message.edited' && detail.channel_id === groupRef.current?.channelId) setMessages(items => items.map(item => item.id === detail.message?.id ? detail.message : item));
      if (detail?.event === 'voice.message.deleted' && detail.channel_id === groupRef.current?.channelId) setMessages(items => items.map(item => item.id === detail.message_id ? { ...item, content: 'This message was deleted.' } : item));
      if (detail?.event === 'message.new' && detail.conversation_id === activeCall.conversationId && activeCall.kind === 'direct' && detail.message) setMessages(items => items.some(item => item.id === detail.message.id) ? items : [...items, detail.message]);
      if (detail?.event === 'message.edited' && detail.conversation_id === activeCall.conversationId && activeCall.kind === 'direct' && detail.message) setMessages(items => items.map(item => item.id === detail.message.id ? detail.message : item));
      if (detail?.event === 'message.deleted' && detail.conversation_id === activeCall.conversationId && activeCall.kind === 'direct') setMessages(items => items.map(item => item.id === detail.message_id ? { ...item, content: 'This message was deleted.' } : item));
    };
    window.addEventListener('nexus-realtime-event', onRealtime);
    return () => window.removeEventListener('nexus-realtime-event', onRealtime);
  }, [activeCall.conversationId, activeCall.kind]);
  useEffect(() => {
    if (activeCall.kind === 'direct' && activeCall.conversationId) {
      void api.getMessages(activeCall.conversationId).then(setMessages).catch(() => undefined);
      return;
    }
    if (activeCall.kind !== 'group_channel' || !activeCall.groupId || !activeCall.channelId) return;
    groupRef.current = { groupId: activeCall.groupId, channelId: activeCall.channelId };
    const { groupId, channelId } = groupRef.current!;
    void api.listVoiceChannelMessages(groupId, channelId).then(setMessages).catch(() => undefined);
  }, [activeCall.id, activeCall.kind, activeCall.groupId, activeCall.channelId]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    const target = groupRef.current;
    if (!content) return;
    try {
      if (editing) {
        const updated = activeCall.kind === 'direct' ? await api.editMessage(editing.id, content) : target ? await api.editVoiceChannelMessage(target.groupId, target.channelId, editing.id, content) : null;
        if (updated) setMessages(items => items.map(item => item.id === updated.id ? updated : item));
        setEditing(null); setDraft(''); return;
      }
      setDraft('');
      if (activeCall.kind === 'direct' && activeCall.conversationId) {
        const sent = await api.sendMessage(activeCall.conversationId, { content, reply_to_id: replyTo?.id || null });
        setMessages(items => items.some(item => item.id === sent.id) ? items : [...items, sent]);
      } else if (target) {
        const sent = await api.sendVoiceChannelMessage(target.groupId, target.channelId, content, replyTo?.id);
        setMessages(items => items.some(item => item.id === sent.id) ? items : [...items, sent]);
      } else setDraft(content);
      setReplyTo(null);
    } catch { setDraft(content); }
  };
  return <aside className="nexus-call-chat"><header><div><strong>{activeCall.kind === 'direct' ? activeCall.title : activeCall.subtitle}</strong><small>{activeCall.kind === 'direct' ? 'Direct messages' : 'Voice channel chat'}</small></div><button onClick={onClose} aria-label="Close chat"><X size={16} /></button></header><div className="nexus-call-chat-messages">{messages.map(message => {
    const senderId = message.sender_id || message.sender?.id;
    const senderName = message.sender_name || message.sender?.full_name || message.sender?.username || 'Member';
    const original = message.reply_to_id ? messages.find(item => item.id === message.reply_to_id) : null;
    const deleted = (message.content ?? message.text) === 'This message was deleted.';
    return <article key={message.id}><ProfileAvatar className="friends-avatar" user={{ username: senderName, avatar_url: message.avatar_url || message.sender?.avatar_url }} /><div><strong>{senderName}</strong><time>{new Date(message.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{message.is_edited ? ' · edited' : ''}</time>{original && <button className="nexus-call-chat-reply-preview" onClick={() => document.getElementById(`nexus-call-message-${original.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>↪ {original.sender_name || original.sender?.username}: {(original.content ?? original.text ?? '').slice(0, 90)}</button>}<p id={`nexus-call-message-${message.id}`}><TwemojiText>{message.content ?? message.text}</TwemojiText></p>{!deleted && <div className="nexus-call-message-tools"><button title="Reply" onClick={() => { setEditing(null); setReplyTo(message); }}><CornerUpLeft size={13} /></button>{senderId === currentUser?.id && <><button title="Edit" onClick={() => { setReplyTo(null); setEditing(message); setDraft(message.content ?? message.text ?? ''); }}><Pencil size={13} /></button><button title="Delete" onClick={() => { const action = activeCall.kind === 'direct' ? api.deleteMessage(message.id) : groupRef.current ? api.deleteVoiceChannelMessage(groupRef.current.groupId, groupRef.current.channelId, message.id) : Promise.resolve(); void action.then(() => setMessages(items => items.map(item => item.id === message.id ? { ...item, content: 'This message was deleted.' } : item))).catch(() => undefined); }}><Trash2 size={13} /></button></>}</div>}</div></article>;
  })}{!messages.length && <p className="nexus-call-chat-empty">No messages here yet. Voice channel chat history stays available after the call.</p>}</div>{(replyTo || editing) && <div className="nexus-call-chat-replying"><span>{editing ? 'Editing message' : `Replying to ${replyTo?.sender_name || replyTo?.sender?.username || 'member'}`}<small>{editing ? 'Your changes will update the saved message.' : (replyTo?.content ?? replyTo?.text ?? '').slice(0, 100)}</small></span><button type="button" onClick={() => { setReplyTo(null); setEditing(null); setDraft(''); }} aria-label="Cancel"><X size={14} /></button></div>}<form onSubmit={send}><input value={draft} onChange={event => setDraft(event.target.value)} placeholder={editing ? 'Edit message' : activeCall.kind === 'direct' ? 'Message' : 'Message voice channel'} /><button disabled={!draft.trim()} aria-label={editing ? 'Save edit' : 'Send message'}>{editing ? 'Save' : 'Send'}</button></form></aside>;
}

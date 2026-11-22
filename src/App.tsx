import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  Radio, Users, Activity, Volume2, VolumeX, Mic, Square, MousePointer2, MapPin, Circle,
  Trash2, WifiOff, Wifi, Terminal, Bot, Zap,
} from 'lucide-react'
import {
  mesh, sfx, parseVoice, PRESETS, PIN_TYPES, PRIORITIES, STATUSES, PRIORITY_COLOR,
  type Snapshot, type PinType, type Priority, type ZoneKind, type LogKind, type Status,
} from './meshEngine'
import TacticalMap, { PIN_ICON, type Tool, type Sel } from './TacticalMap'

const inp = 'w-full rounded border border-[#1E2833] bg-[#0F141A] px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-emerald-500'
const btn = 'flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs font-semibold transition-colors'
const LOG_COLOR: Record<LogKind, string> = {
  local: 'text-slate-300', merge: 'text-emerald-400', conflict: 'text-red-400',
  sync: 'text-sky-400', net: 'text-amber-400', sim: 'text-violet-400',
}

/* live waveform bars: real mic spectrum when allowed, animated fallback otherwise */
function useWave(active: boolean, mic: boolean) {
  const N = 14
  const [bars, setBars] = useState<number[]>(Array(N).fill(0.1))
  useEffect(() => {
    if (!active) { setBars(Array(N).fill(0.1)); return }
    let raf = 0, iv = 0, dead = false
    let stream: MediaStream | null = null
    let ac: AudioContext | null = null
    const fake = () => { iv = window.setInterval(() => setBars(Array.from({ length: N }, () => 0.15 + Math.random() * 0.85)), 90) }
    if (mic && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
        if (dead) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        ac = new AudioContext()
        const an = ac.createAnalyser()
        an.fftSize = 64
        ac.createMediaStreamSource(s).connect(an)
        const d = new Uint8Array(an.frequencyBinCount)
        const loop = () => {
          an.getByteFrequencyData(d)
          setBars(Array.from({ length: N }, (_, i) => Math.max(0.08, d[i + 1] / 255)))
          raf = requestAnimationFrame(loop)
        }
        loop()
      }).catch(fake)
    } else fake()
    return () => {
      dead = true
      cancelAnimationFrame(raf)
      clearInterval(iv)
      stream?.getTracks().forEach((t) => t.stop())
      void ac?.close()
    }
  }, [active, mic])
  return bars
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
      {children}
    </label>
  )
}

function Inspector({ snap, sel, setSel }: { snap: Snapshot; sel: Sel; setSel: (s: Sel) => void }) {
  const pin = sel?.kind === 'pin' ? snap.pins.find((p) => p.id === sel.id) : undefined
  const zone = sel?.kind === 'zone' ? snap.zones.find((z) => z.id === sel.id) : undefined

  if (pin) {
    const Icon = PIN_ICON[pin.type]
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Icon size={18} color={PRIORITY_COLOR[pin.priority]} />
          <h2 className="text-sm font-bold tracking-widest">NODE INSPECTOR</h2>
        </div>
        <Field label="Label"><input className={inp} value={pin.label} onChange={(e) => mesh.updatePin(pin.id, { label: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type">
            <select className={inp} value={pin.type} onChange={(e) => mesh.updatePin(pin.id, { type: e.target.value as PinType })}>
              {PIN_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className={inp} value={pin.priority} onChange={(e) => { mesh.updatePin(pin.id, { priority: e.target.value as Priority }); sfx.ping(e.target.value as Priority) }}>
              {PRIORITIES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Status">
          <select className={inp} value={pin.status} onChange={(e) => mesh.updatePin(pin.id, { status: e.target.value as Status })}>
            {STATUSES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Notes"><textarea className={inp + ' h-24 resize-none'} value={pin.notes} onChange={(e) => mesh.updatePin(pin.id, { notes: e.target.value })} /></Field>
        <div className="mb-3 rounded border border-[#1A222C] p-2 text-[11px] text-slate-500">
          ID {pin.id}<br />POS {pin.x.toFixed(0)}, {pin.y.toFixed(0)}<br />LAST EDIT <span style={{ color: '#10B981' }}>{pin.by}</span> · {new Date(pin.ts).toLocaleTimeString()}
        </div>
        <button className={`${btn} w-full justify-center border-red-500/50 text-red-400 hover:bg-red-500/10`} onClick={() => { mesh.deletePin(pin.id); setSel(null); sfx.click() }}>
          <Trash2 size={13} /> DELETE NODE
        </button>
      </div>
    )
  }

  if (zone) {
    return (
      <div>
        <h2 className="mb-3 text-sm font-bold tracking-widest">ZONE INSPECTOR</h2>
        <Field label="Label"><input className={inp} value={zone.label} onChange={(e) => mesh.updateZone(zone.id, { label: e.target.value })} /></Field>
        <Field label="Kind">
          <select className={inp} value={zone.kind} onChange={(e) => mesh.updateZone(zone.id, { kind: e.target.value as ZoneKind })}>
            <option value="hazard">hazard</option>
            <option value="safe">safe</option>
          </select>
        </Field>
        <Field label={`Radius · ${zone.r.toFixed(0)}`}>
          <input type="range" min={20} max={260} value={zone.r} className="w-full accent-emerald-500" onChange={(e) => mesh.updateZone(zone.id, { r: Number(e.target.value) })} />
        </Field>
        <div className="mb-3 rounded border border-[#1A222C] p-2 text-[11px] text-slate-500">
          CENTER {zone.x.toFixed(0)}, {zone.y.toFixed(0)}<br />LAST EDIT <span style={{ color: '#10B981' }}>{zone.by}</span>
        </div>
        <button className={`${btn} w-full justify-center border-red-500/50 text-red-400 hover:bg-red-500/10`} onClick={() => { mesh.deleteZone(zone.id); setSel(null); sfx.click() }}>
          <Trash2 size={13} /> DELETE ZONE
        </button>
      </div>
    )
  }

  const order: Record<Priority, number> = { CRITICAL: 0, HIGH: 1, LOW: 2 }
  const list = [...snap.pins].sort((a, b) => order[a.priority] - order[b.priority])
  return (
    <div>
      <h2 className="mb-1 text-sm font-bold tracking-widest">{snap.preset.name.toUpperCase()}</h2>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">{snap.preset.blurb}</p>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {PRIORITIES.map((p) => (
          <div key={p} className="rounded border border-[#1A222C] p-2 text-center">
            <div className="text-lg font-bold" style={{ color: PRIORITY_COLOR[p] }}>{snap.pins.filter((x) => x.priority === p && x.status !== 'RESOLVED').length}</div>
            <div className="text-[9px] tracking-widest text-slate-500">{p}</div>
          </div>
        ))}
      </div>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">Active nodes · {list.length} · zones {snap.zones.length}</div>
      <div className="mb-3 max-h-64 space-y-1 overflow-y-auto">
        {list.map((p) => {
          const Icon = PIN_ICON[p.type]
          return (
            <button key={p.id} onClick={() => setSel({ kind: 'pin', id: p.id })} className="flex w-full items-center gap-2 rounded border border-[#1A222C] px-2 py-1 text-left text-xs hover:border-emerald-500/60">
              <Icon size={13} color={PRIORITY_COLOR[p.priority]} />
              <span className="flex-1 truncate">{p.label}</span>
              <span className="text-[9px] text-slate-500">{p.status}</span>
            </button>
          )
        })}
      </div>
      <div className="mb-3 rounded border border-[#1A222C] p-2 text-[11px] leading-relaxed text-slate-500">
        <b className="text-slate-300">Shortcuts</b><br />
        1 Select · 2 Drop pin · 3 Draw zone<br />
        Space+Drag / Middle-drag pan · Scroll zoom<br />
        Del removes selection · Esc deselects<br />
        Open a 2nd tab to watch live CRDT sync.
      </div>
      <button className={`${btn} w-full justify-center border-[#1E2833] text-slate-400 hover:border-red-500/50 hover:text-red-400`} onClick={() => { mesh.clearBoard(); setSel(null) }}>
        <Trash2 size={13} /> CLEAR BOARD
      </button>
    </div>
  )
}

function Drawer({ snap }: { snap: Snapshot }) {
  const ref = useRef<HTMLDivElement>(null)
  const lastN = snap.log[snap.log.length - 1]?.n
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight }, [snap.log.length, lastN])
  const stats: [string, string][] = [
    ['Replicas (clientIDs)', String(snap.replicas)],
    ['Doc state', `${snap.docBytes} B`],
    ['Buffered ops', String(snap.pending)],
    ['Peers online', String(snap.peerCount)],
    ['Sync latency', snap.latency === null ? '—' : `${snap.latency.toFixed(2)} ms (${snap.latencySrc})`],
  ]
  return (
    <div className="flex h-52 shrink-0 border-t border-[#1A222C] bg-[#0B0F14]">
      <div className="w-64 shrink-0 border-r border-[#1A222C] p-3">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400"><Terminal size={12} /> CRDT · Yjs · IndexedDB</div>
        {stats.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-[#141C26] py-1 text-[11px]"><span className="text-slate-500">{k}</span><span>{v}</span></div>
        ))}
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[#090B0E]" style={{ background: snap.color }}>{snap.selfName} (you)</span>
          {snap.peers.map((p) => <span key={p.id} className="rounded px-1.5 py-0.5 text-[10px] font-bold text-[#090B0E]" style={{ background: p.color }}>{p.name}</span>)}
        </div>
      </div>
      <div ref={ref} className="min-w-0 flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-5">
        {snap.log.map((e) => (
          <div key={e.id} className={LOG_COLOR[e.kind]}>
            <span className="text-slate-600">{new Date(e.t).toLocaleTimeString([], { hour12: false })}.{String(e.t % 1000).padStart(3, '0')}</span>{' '}
            <span className="text-slate-600">[{e.kind.toUpperCase()}]</span> {e.msg}{e.n > 1 ? ` ×${e.n}` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const snap = useSyncExternalStore(mesh.subscribe, mesh.getSnapshot)
  const [tool, setTool] = useState<Tool>('select')
  const [pinType, setPinType] = useState<PinType>('Medical')
  const [priority, setPriority] = useState<Priority>('HIGH')
  const [zoneKind, setZoneKind] = useState<ZoneKind>('hazard')
  const [sel, setSel] = useState<Sel>(null)
  const [drawer, setDrawer] = useState(true)
  const [muted, setMuted] = useState(false)
  const [listening, setListening] = useState(false)
  const [demo, setDemo] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState('')
  const recRef = useRef<any>(null)
  const bars = useWave(listening || demo, listening)

  useEffect(() => { sfx.muted = muted }, [muted])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return
      if (e.key === '1') setTool('select')
      else if (e.key === '2') setTool('pin')
      else if (e.key === '3') setTool('zone')
      else if (e.key === 'Escape') setSel(null)
      else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        if (sel.kind === 'pin') mesh.deletePin(sel.id)
        else mesh.deleteZone(sel.id)
        setSel(null)
        sfx.click()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [sel])

  const submitVoice = (text: string) => {
    const r = parseVoice(text, mesh.getSnapshot().preset)
    if (!r) { sfx.err(); setFeedback('✗ No actionable keywords detected'); return }
    const pin = mesh.addPin({ type: r.type, priority: r.priority, x: r.x, y: r.y, label: r.label, notes: r.notes })
    sfx.ping(r.priority)
    setSel({ kind: 'pin', id: pin.id })
    setFeedback(`✓ ${r.priority} ${r.type} pin${r.place ? ` @ ${r.place}` : ''}`)
  }

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { sfx.err(); setFeedback('SpeechRecognition unsupported here — use a Demo Voice Command'); return }
    if (listening) { recRef.current?.stop(); return }
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e: any) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setTranscript(t)
      if (e.results[e.results.length - 1].isFinal) submitVoice(t)
    }
    rec.onerror = (e: any) => { setFeedback(`Mic error: ${e.error} — use a Demo Voice Command`); sfx.err(); setListening(false) }
    rec.onend = () => setListening(false)
    recRef.current = rec
    try { rec.start(); setListening(true); setTranscript(''); setFeedback('Listening…') }
    catch { setFeedback('Could not start microphone — use a Demo Voice Command') }
  }

  const runDemo = (text: string) => {
    if (demo || listening) return
    setDemo(true)
    setTranscript('')
    setFeedback('Demo voice command…')
    let i = 0
    const iv = window.setInterval(() => {
      i += 2
      setTranscript(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(iv)
        window.setTimeout(() => { submitVoice(text); setDemo(false) }, 250)
      }
    }, 35)
  }

  const bl = snap.blackout
  const toolBtn = (t: Tool, key: string, icon: React.ReactNode, label: string) => (
    <button key={t} onClick={() => { setTool(t); sfx.click() }} className={`${btn} ${tool === t ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-[#1E2833] text-slate-300 hover:border-emerald-500/50'}`}>
      {icon} {label} <kbd className="rounded bg-[#1A222C] px-1 text-[10px] text-slate-400">{key}</kbd>
    </button>
  )

  return (
    <div className="flex h-screen flex-col bg-[#090B0E] font-mono text-[13px] text-slate-200">
      <header className="flex flex-wrap items-center gap-2 border-b border-[#1A222C] bg-[#0B0F14] px-3 py-2">
        <div className="mr-2 flex items-center gap-2">
          <Radio size={20} className="text-emerald-400" />
          <span className="text-base font-bold tracking-[0.3em]">VESPER</span>
        </div>
        <span className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-bold tracking-wider ${bl ? 'border-red-500/60 bg-red-500/10 text-red-400' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'}`}>
          <span className={`h-2 w-2 rounded-full ${bl ? 'bg-red-500' : 'animate-pulse bg-emerald-400'}`} />
          {bl ? 'BLACKOUT · LOCAL-ONLY' : 'LOCAL MESH ACTIVE'}
        </span>
        <span className="flex items-center gap-1.5 rounded border border-[#1E2833] px-2 py-1 text-xs"><Users size={13} className="text-emerald-400" /> {snap.peerCount} PEERS</span>
        <span className="flex items-center gap-1.5 rounded border border-[#1E2833] px-2 py-1 text-xs" title={snap.latencySrc === 'peer' ? 'Cross-tab BroadcastChannel latency' : 'Local CRDT commit time'}>
          <Activity size={13} className="text-emerald-400" /> {snap.latency === null ? '— ms' : `${snap.latency.toFixed(1)} ms`}
        </span>
        <select
          className={inp + ' !w-auto'}
          value={snap.preset.id}
          onChange={(e) => { mesh.loadPreset(e.target.value); setSel(null); sfx.click() }}
        >
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button onClick={() => mesh.setBlackout(!bl)} className={`${btn} ${bl ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-amber-500/60 text-amber-400 hover:bg-amber-500/10'}`}>
            {bl ? <Wifi size={13} /> : <WifiOff size={13} />} {bl ? 'Restore Network' : 'Simulate Network Blackout'}
          </button>
          <button onClick={() => mesh.setSim(!snap.simOn)} className={`${btn} ${snap.simOn ? 'border-violet-400 bg-violet-500/15 text-violet-300' : 'border-[#1E2833] text-slate-200 hover:border-violet-400/60'}`}>
            <Bot size={13} /> {snap.simOn ? 'Stop Field Peers' : 'Simulate 4 Field Peers'}
          </button>
          <button onClick={() => setMuted(!muted)} className={`${btn} border-[#1E2833] text-slate-300 hover:border-emerald-500/50`} title="Mute / unmute SFX">
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
          <button onClick={() => setDrawer(!drawer)} className={`${btn} ${drawer ? 'border-emerald-500/60 text-emerald-300' : 'border-[#1E2833] text-slate-300'}`}>
            <Terminal size={13} /> CRDT LOG
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <TacticalMap snap={snap} tool={tool} pinType={pinType} priority={priority} zoneKind={zoneKind} sel={sel} onSelect={setSel} />

          <div className="absolute left-2 top-2 w-60 space-y-2 rounded border border-[#1A222C] bg-[#0B0F14]/95 p-2">
            <div className="flex flex-wrap gap-1">
              {toolBtn('select', '1', <MousePointer2 size={13} />, 'Select')}
              {toolBtn('pin', '2', <MapPin size={13} />, 'Pin')}
              {toolBtn('zone', '3', <Circle size={13} />, 'Zone')}
            </div>
            {tool === 'pin' && (
              <>
                <div className="flex flex-wrap gap-1">
                  {PIN_TYPES.map((t) => {
                    const Icon = PIN_ICON[t]
                    return (
                      <button key={t} onClick={() => setPinType(t)} className={`${btn} !px-2 !py-1 ${pinType === t ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-[#1E2833] text-slate-400'}`}>
                        <Icon size={12} /> {t}
                      </button>
                    )
                  })}
                </div>
                <div className="flex gap-1">
                  {PRIORITIES.map((p) => (
                    <button key={p} onClick={() => setPriority(p)} className={`${btn} flex-1 justify-center !px-1 !py-1`} style={{ borderColor: priority === p ? PRIORITY_COLOR[p] : '#1E2833', color: PRIORITY_COLOR[p], background: priority === p ? PRIORITY_COLOR[p] + '22' : 'transparent' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}
            {tool === 'zone' && (
              <div className="flex gap-1">
                {(['hazard', 'safe'] as ZoneKind[]).map((k) => (
                  <button key={k} onClick={() => setZoneKind(k)} className={`${btn} flex-1 justify-center`} style={{ borderColor: zoneKind === k ? (k === 'hazard' ? '#EF4444' : '#10B981') : '#1E2833', color: k === 'hazard' ? '#EF4444' : '#10B981' }}>
                    {k === 'hazard' ? 'Hazard zone' : 'Safe zone'}
                  </button>
                ))}
              </div>
            )}
            <div className="text-[10px] text-slate-500">
              {tool === 'select' ? 'Click nodes/zones to inspect · drag nodes to move' : tool === 'pin' ? 'Click the map to drop a pin' : 'Drag on the map to draw a perimeter'}
            </div>
          </div>

          <div className="absolute right-2 top-2 w-72 rounded border border-[#1A222C] bg-[#0B0F14]/95 p-2">
            <div className="mb-2 flex items-center gap-2">
              <button onClick={toggleVoice} className={`${btn} ${listening ? 'border-red-500 bg-red-500/15 text-red-400' : 'border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/10'}`}>
                {listening ? <Square size={13} /> : <Mic size={13} />} {listening ? 'Stop' : 'Voice-to-Pin'}
              </button>
              <div className="flex h-8 flex-1 items-center justify-center gap-[3px]">
                {bars.map((b, i) => (
                  <span key={i} className="w-[3px] rounded-full" style={{ height: `${Math.round(b * 100)}%`, minHeight: 3, background: listening || demo ? '#10B981' : '#243040', transition: 'height 80ms' }} />
                ))}
              </div>
            </div>
            <div className="min-h-[2.2rem] rounded bg-[#0F141A] p-1.5 text-[11px] text-slate-300">{transcript || <span className="text-slate-600">Say: “Critical medical emergency at North Bridge”</span>}</div>
            {feedback && <div className="mt-1 text-[11px] text-emerald-400">{feedback}</div>}
            <div className="mb-1 mt-2 flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-500"><Zap size={10} /> Demo Voice Command</div>
            <div className="space-y-1">
              {snap.preset.demos.map((d) => (
                <button key={d} disabled={demo || listening} onClick={() => runDemo(d)} className="w-full rounded border border-[#1E2833] px-2 py-1 text-left text-[11px] text-slate-300 hover:border-emerald-500/60 disabled:opacity-40">
                  ▶ {d}
                </button>
              ))}
            </div>
          </div>

          {bl && (
            <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded border border-red-500/60 bg-[#1A0B0B]/95 px-3 py-1.5 text-center text-[11px] text-red-300">
              NETWORK BLACKOUT — edits persist in IndexedDB · {snap.pending} ops buffered · CRDT merge on reconnect
            </div>
          )}
        </div>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#1A222C] bg-[#0B0F14] p-3">
          <Inspector snap={snap} sel={sel} setSel={setSel} />
        </aside>
      </div>

      {drawer && <Drawer snap={snap} />}
    </div>
  )
}

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

/* ───────────────────────────── Types ───────────────────────────── */
export type PinType = 'Medical' | 'Supply' | 'Hazard' | 'Relay' | 'Shelter'
export type Priority = 'LOW' | 'HIGH' | 'CRITICAL'
export type Status = 'OPEN' | 'ASSIGNED' | 'RESOLVED'
export type ZoneKind = 'hazard' | 'safe'
export type LogKind = 'local' | 'merge' | 'conflict' | 'sync' | 'net' | 'sim'

export interface Pin { id: string; type: PinType; priority: Priority; status: Status; x: number; y: number; label: string; notes: string; by: string; ts: number }
export interface Zone { id: string; kind: ZoneKind; x: number; y: number; r: number; label: string; by: string; ts: number }
export interface Peer { id: string; name: string; color: string; x: number; y: number; ts: number; sim: boolean }
export interface LogEntry { id: number; t: number; kind: LogKind; msg: string; n: number }

type P2 = [number, number]
export interface Preset {
  id: string
  name: string
  blurb: string
  sectors: [string, number, number, number, number][]
  roads: P2[][]
  nodes: P2[]
  places: [string, number, number][]
  seed: [PinType, Priority, number, number, string][]
  zones: [ZoneKind, number, number, number, string][]
  demos: string[]
}

export interface Snapshot {
  pins: Pin[]
  zones: Zone[]
  peers: Peer[]
  selfId: string
  selfName: string
  color: string
  preset: Preset
  peerCount: number
  latency: number | null
  latencySrc: 'peer' | 'local'
  blackout: boolean
  pending: number
  simOn: boolean
  log: LogEntry[]
  docBytes: number
  replicas: number
}

export const WORLD = { w: 1000, h: 700 }
export const PIN_TYPES: PinType[] = ['Medical', 'Supply', 'Hazard', 'Relay', 'Shelter']
export const PRIORITIES: Priority[] = ['LOW', 'HIGH', 'CRITICAL']
export const STATUSES: Status[] = ['OPEN', 'ASSIGNED', 'RESOLVED']
export const PRIORITY_COLOR: Record<Priority, string> = { LOW: '#10B981', HIGH: '#F59E0B', CRITICAL: '#EF4444' }

/* ───────────────────────────── Scenario presets ───────────────────────────── */
const CELLS: [number, number, number, number][] = [
  [40, 50, 260, 250], [330, 50, 300, 250], [660, 50, 300, 250],
  [40, 340, 260, 310], [330, 340, 300, 310], [660, 340, 300, 310],
]
const grid = (n: string[]): Preset['sectors'] =>
  CELLS.map((c, i) => [n[i], c[0], c[1], c[2], c[3]] as [string, number, number, number, number])
const BASE: P2[][] = [[[0, 320], [1000, 320]], [[315, 0], [315, 700]], [[645, 0], [645, 700]]]

export const PRESETS: Preset[] = [
  {
    id: 'urban',
    name: 'Urban Blackout & Crisis',
    blurb: 'City-wide power failure: triage points, substations, power relays and shelters.',
    sectors: grid(['Harbor', 'Old Town', 'Midtown', 'Eastgate', 'Civic Center', 'Power Plant']),
    roads: [...BASE, [[0, 120], [315, 200], [480, 320]]],
    nodes: [[170, 200], [480, 100], [810, 150], [170, 500], [480, 500], [810, 520], [315, 320], [645, 320]],
    places: [['North Bridge', 480, 320], ['General Hospital', 170, 150], ['Substation 7', 810, 480], ['City Hall', 480, 490], ['Harbor Pier', 90, 110], ['Old Market', 480, 140]],
    seed: [
      ['Medical', 'CRITICAL', 170, 150, 'Triage – General Hospital'],
      ['Hazard', 'HIGH', 480, 320, 'North Bridge Span Cracked'],
      ['Supply', 'HIGH', 810, 480, 'Substation 7 Fuel Low'],
      ['Shelter', 'LOW', 480, 490, 'City Hall Shelter'],
      ['Relay', 'LOW', 480, 100, 'Relay – Old Market'],
    ],
    zones: [['hazard', 560, 200, 70, 'Flood Zone'], ['safe', 480, 490, 90, 'Safe Perimeter']],
    demos: [
      'Critical medical emergency at North Bridge',
      'Generator fuel supply needed at Substation 7',
      'Hazard gas leak near Harbor Pier, high priority',
    ],
  },
  {
    id: 'climate',
    name: 'Climate & Eco-Sensor Mesh',
    blurb: 'Watershed monitoring, wildfire perimeters and distributed air-quality sensors.',
    sectors: grid(['Upper Watershed', 'Pine Ridge', 'Lake Basin', 'Valley Farms', 'Lake Marlow', 'Burn Scar']),
    roads: [[[0, 110], [200, 190], [315, 320], [480, 420], [645, 500], [1000, 570]], [[315, 0], [315, 700]], [[645, 0], [645, 700]]],
    nodes: [[170, 200], [480, 100], [810, 150], [170, 500], [480, 520], [810, 520], [315, 330], [645, 330], [560, 250]],
    places: [['Eagle Peak', 170, 150], ['Pine Ridge Station', 480, 140], ['Burn Perimeter East', 810, 480], ['Sensor Array 12', 810, 150], ['Fern Valley', 170, 500], ['Lake Marlow', 480, 490]],
    seed: [
      ['Hazard', 'CRITICAL', 780, 430, 'Wildfire Front'],
      ['Relay', 'LOW', 170, 200, 'Sensor Mesh Node'],
      ['Supply', 'HIGH', 480, 140, 'Water Tanker Staging'],
      ['Shelter', 'LOW', 170, 500, 'Evacuation Camp Fern'],
      ['Hazard', 'HIGH', 810, 150, 'PM2.5 Spike – Array 12'],
    ],
    zones: [['hazard', 780, 430, 110, 'Fire Perimeter'], ['safe', 170, 500, 80, 'Safe Zone']],
    demos: [
      'Critical wildfire hazard at Burn Perimeter East',
      'Air quality sensor relay down near Eagle Peak',
      'Water supply needed at Pine Ridge Station',
    ],
  },
  {
    id: 'swarm',
    name: 'Autonomous Swarm Network',
    blurb: 'Self-healing drone/robot nodes hopping signal across dead zones.',
    sectors: grid(['Alpha Cell', 'Bravo Cell', 'Charlie Cell', 'Delta Cell', 'Echo Cell', 'Foxtrot Cell']),
    roads: [[[170, 175], [480, 175], [810, 175]], [[170, 495], [480, 495], [810, 495]], [[170, 175], [170, 495]], [[480, 175], [480, 495]], [[810, 175], [810, 495]], [[170, 175], [480, 495], [810, 175]]],
    nodes: [[170, 175], [480, 175], [810, 175], [170, 495], [480, 495], [810, 495], [325, 335], [645, 335], [90, 330], [900, 330], [480, 335], [250, 90]],
    places: [['Hub Prime', 480, 490], ['Drone Cluster 7', 170, 150], ['Edge Node 12', 810, 150], ['Dead Zone', 810, 480], ['Charge Dock', 170, 500], ['Hop Gateway', 480, 140]],
    seed: [
      ['Relay', 'LOW', 480, 490, 'Hub Prime'],
      ['Hazard', 'CRITICAL', 810, 480, 'Node 9 Offline – Dead Zone'],
      ['Supply', 'HIGH', 170, 500, 'Battery Swap Dock'],
      ['Relay', 'LOW', 170, 150, 'Drone Cluster 7'],
      ['Relay', 'HIGH', 480, 140, 'Hop Gateway Rerouting'],
    ],
    zones: [['hazard', 810, 480, 90, 'Jam Zone'], ['safe', 480, 490, 100, 'Core Mesh']],
    demos: [
      'Critical relay failure at Dead Zone',
      'Supply batteries needed at Charge Dock',
      'Relay node online at Hop Gateway',
    ],
  },
  {
    id: 'campus',
    name: 'Campus & Event Coordination',
    blurb: 'Buildings, accessibility routes, supply hubs and first-aid for a large campus event.',
    sectors: grid(['Science Hall', 'Main Library', 'Student Union', 'Arena & Gym', 'North Dorms', 'Admin Block']),
    roads: [...BASE, [[170, 320], [315, 430], [480, 490]]],
    nodes: [[170, 200], [480, 100], [810, 150], [170, 500], [480, 500], [810, 520], [315, 320], [645, 320], [30, 320]],
    places: [['Main Gate', 30, 320], ['Accessible Ramp B', 315, 420], ['Supply Hub', 810, 480], ['First Aid Tent', 480, 490], ['Quad Stage', 480, 140], ['Parking Lot C', 170, 500]],
    seed: [
      ['Shelter', 'HIGH', 480, 490, 'First Aid Tent'],
      ['Supply', 'LOW', 810, 480, 'Water & Supply Hub'],
      ['Hazard', 'HIGH', 315, 420, 'Ramp B Blocked'],
      ['Medical', 'HIGH', 480, 140, 'Heat Exhaustion – Quad Stage'],
      ['Relay', 'LOW', 30, 320, 'Gate Relay'],
    ],
    zones: [['hazard', 315, 420, 60, 'Closed Route'], ['safe', 480, 490, 90, 'Assembly Point']],
    demos: [
      'High priority hazard blocked ramp near Accessible Ramp B',
      'Medical emergency at Quad Stage',
      'Supply water needed at Supply Hub',
    ],
  },
]

/* ───────────────────────────── Helpers ───────────────────────────── */
const now = () => performance.timeOrigin + performance.now()
const rid = () => (Math.random().toString(36) + '000000').slice(2, 8)
const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const COLORS = ['#38BDF8', '#A78BFA', '#F472B6', '#FB923C', '#22D3EE', '#A3E635', '#E879F9', '#FACC15']
const SIM_NAMES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA']

/* ───────────────────────────── Web Audio SFX ───────────────────────────── */
class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private ready(): AudioContext | null {
    if (this.muted) return null
    const ua = (navigator as any).userActivation
    if (ua && ua.hasBeenActive === false) return null
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch { return null }
  }
  tone(f: number, d: number, type: OscillatorType = 'sine', v = 0.05, delay = 0, to?: number) {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime + delay
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(v, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + d + 0.03)
  }
  click() { this.tone(900, 0.05, 'square', 0.025) }
  sync() { this.tone(1300, 0.06, 'triangle', 0.02) }
  err() { this.tone(200, 0.22, 'sawtooth', 0.04, 0, 110) }
  down() { this.tone(520, 0.5, 'sawtooth', 0.04, 0, 80) }
  up() { this.tone(300, 0.12, 'triangle', 0.05); this.tone(600, 0.12, 'triangle', 0.05, 0.12); this.tone(900, 0.16, 'triangle', 0.05, 0.24) }
  ping(p: Priority) {
    if (p === 'LOW') this.tone(660, 0.14, 'sine', 0.05)
    else if (p === 'HIGH') { this.tone(740, 0.1, 'triangle', 0.06); this.tone(988, 0.14, 'triangle', 0.06, 0.1) }
    else { this.tone(880, 0.12, 'sawtooth', 0.045); this.tone(660, 0.12, 'sawtooth', 0.045, 0.14); this.tone(880, 0.18, 'sawtooth', 0.045, 0.28) }
  }
}
export const sfx = new Sfx()

/* ───────────────────────────── Voice parser ───────────────────────────── */
const TYPE_KW: [PinType, RegExp][] = [
  ['Medical', /\b(medical|injur\w*|triage|casualt\w*|ambulance|hospital|patient|clinic|first aid|wounded|heat exhaustion)\b/],
  ['Hazard', /\b(hazard\w*|fire|wildfire|flood\w*|smoke|gas|collapse\w*|danger\w*|blocked|toxic|spill|debris|failure)\b/],
  ['Supply', /\b(supply|supplies|food|water|fuel|generator|batter\w*|medicine|rations|stockpile|depot)\b/],
  ['Relay', /\b(relay|node|antenna|tower|signal|repeater|drone|mesh|sensor)\b/],
  ['Shelter', /\b(shelter|evacuat\w*|refuge|camp|safe house|rest area|assembly)\b/],
]

export interface VoiceResult { type: PinType; priority: Priority; x: number; y: number; label: string; notes: string; place: string | null }

export function parseVoice(text: string, preset: Preset): VoiceResult | null {
  const t = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t) return null
  const hit = TYPE_KW.find(([, re]) => re.test(t))
  const critical = /\b(critical|emergency|urgent|severe|mayday|life threatening)\b/.test(t)
  if (!hit && !critical) return null
  const type: PinType = hit ? hit[0] : 'Hazard'
  const priority: Priority = critical
    ? 'CRITICAL'
    : /\b(high|important|serious|major|priority)\b/.test(t) ? 'HIGH'
    : /\b(low|minor|routine|stable)\b/.test(t) ? 'LOW'
    : type === 'Medical' || type === 'Hazard' ? 'HIGH' : 'LOW'
  const cands: [string, number, number][] = [
    ...preset.places,
    ...preset.sectors.map((s) => [s[0], s[1] + s[3] / 2, s[2] + s[4] / 2] as [string, number, number]),
  ]
  let best: [string, number, number] | null = null
  let bestScore = 0
  for (const c of cands) {
    const n = c[0].toLowerCase()
    let s = t.includes(n) ? 100 + n.length : 0
    if (!s) s = n.split(' ').filter((w) => w.length > 3 && t.includes(w)).length * 10
    if (s > bestScore) { bestScore = s; best = c }
  }
  const x = best ? best[1] + rand(-18, 18) : rand(380, 620)
  const y = best ? best[2] + rand(-18, 18) : rand(280, 420)
  const place = best ? best[0] : null
  return { type, priority, x, y, place, label: place ? `${type} – ${place}` : `${type} report`, notes: `Voice: "${text.trim()}"` }
}

/* ───────────────────────────── Mesh engine ───────────────────────────── */
interface SimPeer { id: string; name: string; color: string; x: number; y: number; tx: number; ty: number }

class MeshEngine {
  readonly doc = new Y.Doc()
  readonly pins = this.doc.getMap<Pin>('pins')
  readonly zones = this.doc.getMap<Zone>('zones')
  readonly meta = this.doc.getMap<string>('meta')
  readonly selfId = rid()
  readonly selfName = 'OP-' + this.selfId.slice(0, 3).toUpperCase()
  readonly color = COLORS[parseInt(this.selfId.slice(0, 2), 36) % COLORS.length]

  private ch = new BroadcastChannel('vesper-mesh')
  private idb: IndexeddbPersistence
  private peers = new Map<string, Peer>()
  private localSim = new Set<string>()
  private simPeers: SimPeer[] = []
  private simTimers: number[] = []
  private logs: LogEntry[] = []
  private lastEdit = new Map<string, { by: string; ts: number }>()
  private subs = new Set<() => void>()
  private raf = 0
  private logId = 0
  private fromName = ''
  private blackout = false
  private pending = 0
  private simOn = false
  private remoteLat: number | null = null
  private remoteSeen = 0
  private localLat: number | null = null
  private lastBeat = 0
  private lastPing = 0
  private cursor = { x: 500, y: 350 }
  private snap!: Snapshot

  constructor() {
    this.idb = new IndexeddbPersistence('vesper-doc', this.doc)
    this.doc.on('update', this.onUpdate)
    this.pins.observe((e) => this.onChange('pin', e))
    this.zones.observe((e) => this.onChange('zone', e))
    this.meta.observe(() => this.touch())
    this.ch.onmessage = (e) => this.onMsg(e.data)
    this.snap = this.build()
    this.idb.whenSynced.then(() => {
      this.log('sync', `IndexedDB restored · ${this.pins.size} pins · ${this.zones.size} zones`)
      if (!this.meta.get('preset')) this.loadPreset('urban', 'seed')
      this.ch.postMessage({ t: 'hello', from: this.selfId, name: this.selfName, sv: Y.encodeStateVector(this.doc), ts: now() })
      this.touch()
    })
    window.setInterval(() => this.tick(), 1000)
    window.addEventListener('beforeunload', () => this.ch.postMessage({ t: 'bye', from: this.selfId, id: this.selfId }))
  }

  /* ── store contract for useSyncExternalStore ── */
  subscribe = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f) } }
  getSnapshot = () => this.snap

  private touch() {
    if (this.raf) return
    this.raf = requestAnimationFrame(() => {
      this.raf = 0
      this.snap = this.build()
      this.subs.forEach((f) => f())
    })
  }

  private build(): Snapshot {
    const peers = [...this.peers.values()].sort((a, b) => a.id.localeCompare(b.id))
    const fresh = this.remoteLat !== null && Date.now() - this.remoteSeen < 6000
    const sv = Y.decodeStateVector(Y.encodeStateVector(this.doc))
    return {
      pins: [...this.pins.values()],
      zones: [...this.zones.values()],
      peers,
      selfId: this.selfId,
      selfName: this.selfName,
      color: this.color,
      preset: PRESETS.find((p) => p.id === this.meta.get('preset')) ?? PRESETS[0],
      peerCount: 1 + peers.length,
      latency: this.blackout ? null : fresh ? this.remoteLat : this.localLat,
      latencySrc: fresh ? 'peer' : 'local',
      blackout: this.blackout,
      pending: this.pending,
      simOn: this.simOn,
      log: [...this.logs],
      docBytes: Y.encodeStateAsUpdate(this.doc).byteLength,
      replicas: sv.size,
    }
  }

  private log(kind: LogKind, msg: string) {
    const t = Date.now()
    const last = this.logs[this.logs.length - 1]
    if (last && last.msg === msg && last.kind === kind && t - last.t < 600) { last.n++; last.t = t }
    else { this.logs.push({ id: this.logId++, t, kind, msg, n: 1 }); if (this.logs.length > 150) this.logs.shift() }
    this.touch()
  }

  private tx(fn: () => void, origin = 'local') {
    const t = performance.now()
    this.doc.transact(fn, origin)
    const d = performance.now() - t
    this.localLat = this.localLat === null ? d : this.localLat * 0.8 + d * 0.2
  }

  /* ── CRDT → network ── */
  private onUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin === 'remote' || origin === this.idb) return
    if (this.blackout) { this.pending++; this.touch(); return }
    this.ch.postMessage({ t: 'u', from: this.selfId, name: this.selfName, u, ts: now() })
  }

  /* ── network → CRDT ── */
  private onMsg(m: any) {
    if (!m || this.blackout || m.from === this.selfId) return
    const lat = Math.max(0, now() - (m.ts ?? now()))
    this.remoteLat = this.remoteLat === null ? lat : this.remoteLat * 0.8 + lat * 0.2
    this.remoteSeen = Date.now()
    switch (m.t) {
      case 'u':
      case 'sync':
        this.fromName = m.name ?? m.from
        Y.applyUpdate(this.doc, m.u, 'remote')
        break
      case 'hello':
        this.ch.postMessage({ t: 'sync', from: this.selfId, name: this.selfName, u: Y.encodeStateAsUpdate(this.doc, m.sv), ts: now() })
        if (!m.r) this.ch.postMessage({ t: 'hello', r: 1, from: this.selfId, name: this.selfName, sv: Y.encodeStateVector(this.doc), ts: now() })
        this.log('net', `PEER ${m.name ?? m.from} handshake · state-vector diff exchanged`)
        break
      case 'beat':
        this.peers.set(m.id, { id: m.id, name: m.name, color: m.color, x: m.x, y: m.y, ts: Date.now(), sim: !!m.sim })
        this.touch()
        break
      case 'bye':
        if (this.peers.delete(m.id)) this.touch()
        break
    }
  }

  private onChange(kind: 'pin' | 'zone', ev: Y.YMapEvent<any>) {
    const o = ev.transaction.origin
    const map: Y.Map<any> = kind === 'pin' ? this.pins : this.zones
    let a = 0, u = 0, d = 0
    const conflicts: string[] = []
    const adds: Pin[] = []
    ev.changes.keys.forEach((c, k) => {
      if (c.action === 'add') a++
      else if (c.action === 'update') u++
      else d++
      if (c.action === 'delete') return
      const v = map.get(k)
      if (!v) return
      const last = this.lastEdit.get(k)
      if (o === 'remote' && c.action === 'update' && last && last.by !== v.by && Date.now() - last.ts < 2000)
        conflicts.push(`${kind} "${v.label}" edited by ${last.by} & ${v.by}`)
      this.lastEdit.set(k, { by: v.by, ts: Date.now() })
      if (kind === 'pin' && c.action === 'add') adds.push(v as Pin)
    })
    const k: LogKind = o === 'remote' ? 'merge' : o === 'sim' ? 'sim' : o === this.idb ? 'sync' : 'local'
    const who = o === 'remote' ? this.fromName : o === 'sim' ? 'SIM' : o === this.idb ? 'IDB' : this.selfName
    this.log(k, `${k === 'merge' ? 'MERGE ←' : 'APPLY'} ${who} · ${kind}s +${a} ~${u} −${d}`)
    conflicts.forEach((c) => this.log('conflict', `CONFLICT RESOLVED · ${c} → deterministic Yjs merge, no data lost`))
    if ((o === 'remote' || o === 'sim') && adds.length && Date.now() - this.lastPing > 150) {
      this.lastPing = Date.now()
      sfx.ping(adds[0].priority)
    }
    this.touch()
  }

  private beat() {
    if (this.blackout) return
    this.ch.postMessage({ t: 'beat', from: this.selfId, id: this.selfId, name: this.selfName, color: this.color, x: this.cursor.x, y: this.cursor.y, ts: now() })
  }

  private tick() {
    this.beat()
    let changed = false
    const t = Date.now()
    for (const [id, p] of this.peers) {
      if (!this.localSim.has(id) && t - p.ts > 3500) { this.peers.delete(id); changed = true }
    }
    if (changed) this.log('net', 'PEER timeout · heartbeat lost, node pruned from mesh')
    else this.touch()
  }

  /* ── public API ── */
  setCursor(x: number, y: number) {
    this.cursor = { x, y }
    const t = performance.now()
    if (t - this.lastBeat > 60) { this.lastBeat = t; this.beat() }
  }

  addPin(p: Partial<Pin> & { x: number; y: number }): Pin {
    const pin: Pin = { id: rid(), type: 'Hazard', priority: 'HIGH', status: 'OPEN', label: '', notes: '', by: this.selfName, ts: Date.now(), ...p }
    if (!pin.label) pin.label = `${pin.type} ${pin.id.slice(0, 3).toUpperCase()}`
    this.tx(() => { this.pins.set(pin.id, pin) })
    return pin
  }

  updatePin(id: string, patch: Partial<Pin>) {
    const c = this.pins.get(id)
    if (c) this.tx(() => { this.pins.set(id, { ...c, ...patch, by: this.selfName, ts: Date.now() }) })
  }

  deletePin(id: string) { this.tx(() => { this.pins.delete(id) }) }

  addZone(z: { kind: ZoneKind; x: number; y: number; r: number; label?: string }): Zone {
    const id = rid()
    const zone: Zone = { id, kind: z.kind, x: z.x, y: z.y, r: z.r, label: z.label || `${z.kind === 'hazard' ? 'Hazard' : 'Safe'} Zone ${id.slice(0, 3).toUpperCase()}`, by: this.selfName, ts: Date.now() }
    this.tx(() => { this.zones.set(id, zone) })
    return zone
  }

  updateZone(id: string, patch: Partial<Zone>) {
    const c = this.zones.get(id)
    if (c) this.tx(() => { this.zones.set(id, { ...c, ...patch, by: this.selfName, ts: Date.now() }) })
  }

  deleteZone(id: string) { this.tx(() => { this.zones.delete(id) }) }

  clearBoard() { this.tx(() => { this.pins.clear(); this.zones.clear() }) }

  loadPreset(id: string, origin = 'local') {
    const p = PRESETS.find((x) => x.id === id)
    if (!p) return
    this.tx(() => {
      this.pins.clear()
      this.zones.clear()
      this.meta.set('preset', id)
      p.seed.forEach((s, i) => {
        const pin: Pin = { id: `seed-${id}-${i}`, type: s[0], priority: s[1], status: 'OPEN', x: s[2], y: s[3], label: s[4], notes: 'Scenario asset', by: 'SCENARIO', ts: Date.now() }
        this.pins.set(pin.id, pin)
      })
      p.zones.forEach((z, i) => {
        const zone: Zone = { id: `seedz-${id}-${i}`, kind: z[0], x: z[1], y: z[2], r: z[3], label: z[4], by: 'SCENARIO', ts: Date.now() }
        this.zones.set(zone.id, zone)
      })
    }, origin)
  }

  setBlackout(b: boolean) {
    if (b === this.blackout) return
    this.blackout = b
    if (b) {
      for (const id of [...this.peers.keys()]) if (!this.localSim.has(id)) this.peers.delete(id)
      this.log('net', 'BLACKOUT · BroadcastChannel severed — edits persist to IndexedDB and queue locally')
      sfx.down()
    } else {
      this.log('net', `RECONNECT · flushing ${this.pending} buffered ops, requesting peer diffs`)
      this.pending = 0
      this.ch.postMessage({ t: 'u', from: this.selfId, name: this.selfName, u: Y.encodeStateAsUpdate(this.doc), ts: now() })
      this.ch.postMessage({ t: 'hello', from: this.selfId, name: this.selfName, sv: Y.encodeStateVector(this.doc), ts: now() })
      sfx.up()
    }
    this.touch()
  }

  /* ── field-peer simulator (virtual operatives + genuinely concurrent CRDT edits) ── */
  setSim(on: boolean) {
    if (on === this.simOn) return
    this.simOn = on
    if (on) {
      this.simPeers = SIM_NAMES.map((name, i) => ({
        id: `sim-${this.selfId}-${i}`, name, color: COLORS[(i * 2 + 1) % COLORS.length],
        x: rand(100, 900), y: rand(100, 600), tx: rand(60, 940), ty: rand(60, 640),
      }))
      this.simPeers.forEach((s) => this.localSim.add(s.id))
      this.simTimers = [window.setInterval(() => this.simMove(), 125), window.setInterval(() => this.simAct(), 1800)]
      this.log('sim', 'SIM · 4 virtual field operatives joined the mesh')
    } else {
      this.simTimers.forEach((t) => clearInterval(t))
      this.simTimers = []
      this.simPeers.forEach((s) => {
        this.peers.delete(s.id)
        this.ch.postMessage({ t: 'bye', from: this.selfId, id: s.id })
      })
      this.simPeers = []
      this.localSim.clear()
      this.log('sim', 'SIM · field operatives left the mesh')
    }
    this.touch()
  }

  private simMove() {
    this.simPeers.forEach((s) => {
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy)
      if (d < 14) { s.tx = rand(60, 940); s.ty = rand(60, 640) }
      else { s.x += (dx / d) * 14; s.y += (dy / d) * 14 }
      this.peers.set(s.id, { id: s.id, name: s.name, color: s.color, x: s.x, y: s.y, ts: Date.now(), sim: true })
      if (!this.blackout) this.ch.postMessage({ t: 'beat', from: this.selfId, id: s.id, name: s.name, color: s.color, x: s.x, y: s.y, sim: true, ts: now() })
    })
    this.touch()
  }

  private simAct() {
    if (!this.simPeers.length) return
    const s = pick(this.simPeers)
    const r = Math.random()
    if (this.pins.size > 40) {
      const old = [...this.pins.values()].find((p) => SIM_NAMES.includes(p.by))
      if (old) this.tx(() => { this.pins.delete(old.id) }, 'sim')
    }
    if (r < 0.45 || this.pins.size < 3) {
      const type = pick(PIN_TYPES)
      const r2 = Math.random()
      const pin: Pin = {
        id: rid(), type, priority: r2 < 0.2 ? 'CRITICAL' : r2 < 0.55 ? 'HIGH' : 'LOW', status: 'OPEN',
        x: Math.min(990, Math.max(10, s.x + rand(-20, 20))), y: Math.min(690, Math.max(10, s.y + rand(-20, 20))),
        label: `${type} · ${s.name}`, notes: `Field report from ${s.name}`, by: s.name, ts: Date.now(),
      }
      this.tx(() => { this.pins.set(pin.id, pin) }, 'sim')
    } else if (r < 0.75) {
      const cur = this.pins.get(pick([...this.pins.keys()]))
      if (!cur) return
      const patch: Partial<Pin> = pick<Partial<Pin>>([{ status: 'ASSIGNED' }, { status: 'RESOLVED' }, { priority: 'HIGH' }, { priority: 'CRITICAL' }, { notes: `Updated by ${s.name}` }])
      this.tx(() => { this.pins.set(cur.id, { ...cur, ...patch, by: s.name, ts: Date.now() }) }, 'sim')
    } else this.concurrentEdit()
  }

  /** Forks two replicas of the doc, edits the same pin on each, then merges both back: a real concurrent CRDT conflict. */
  private concurrentEdit() {
    const ids = [...this.pins.keys()]
    if (!ids.length || this.simPeers.length < 2) return
    const id = pick(ids)
    const cur = this.pins.get(id)
    if (!cur) return
    const [p1, p2] = [...this.simPeers].sort(() => Math.random() - 0.5)
    const base = Y.encodeStateAsUpdate(this.doc)
    const a = new Y.Doc()
    const b = new Y.Doc()
    Y.applyUpdate(a, base)
    Y.applyUpdate(b, base)
    const edit = (d: Y.Doc, who: string, patch: Partial<Pin>) => {
      const m = d.getMap<Pin>('pins')
      const c = m.get(id)
      if (c) m.set(id, { ...c, ...patch, by: who, ts: Date.now() })
    }
    edit(a, p1.name, { priority: 'CRITICAL', status: 'ASSIGNED' })
    edit(b, p2.name, { priority: 'LOW', status: 'RESOLVED' })
    const ua = Y.encodeStateAsUpdate(a)
    const ub = Y.encodeStateAsUpdate(b)
    Y.applyUpdate(this.doc, ua, 'sim')
    Y.applyUpdate(this.doc, ub, 'sim')
    a.destroy()
    b.destroy()
    const w = this.pins.get(id)
    this.log('conflict', `CONFLICT RESOLVED · "${cur.label}" edited concurrently by ${p1.name} ‖ ${p2.name} → ${w?.by ?? '?'} wins (Yjs clientID order), replicas converged`)
  }
}

export const mesh = new MeshEngine()

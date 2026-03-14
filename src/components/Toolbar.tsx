import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react'
import { useTransportState } from '../context/TransportContext'
import { useTransportActions } from '../context/TransportContext'

const MIN_BPM = 60
const MAX_BPM = 200

function clampBpm(value: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(value)))
}

export default function Toolbar() {
  const transport = useTransportState()
  const actions = useTransportActions()

  const [draggingBpm, setDraggingBpm] = useState(false)
  const bpmStartYRef = useRef(0)
  const bpmStartValueRef = useRef(transport.bpm)

  useEffect(() => {
    if (!draggingBpm) return

    const handleMouseMove = (event: MouseEvent) => {
      const dy = bpmStartYRef.current - event.clientY
      const delta = Math.round(dy / 2)
      actions.setBpm(clampBpm(bpmStartValueRef.current + delta))
    }

    const handleMouseUp = () => {
      setDraggingBpm(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingBpm, actions.setBpm])

  const handleBpmMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    bpmStartYRef.current = event.clientY
    bpmStartValueRef.current = transport.bpm
    setDraggingBpm(true)
  }

  const stepBpm = (delta: number) => {
    actions.setBpm(clampBpm(transport.bpm + delta))
  }

  const handlePanic = () => {
    actions.panic()
    window.__panicCount = (window.__panicCount ?? 0) + 1
  }

  const transportButtonStyle = {
    width: 34,
    height: 34,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    cursor: 'pointer',
    lineHeight: 1,
    background: 'linear-gradient(180deg, #3b3b4d 0%, #363647 52%, #333345 100%)',
    border: '1px solid',
    borderColor: '#8a8aa5 #5f5f75 #343447 #67677e',
    boxShadow: [
      '0 3px 8px rgba(0,0,0,0.42)',
      'inset 0 1px 0 rgba(255, 255, 255, 0.22)',
      'inset 0 2px 2px rgba(255,255,255,0.06)',
      'inset 0 -2px 3px rgba(0,0,0,0.38)',
      'inset 0 0 0 1px rgba(255,255,255,0.04)',
    ].join(', '),
  } as const
  const buttonSocketStyle = {
    display: 'inline-flex',
    padding: 1,
    borderRadius: 9,
    background: 'linear-gradient(180deg, #1a1a22 0%, #15151c 100%)',
    border: '1px solid rgba(0,0,0,0.45)',
    boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(255,255,255,0.03)',
  } as const

  return (
    <div
      className="toolbar"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--toolbar-height)',
        background: 'linear-gradient(180deg, #343440 0%, var(--color-surface) 100%)',
        borderBottom: '1px solid var(--color-border-strong)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-4)',
        zIndex: 100,
        boxSizing: 'border-box',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <span
        className="toolbar-app-name"
        style={{
          color: 'var(--color-accent)',
          fontWeight: 'bold',
          fontSize: 'var(--font-size-lg)',
          fontFamily: "'Courier New', Courier, monospace",
          flexShrink: 0,
        }}
      >
        SynthDemo
      </span>

      <div
        className="toolbar-transport"
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'center',
          marginLeft: 32,
          flexShrink: 0,
        }}
      >
        <span style={buttonSocketStyle}>
          <button
            className="toolbar-play-pause"
            onClick={actions.toggle}
            aria-pressed={transport.isPlaying}
            aria-label={transport.isPlaying ? 'Pause' : 'Play'}
            title={transport.isPlaying ? 'Pause' : 'Play'}
            style={{
              ...transportButtonStyle,
              background: transport.isPlaying
                ? 'linear-gradient(180deg, #4f8158 0%, #45734d 52%, #3e6746 100%)'
                : 'linear-gradient(180deg, #467b52 0%, #3f6f49 52%, #3a6543 100%)',
              borderColor: transport.isPlaying ? '#a0cea8 #77a780 #33553a #81b489' : '#8fbf98 #6f9f78 #2f4e35 #75a67e',
            }}
          >
            {transport.isPlaying ? (
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 3px rgba(181, 255, 198, 0.45)) drop-shadow(0 1px 0 rgba(0,0,0,0.45))' }}>
                <rect x="1" y="1" width="3" height="8" rx="0.8" fill="#d8ffe1" />
                <rect x="6" y="1" width="3" height="8" rx="0.8" fill="#d8ffe1" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" style={{ marginLeft: 1, filter: 'drop-shadow(0 0 3px rgba(179, 245, 198, 0.45)) drop-shadow(0 1px 0 rgba(0,0,0,0.45))' }}>
                <path d="M2 1.5L10 6L2 10.5V1.5Z" fill="#c8f6d6" />
              </svg>
            )}
          </button>
        </span>
        <span style={buttonSocketStyle}>
          <button
            className="toolbar-stop"
            onClick={actions.stop}
            aria-label="Stop"
            title="Stop"
            style={{
              ...transportButtonStyle,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 3px rgba(228, 234, 255, 0.4)) drop-shadow(0 1px 0 rgba(0,0,0,0.45))' }}>
              <rect x="1" y="1" width="8" height="8" rx="1.2" fill="#dce3ff" />
            </svg>
          </button>
        </span>
        <span style={buttonSocketStyle}>
          <button
            className="toolbar-loop"
            onClick={() => actions.setLoop(!transport.loop)}
            aria-pressed={transport.loop}
            aria-label="Loop"
            title="Loop"
            style={{
              ...transportButtonStyle,
              background: transport.loop
                ? 'linear-gradient(180deg, #6b5734 0%, #624f2f 52%, #5b492b 100%)'
                : transportButtonStyle.background,
              borderColor: transport.loop ? '#b39a6e #896e46 #503f23 #947852' : transportButtonStyle.borderColor,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" style={{ filter: `drop-shadow(0 0 3px ${transport.loop ? 'rgba(255, 220, 150, 0.5)' : 'rgba(218, 224, 245, 0.35)'}) drop-shadow(0 1px 0 rgba(0,0,0,0.45))` }}>
              <path d="M11.5 4.2V1.8l-2 2a4.8 4.8 0 1 0 1.5 4.7" fill="none" stroke={transport.loop ? '#ffe1a8' : '#d7dff3'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </span>
        <span style={buttonSocketStyle}>
          <button
            className="toolbar-panic"
            onClick={handlePanic}
            aria-label="Panic"
            title="Panic"
            style={{
              ...transportButtonStyle,
              background: 'linear-gradient(180deg, #804040 0%, #743838 52%, #6c3434 100%)',
              borderColor: '#bd7676 #975555 #5f2a2a #a15b5b',
            }}
          >
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 3px rgba(255, 172, 172, 0.5)) drop-shadow(0 1px 0 rgba(0,0,0,0.45))' }}>
              <rect x="4" y="1" width="2" height="7" rx="1" fill="#ffd2d2" />
              <circle cx="5" cy="10" r="1.2" fill="#ffd2d2" />
            </svg>
          </button>
        </span>
        <label
          style={{
            color: 'var(--color-text)',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 2,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            fontWeight: 700,
          }}
        >
          BPM
          <div
            style={{
              width: 64,
              height: 34,
              display: 'inline-flex',
              alignItems: 'stretch',
              background: '#17171d',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: 6,
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5)',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <div
              className="toolbar-bpm"
              role="spinbutton"
              aria-label="BPM"
              aria-valuemin={MIN_BPM}
              aria-valuemax={MAX_BPM}
              aria-valuenow={transport.bpm}
              onMouseDown={handleBpmMouseDown}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text)',
                borderRight: '1px solid #2b2b36',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'Orbitron', 'OCR A Std', 'Eurostile', 'Bank Gothic', 'JetBrains Mono', monospace",
                letterSpacing: 0.5,
                cursor: 'ns-resize',
                userSelect: 'none',
              }}
            >
              {transport.bpm}
            </div>
            <div
              style={{
                width: 16,
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(180deg, #2a2a34 0%, #24242d 100%)',
              }}
            >
              <button
                type="button"
                className="toolbar-bpm-step-up"
                onClick={() => stepBpm(1)}
                aria-label="Increase BPM"
                style={{
                  width: '100%',
                  height: '50%',
                  padding: 0,
                  border: 'none',
                  borderBottom: '1px solid #1c1c25',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)',
                  color: '#d7deef',
                  fontSize: 9,
                  lineHeight: 1,
                  cursor: 'pointer',
                  textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                }}
              >
                ▲
              </button>
              <button
                type="button"
                className="toolbar-bpm-step-down"
                onClick={() => stepBpm(-1)}
                aria-label="Decrease BPM"
                style={{
                  width: '100%',
                  height: '50%',
                  padding: 0,
                  border: 'none',
                  borderTop: '1px solid #333344',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.08) 100%)',
                  color: '#d7deef',
                  fontSize: 9,
                  lineHeight: 1,
                  cursor: 'pointer',
                  textShadow: '0 1px 0 rgba(0,0,0,0.35)',
                }}
              >
                ▼
              </button>
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}

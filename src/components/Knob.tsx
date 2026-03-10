import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  resetValue?: number
  formatValue?: (value: number) => string
  dataTestid?: string
}

const KNOB_MIN_ANGLE = -135
const KNOB_MAX_ANGLE = 135

export default function Knob({ label, min, max, value, onChange, resetValue, formatValue, dataTestid }: Props) {
  const [dragging, setDragging] = useState(false)
  const startYRef = useRef(0)
  const startValueRef = useRef(value)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
    startYRef.current = e.clientY
    startValueRef.current = value
  }, [value])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (resetValue === undefined) return
    e.preventDefault()
    onChange(clamp(resetValue))
  }, [clamp, onChange, resetValue])

  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dy = startYRef.current - e.clientY
      const range = max - min
      const delta = (dy / 100) * range
      onChange(clamp(startValueRef.current + delta))
    }

    const handleMouseUp = () => setDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, min, max, onChange])

  // Map value to rotation angle.
  const pct = (value - min) / (max - min)
  const angle = KNOB_MIN_ANGLE + pct * (KNOB_MAX_ANGLE - KNOB_MIN_ANGLE)

  const display = formatValue ? formatValue(value) : value.toFixed(2)
  const dotCount = 17
  const dotStart = KNOB_MIN_ANGLE
  const dotEnd = KNOB_MAX_ANGLE
  const dotRadius = 36

  return (
    <div
      className="knob-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        userSelect: 'none',
        width: 76,
        minWidth: 76,
      }}
      data-testid={dataTestid}
    >
      <div style={{ position: 'relative', width: 76, height: 76 }}>
        {Array.from({ length: dotCount }).map((_, i) => {
          const t = i / (dotCount - 1)
          const markerAngle = dotStart + (dotEnd - dotStart) * t
          const isCenter = i === Math.floor(dotCount / 2)
          const isEdge = i === 0 || i === dotCount - 1
          const isQuarter = i === Math.floor((dotCount - 1) * 0.25) || i === Math.floor((dotCount - 1) * 0.75)
          return (
            <div
              key={`dot-${i}`}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: isCenter ? 5 : isEdge ? 3.5 : isQuarter ? 3 : 2,
                height: isCenter ? 5 : isEdge ? 3.5 : isQuarter ? 3 : 2,
                borderRadius: '50%',
                background: isCenter
                  ? 'rgba(240, 238, 230, 0.9)'
                  : isEdge
                    ? 'rgba(191, 198, 210, 0.6)'
                    : isQuarter
                      ? 'rgba(191, 198, 210, 0.6)'
                    : 'rgba(191, 198, 210, 0.42)',
                boxShadow: isCenter ? '0 1px 3px rgba(0, 0, 0, 0.45)' : 'none',
                transform: `translate(-50%, -50%) rotate(${markerAngle}deg) translateY(-${dotRadius}px)`,
              }}
            />
          )
        })}

        <div
          className="knob"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            cursor: 'ns-resize',
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'transparent',
            boxShadow: dragging
              ? '0 6px 12px rgba(0,0,0,0.35)'
              : '0 7px 14px rgba(0,0,0,0.42)',
          }}
          title={resetValue === undefined ? undefined : 'Double-click to reset'}
        >
          {/* Dark chamfer */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #181f2d 0%, #0a0f18 100%)',
            }}
          />
          {/* Subtle micro-tooth ring */}
          <div
            style={{
              position: 'absolute',
              inset: 1,
              borderRadius: '50%',
              background: 'repeating-conic-gradient(from -90deg, rgba(76, 84, 100, 0.55) 0deg 1deg, rgba(8, 12, 19, 0.95) 1deg 3deg)',
              WebkitMask: 'radial-gradient(circle, transparent 72%, #000 77%)',
              mask: 'radial-gradient(circle, transparent 72%, #000 77%)',
              opacity: 0.32,
            }}
          />
          {/* Knob face with fixed top lighting */}
          <div
            style={{
              position: 'absolute',
              inset: 3,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #2d3546 0%, #1c2332 52%, #101623 100%)',
              border: '1px solid rgba(118, 128, 146, 0.2)',
              boxShadow: 'inset 0 -3px 5px rgba(0,0,0,0.38)',
            }}
          />
          {/* Fixed specular highlight */}
          <div
            style={{
              position: 'absolute',
              inset: 3,
              borderRadius: '50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 18%, rgba(255,255,255,0) 40%)',
              pointerEvents: 'none',
            }}
          />
          {/* Rotating notch ring + indicator */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `rotate(${angle}deg)`,
              transformOrigin: '50% 50%',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 2,
                transform: 'translateX(-50%)',
                width: 3,
                height: 21,
                borderRadius: 1,
                background: 'linear-gradient(180deg, #ff8a1d 0%, #ffb35a 6%, #fff8ee 12%, #ffd993 22%, #ff9d36 40%, #ff8417 68%, #ff7308 100%)',
                boxShadow: '0 0 5px rgba(255, 140, 28, 0.45)',
              }}
            />
          </div>
        </div>
      </div>
      <span
        className="knob-label"
        style={{
          color: '#b4bccb',
          fontSize: 12,
          fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
          fontWeight: 600,
          letterSpacing: 0.1,
          lineHeight: 1.1,
          width: '100%',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
      <span
        className="knob-value"
        style={{
          color: '#8f98aa',
          fontSize: 11,
          fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
          fontWeight: 500,
          lineHeight: 1.1,
          width: '100%',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {display}
      </span>
    </div>
  )
}

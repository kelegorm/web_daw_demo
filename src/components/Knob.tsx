import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  label: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
  dataTestid?: string
}

export default function Knob({ label, min, max, value, onChange, formatValue, dataTestid }: Props) {
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

  // Map value to rotation angle: -135 to +135 degrees
  const pct = (value - min) / (max - min)
  const angle = -135 + pct * 270

  const display = formatValue ? formatValue(value) : value.toFixed(2)

  return (
    <div
      className="knob-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        userSelect: 'none',
        width: 72,
        minWidth: 72,
      }}
      data-testid={dataTestid}
    >
      <div
        className="knob"
        onMouseDown={handleMouseDown}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #555, #222)',
          border: '2px solid #444',
          cursor: 'ns-resize',
          position: 'relative',
          transform: `rotate(${angle}deg)`,
          boxShadow: dragging ? '0 0 0 2px #2a7' : 'none',
        }}
      >
        {/* Indicator dot */}
        <div style={{
          position: 'absolute',
          top: 4,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: '#2a7',
        }} />
      </div>
      <span
        className="knob-label"
        style={{
          color: '#888',
          fontSize: 12,
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
          color: '#aaa',
          fontSize: 11,
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

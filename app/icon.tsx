import { ImageResponse } from 'next/og'

export const size = { width: 192, height: 192 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 192,
          height: 192,
          background: 'linear-gradient(135deg, #e8e0f0, #f0e0f0)',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Swirl accent */}
        <div
          style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a8b4f0, #c4a8e8, #e0a8d8)',
            opacity: 0.85,
            top: 20,
            left: 26,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'linear-gradient(225deg, #b8d0f0, #c8b0e8, #e8b0d0)',
            opacity: 0.7,
            top: 42,
            left: 46,
          }}
        />
        {/* Code braces */}
        <span
          style={{
            fontSize: 64,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            color: 'white',
            zIndex: 10,
            textShadow: '2px 2px 4px rgba(160,140,180,0.5)',
          }}
        >
          {'{ }'}
        </span>
      </div>
    ),
    { ...size }
  )
}

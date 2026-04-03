import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #e8e0f0, #f0e0f0)',
          borderRadius: 36,
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
            width: 130,
            height: 130,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a8b4f0, #c4a8e8, #e0a8d8)',
            opacity: 0.85,
            top: 18,
            left: 25,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 92,
            height: 92,
            borderRadius: '50%',
            background: 'linear-gradient(225deg, #b8d0f0, #c8b0e8, #e8b0d0)',
            opacity: 0.7,
            top: 40,
            left: 44,
          }}
        />
        {/* Code braces */}
        <span
          style={{
            fontSize: 60,
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

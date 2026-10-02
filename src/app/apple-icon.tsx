import { ImageResponse } from 'next/og';

// iOS home-screen icon: same mark as icon.tsx, larger canvas.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0907',
          color: '#EFE7DA',
          fontSize: 120,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        H
      </div>
    ),
    { ...size },
  );
}

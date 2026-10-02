import { ImageResponse } from 'next/og';

// The browser-tab icon. A stroked mark like the cleat reads as mud at 32px — a bold single
// letter is the thing that actually survives a tab bar, so this is the brand's own initial,
// not the cleat glyph used everywhere larger.
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          fontSize: 22,
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

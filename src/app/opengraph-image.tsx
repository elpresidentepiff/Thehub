import { ImageResponse } from 'next/og';

// The card that shows up when this link is pasted into Slack, iMessage, Twitter/X, etc.
// Built from the brand's own real words, not a screenshot of the cinematic opening (which is
// motion, and looks like nothing as a single frame).
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B0907',
          color: '#EFE7DA',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -1 }}>THE HUB</div>
        <div style={{ fontSize: 34, fontWeight: 600, marginTop: 8, color: '#C9BBA6' }}>@ LLOYDS WHARF</div>
        <div style={{ fontSize: 24, fontWeight: 500, marginTop: 36, color: '#9C8E7A', letterSpacing: 6 }}>
          ESTD 1857
        </div>
      </div>
    ),
    { ...size },
  );
}

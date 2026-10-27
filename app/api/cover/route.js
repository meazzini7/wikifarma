import { ImageResponse } from 'next/og';
import { coverSpec, COVER_SIZE } from '@/lib/cover';

export const runtime = 'edge';

const CATEGORIES = ['Farmaco', 'Benessere', 'Problemi Frequenti', 'Salute'];

// PNG della copertina (stessa grafica dell'SVG in pagina) per og:image e JSON-LD:
// WhatsApp/Facebook non leggono SVG. Risposta immutabile in cache sulla CDN.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get('t') || '').slice(0, 140);
  const category = CATEGORIES.includes(searchParams.get('c')) ? searchParams.get('c') : 'Benessere';
  const s = coverSpec(title, category);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '68px 70px',
          position: 'relative',
          backgroundImage: `linear-gradient(${s.angle}deg, ${s.c1}, ${s.c2})`,
          color: '#fff',
        }}
      >
        {s.shapes.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.cx - c.r,
              top: c.cy - c.r,
              width: c.r * 2,
              height: c.r * 2,
              borderRadius: c.r,
              background: '#fff',
              opacity: c.o,
            }}
          />
        ))}
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '10px 22px',
            borderRadius: 24,
            background: 'rgba(255,255,255,0.18)',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 2,
          }}
        >
          {s.label}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: s.size, fontWeight: 800, lineHeight: 1.12 }}>
          {s.lines.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      </div>
    ),
    {
      ...COVER_SIZE,
      headers: { 'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable' },
    }
  );
}

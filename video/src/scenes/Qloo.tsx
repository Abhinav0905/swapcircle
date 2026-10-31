import {Frame, Heading, Eyebrow} from '../Frame';
import {theme as t} from '../theme';
export const Qloo = () => <Frame chapter="Where Qloo would enter" label="Implemented integration · live request unverified"><Eyebrow>With a valid key and successful responses</Eyebrow><Heading size={62}>What you love →<br/><em>books already on the table.</em></Heading><div style={{display: 'flex', gap: 22, marginTop: 32}}>{[
  ['01', 'Resolve identities', 'GET /search', 'Favorite films, artists and books.'],
  ['02', 'Rank available books', 'GET /v2/insights', 'Only books other readers offered.'],
  ['03', 'Ask a useful question', 'Reading choice → plan', 'Returned evidence guides discovery.'],
].map(([n, title, endpoint, body]) => <div key={n} style={{flex: 1, padding: 24, background: t.paper, border: `1px solid ${t.line}`, borderRadius: 12}}><div style={{color: t.gold, fontSize: 20, marginBottom: 12}}>{n}</div><h2 style={{fontSize: 27, margin: '0 0 17px', fontWeight: 500}}>{title}</h2><div style={{fontFamily: 'monospace', fontSize: 20, color: t.pine, marginBottom: 15}}>{endpoint}</div><div style={{fontSize: 20, lineHeight: 1.35, color: t.muted}}>{body}</div></div>)}</div><div style={{marginTop: 22, fontSize: 21}}>filter.results.entities limits the pool. Real results could produce fewer exchanges.</div></Frame>;

import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Frame, Heading} from '../Frame';
import {ExchangeDiagram, ExchangeStats} from '../ExchangeDiagram';
import {Book} from '../Book';
export const Question = () => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig(); const reveal = f > 8 * fps;
  return <Frame chapter="02 · Ask one useful question"><Heading size={47}>{reveal ? 'One answer closes a bigger circle.' : 'Noor, would you read this one?'}</Heading>{!reveal ? <div style={{display: 'flex', alignItems: 'center', gap: 70, margin: '25px 80px'}}><Book title="A Psalm for the Wild-Built" author="Becky Chambers" color="#a27a45" width={230}/><div style={{maxWidth: 565}}><div style={{fontSize: 33, lineHeight: 1.35}}>A book from Jules's shelf.<br/>A missing link in the circle.</div><div style={{display: 'inline-block', background: '#214d3c', color: '#fffcf5', padding: '18px 30px', borderRadius: 9, marginTop: 28, fontSize: 28, opacity: interpolate(f, [3 * fps, 4 * fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>I'd read this ✓</div><div style={{fontSize: 19, marginTop: 16}}>Simulated reading choice. Not exchange approval.</div></div></div> : <div style={{display: 'flex', gap: 55, marginTop: 12}}><ExchangeDiagram stage="noor_accepts"/><ExchangeStats stage="noor_accepts" note="A four-person circle joins the original pair. Everyone still needs to approve."/></div>}</Frame>;
};

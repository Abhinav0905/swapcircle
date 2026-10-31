import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Frame, Heading, Eyebrow} from '../Frame';
import {Book} from '../Book';
export const Opening = () => {
  const f = useCurrentFrame(); const {fps} = useVideoConfig();
  return <Frame chapter="The problem"><div style={{display: 'flex', height: '100%', alignItems: 'center'}}><div style={{width: 590}}><Eyebrow>One book in. One book out.</Eyebrow><Heading size={78}>You want<br/>their book.<br/><em>They want<br/>someone else's.</em></Heading></div><div style={{width: 530, height: 430, position: 'relative'}}><Book title="The book you brought" color="#7e3544" width={185} style={{position: 'absolute', left: 25, top: 50, rotate: '-9deg'}}/><Book title="Your next favorite" color="#305e48" width={185} style={{position: 'absolute', right: 25, top: 140, rotate: '9deg'}}/><div style={{position: 'absolute', top: 5, right: 30, fontSize: 105, color: '#b88039', rotate: '-20deg', opacity: interpolate(f, [fps, 2*fps], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}}>↷</div></div></div></Frame>;
};

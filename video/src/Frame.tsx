import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme as t} from './theme';

export const Frame: React.FC<{chapter: string; children: React.ReactNode; dark?: boolean; label?: string}> = ({chapter, children, dark = false, label = 'Illustrated sample · Qloo unverified'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <AbsoluteFill style={{background: dark ? t.pine : t.cream, color: dark ? t.paper : t.ink, fontFamily: t.sans}}>
    <div style={{position: 'absolute', width: 740, height: 740, right: -310, top: -270, border: `1px solid ${dark ? '#ffffff20' : '#214d3c13'}`, borderRadius: '50%'}} />
    <div style={{position: 'absolute', left: 65, right: 65, top: 32, height: 43, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${dark ? '#ffffff30' : t.line}`, paddingBottom: 18}}>
      <div style={{fontSize: 26, fontWeight: 700, letterSpacing: -1}}>SwapCircle<span style={{color: '#d2a65d'}}>.</span><span style={{marginLeft: 23, fontSize: 15, letterSpacing: 1.5, fontWeight: 400, textTransform: 'uppercase', opacity: .75}}>{chapter}</span></div>
      <span style={{fontSize: 15, opacity: .85, letterSpacing: .3}}>{label}</span>
    </div>
    <div style={{position: 'absolute', left: 65, right: 65, top: 110, bottom: 122, opacity: interpolate(frame, [0, .35 * fps], [0, 1], {extrapolateRight: 'clamp'}), translate: `0 ${interpolate(frame, [0, .45 * fps], [12, 0], {extrapolateRight: 'clamp'})}px`}}>{children}</div>
    <div style={{position: 'absolute', left: 65, right: 65, bottom: 110, height: 1, background: dark ? '#ffffff26' : t.line}} />
  </AbsoluteFill>;
};

export const Heading: React.FC<{children: React.ReactNode; size?: number; style?: React.CSSProperties}> = ({children, size = 66, style}) => <h1 style={{fontFamily: t.serif, fontSize: size, fontWeight: 400, lineHeight: 1.06, letterSpacing: -2, margin: 0, ...style}}>{children}</h1>;
export const Eyebrow: React.FC<{children: React.ReactNode}> = ({children}) => <div style={{fontSize: 17, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20, color: t.gold, fontWeight: 700}}>{children}</div>;

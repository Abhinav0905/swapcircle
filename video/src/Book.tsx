import React from 'react';
import {theme as t} from './theme';

export const Book: React.FC<{title: string; author?: string; color: string; width?: number; style?: React.CSSProperties}> = ({title, author, color, width = 210, style}) => <div style={{width, height: width * 1.35, padding: width * .13, boxSizing: 'border-box', background: color, color: '#fffbef', borderRadius: '3px 10px 10px 3px', boxShadow: '10px 15px 24px #16372a24, inset 9px 0 1px #00000017', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ...style}}>
  <div style={{fontSize: width * .07, letterSpacing: 2, opacity: .8}}>SWAPCIRCLE LIBRARY</div>
  <div style={{fontFamily: t.serif, fontSize: width * .145, lineHeight: 1.08}}>{title}</div>
  <div style={{fontSize: width * .07, lineHeight: 1.4, borderTop: '1px solid #ffffff60', paddingTop: width * .09}}>{author || 'A new chapter awaits'}</div>
</div>;

import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import evidence from './data/evidence.json';
import {theme as t} from './theme';

const places: Record<string, [number, number]> = {maya: [20, 20], leo: [300, 20], noor: [300, 265], jules: [20, 265], iris: [575, 20], sam: [575, 265]};
export const ExchangeDiagram: React.FC<{stage: string}> = ({stage}) => {
  const frame = useCurrentFrame(); const {fps} = useVideoConfig();
  const snapshot = evidence.stages.find(item => item.id === stage)!;
  return <div style={{position: 'relative', width: 790, height: 435}}>
    <svg width="790" height="435" style={{position: 'absolute', inset: 0}}>
      <defs><marker id={`arrow-${stage}`} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M1 1 L7 4.5 L1 8" fill="none" stroke={t.pine} strokeWidth="1.6" /></marker></defs>
      {snapshot.cycles.flatMap(cycle => cycle.trades).map((trade, index) => {
        const a = places[trade.giverId], b = places[trade.recipientId];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const distance = Math.sqrt(dx * dx + dy * dy);
        const trim = dx === 0 ? 80 : dy === 0 ? 102 : 100;
        const pairOffset = trade.giverId === 'iris' ? -14 : trade.giverId === 'sam' ? 14 : 0;
        return <path key={trade.giverId} d={`M${a[0] + 90 + dx / distance * trim + pairOffset},${a[1] + 65 + dy / distance * trim} L${b[0] + 90 - dx / distance * trim + pairOffset},${b[1] + 65 - dy / distance * trim}`} fill="none" stroke={t.pine} strokeWidth="3.5" markerEnd={`url(#arrow-${stage})`} pathLength={1} strokeDasharray={1} strokeDashoffset={interpolate(frame, [index * .08 * fps, (index * .08 + .65) * fps], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />;
      })}
    </svg>
    {evidence.members.map(member => {
      const available = snapshot.availableMemberIds.includes(member.id);
      const matched = snapshot.matchedMemberIds.includes(member.id);
      const approved = snapshot.approvedMemberIds.includes(member.id);
      return <div key={member.id} style={{position: 'absolute', left: places[member.id][0], top: places[member.id][1], width: 180, minHeight: 130, boxSizing: 'border-box', padding: '15px 17px', background: t.paper, border: `2px solid ${matched ? t.pine : t.line}`, borderRadius: 12, opacity: available ? 1 : .35, boxShadow: '0 5px 15px #17372809'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 9, fontSize: 23, fontWeight: 700, marginBottom: 12}}><span style={{width: 27, height: 27, background: member.color, borderRadius: '50%', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{member.name[0]}</span>{member.name}<span style={{marginLeft: 'auto', fontSize: 20, color: t.pine}}>{approved ? '✓' : ''}</span></div>
        <div style={{fontFamily: t.serif, fontSize: 21, lineHeight: 1.15, color: t.ink}}>{member.book.title}</div>
        {!available && <div style={{position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 19, fontWeight: 700, background: '#f6f2e9aa'}}>Stepped out</div>}
      </div>;
    })}
    <div style={{position: 'absolute', left: 20, bottom: 0, color: t.muted, fontSize: 14}}>Arrows show books moving to their next reader.</div>
  </div>;
};

export const ExchangeStats: React.FC<{stage: string; note: string}> = ({stage, note}) => {
  const snapshot = evidence.stages.find(item => item.id === stage)!;
  return <div style={{width: 270, paddingTop: 8}}><div style={{fontSize: 122, fontFamily: t.serif, lineHeight: .95, color: t.pine}}>{snapshot.matchedCount}</div><div style={{fontSize: 26, lineHeight: 1.3, marginTop: 12}}>readers with<br/>proposed exchanges</div><div style={{marginTop: 28, paddingTop: 20, borderTop: `1px solid ${t.line}`, fontSize: 20, lineHeight: 1.5}}><b>{snapshot.directSwapCount}</b> in direct swaps<br/><b>{snapshot.approvalCount}</b> simulated approvals</div><p style={{fontSize: 20, lineHeight: 1.35, color: t.muted, marginTop: 20}}>{note}</p></div>;
};

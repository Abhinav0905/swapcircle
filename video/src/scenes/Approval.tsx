import {Frame, Heading} from '../Frame';
import {ExchangeDiagram, ExchangeStats} from '../ExchangeDiagram';
export const Approval = () => <Frame chapter="03 · Approve the exact exchange"><Heading size={47}>A reading choice is not an approval.</Heading><div style={{display: 'flex', gap: 55, marginTop: 12}}><ExchangeDiagram stage="all_approved"/><ExchangeStats stage="all_approved" note="Six exact trades approved. Handoff cards are available."/></div></Frame>;

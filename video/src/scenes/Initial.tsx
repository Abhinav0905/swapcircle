import {Frame, Heading} from '../Frame';
import {ExchangeDiagram, ExchangeStats} from '../ExchangeDiagram';
export const Initial = () => <Frame chapter="01 · Start with two"><Heading size={47}>Six books. One direct swap.</Heading><div style={{display: 'flex', gap: 55, marginTop: 12}}><ExchangeDiagram stage="initial_rank"/><ExchangeStats stage="initial_rank" note="Iris and Sam are ready to consider a swap. Four readers are waiting."/></div></Frame>;

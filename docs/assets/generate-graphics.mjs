import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const colors = { paper:'#f6f3eb', card:'#fffcf6', ink:'#24372d', pine:'#2d5942', muted:'#73786c', line:'#dedfd2', sage:'#e8ede1', gold:'#ba8650', pale:'#e7e6dc' };
const escape = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, content, size=20, options='') => `<text x="${x}" y="${y}" font-size="${size}" ${options}>${escape(content)}</text>`;
const line = (x1,y1,x2,y2,color=colors.line,width=1,options='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${options}/>`;
const defs = `<defs>
<marker id="arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M2 2 L9 6 L2 10" fill="none" stroke="${colors.pine}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker>
<linearGradient id="booklight" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".09" stop-color="#fff" stop-opacity="0"/><stop offset=".12" stop-color="#fff" stop-opacity=".12"/><stop offset=".22" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="wash" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ece4d3"/><stop offset="1" stop-color="#e4eadc"/></radialGradient>
</defs>`;
const wrap = (w,h,title,description,body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title description"><title id="title">${escape(title)}</title><desc id="description">${escape(description)}</desc>${defs}<rect width="${w}" height="${h}" fill="${colors.paper}"/><g fill="${colors.ink}" font-family="Arial, Helvetica, sans-serif">${body}</g></svg>`;
function brand(x,y,scale=1) {
 return `<g transform="translate(${x},${y}) scale(${scale})"><circle cx="18" cy="18" r="18" fill="${colors.pine}"/><path d="M27 10A12 12 0 1 0 28 25M27 5V12H20" fill="none" stroke="${colors.paper}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>${text(49,27,'SwapCircle',27,'font-weight="700" letter-spacing="-1.3"')}<circle cx="193" cy="24" r="3" fill="${colors.gold}"/></g>`;
}
function book(x,y,angle,color,title,ornament=0) {
 const decoration = ornament===0 ? '<circle cx="61" cy="100" r="27"/><path d="M31 119Q61 53 91 119M40 119Q61 72 82 119M28 119H94"/>' : ornament===1 ? '<path d="M32 122L61 77L90 122ZM43 111L61 83L79 111M61 77V123M32 122H90"/><circle cx="61" cy="96" r="26"/>' : '<path d="M30 110Q43 70 61 110Q79 70 92 110M30 110Q43 150 61 110Q79 150 92 110M29 110H93"/><circle cx="61" cy="110" r="26"/>';
 return `<g transform="translate(${x},${y}) rotate(${angle},61,88)"><rect x="7" y="7" width="122" height="176" rx="4" fill="#293b2a" opacity=".08"/><path d="M4 0H119Q127 0 127 7V169Q127 176 119 176H4" fill="#c8c0a8"/><path d="M5 2H119Q124 2 124 7V169Q124 173 119 173H5" fill="#ece3ca"/><path d="M6 7H122M6 12H122M6 164H122M6 168H122" stroke="#c8c0a8" stroke-width=".7"/><rect width="122" height="172" rx="3" fill="${color}"/><rect width="122" height="172" rx="3" fill="url(#booklight)"/><path d="M11 0V172" stroke="#0c241c" opacity=".2"/><g fill="#f7edcb" text-anchor="middle">${text(64,30,'THE CIRCLE EDITION',5.5,'letter-spacing="1.2"')}${text(64,57,title,19,'font-family="Georgia, serif"')}<g fill="none" stroke="#f7edcb" stroke-width=".8" opacity=".75">${decoration}</g>${text(64,151,'PASS THE STORY ON',5.5,'letter-spacing="1.1"')}</g></g>`;
}
let cover = brand(72,62);
cover += line(72,125,1128,125);
cover += text(74,209,'A BOOK SWAP, WITH EVERYONE IN THE LOOP.',11,'letter-spacing="2.1" font-weight="700" fill="#73786c"');
cover += text(70,311,'Good books,',79,'font-family="Georgia, serif" letter-spacing="-3.5"');
cover += text(70,401,'full circle.',79,'font-family="Georgia, serif" font-style="italic" letter-spacing="-3.5" fill="#2d5942"');
cover += text(75,462,'Find a circle of readers.',22,'fill="#626f60"');
cover += text(75,498,'Choose a book. Say yes together.',22,'fill="#626f60"');
cover += `<circle cx="902" cy="405" r="216" fill="url(#wash)" stroke="#dedfd2"/>
<path d="M912 202Q1090 215 1102 380M1060 523Q965 656 804 568M722 466Q661 301 799 240" fill="none" stroke="${colors.pine}" stroke-width="1.8" stroke-dasharray="5 7" marker-end="url(#arrow)"/>`;
cover += book(806,165,-11,'#2e5944','STORIES',0);
cover += book(1014,362,10,'#9d7954','WORLDS',1);
cover += book(745,443,-6,'#796c79','WONDER',2);
cover += `<g transform="translate(909,403) rotate(-5)"><circle r="63" fill="#f2dfac" stroke="#e6d19e"/><path transform="translate(0,-10)" d="M-14-22A19 19 0 1 1-19-2M-23-22H-14V-13" fill="none" stroke="#8c6d38" stroke-width="1.3" stroke-linejoin="round"/>${text(0,18,'One book in.',15,'font-family="Georgia, serif" text-anchor="middle" fill="#6b5633"')}${text(0,39,'One book out.',15,'font-family="Georgia, serif" text-anchor="middle" fill="#6b5633"')}</g>`;
cover += `<g transform="translate(76,595)">${text(0,20,'Taste',18,'font-weight="600"')}<path d="M67 14H109M103 8L110 14L103 20" fill="none" stroke="#8f9b83" stroke-width="1.5"/>${text(128,20,'Choice',18,'font-weight="600"')}<path d="M211 14H253M247 8L254 14L247 20" fill="none" stroke="#8f9b83" stroke-width="1.5"/>${text(272,20,'Approval',18,'font-weight="600"')}</g>`;
cover += line(72,701,1128,701);
cover += text(74,744,'Give a story another chapter.',20,'font-family="Georgia, serif" font-style="italic" fill="#677361"');
cover += text(1128,741,'YOUR BOOKS. YOUR CHOICE.',10,'text-anchor="end" letter-spacing="1.7" fill="#73786c"');
cover = wrap(1200,800,'SwapCircle — Good books, full circle.','Original illustrated book forms form a circle. Taste leads to choice, then approval. This is a cover graphic, not an application screenshot.',cover);

const node = (x,y,label,active,withdrawn=false) => `<circle cx="${x}" cy="${y}" r="20" fill="${active ? '#dfe8d6' : '#f0eee5'}" stroke="${active ? '#a8bea0' : '#d7d9ca'}" stroke-width="1.2" ${withdrawn ? 'stroke-dasharray="3 3"' : ''}/>${text(x,y+5,label,13,`text-anchor="middle" font-weight="600" fill="${active ? colors.pine : '#9a9e8e'}"`)}${withdrawn ? line(x-18,y+21,x+18,y-21,'#aa987c',1.6) : ''}`;
const edge = (x1,y1,x2,y2) => {
 const a = Math.atan2(y2-y1,x2-x1), gap = 27;
 return line(x1+Math.cos(a)*gap,y1+Math.sin(a)*gap,x2-Math.cos(a)*gap,y2-Math.sin(a)*gap,colors.pine,1.7,'marker-end="url(#arrow)"');
};
function stage(x,number,label,subtitle,stageIndex) {
 const width=334, y=294;
 let s = `<rect x="${x}" y="${y}" width="${width}" height="426" rx="10" fill="${stageIndex===1 ? '#edf0e5' : colors.card}" stroke="${colors.line}"/>`;
 s += text(x+24,y+35,`0${stageIndex+1}`,12,'letter-spacing="1.4" fill="#8b957e"');
 s += text(x+25,y+116,String(number),76,'font-family="Georgia, serif" letter-spacing="-3" fill="#2d5942"');
 s += text(x+91,y+102,'matched',14,'fill="#73786c"');
 s += text(x+91,y+122,'readers',14,'fill="#73786c"');
 s += text(x+25,y+164,label,22,'font-family="Georgia, serif" letter-spacing="-.4"');
 s += text(x+25,y+193,subtitle,14,'fill="#73786c"');
 const A={x:x+80,y:y+244}, B={x:x+250,y:y+244}, C={x:x+250,y:y+311}, D={x:x+80,y:y+311};
 if(stageIndex===1) s += edge(A.x,A.y,D.x,D.y)+edge(D.x,D.y,C.x,C.y)+edge(C.x,C.y,B.x,B.y)+edge(B.x,B.y,A.x,A.y);
 if(stageIndex===3) s += edge(A.x,A.y,D.x,D.y)+edge(D.x,D.y,B.x,B.y)+edge(B.x,B.y,A.x,A.y);
 s += node(A.x,A.y,'M',stageIndex===1||stageIndex===3)+node(B.x,B.y,'L',stageIndex===1||stageIndex===3)+node(C.x,C.y,'N',stageIndex===1,stageIndex>=2)+node(D.x,D.y,'J',stageIndex===1||stageIndex===3);
 const iy=y+377;
 s += `<path d="M${x+139} ${iy-9}Q${x+167} ${iy-30} ${x+196} ${iy-9}" fill="none" stroke="${colors.pine}" stroke-width="1.7" marker-end="url(#arrow)"/><path d="M${x+196} ${iy+9}Q${x+167} ${iy+30} ${x+139} ${iy+9}" fill="none" stroke="${colors.pine}" stroke-width="1.7" marker-end="url(#arrow)"/>`;
 s += node(x+111,iy,'I',true)+node(x+223,iy,'S',true);
 return s;
}
let flow=brand(70,51,.9);
flow += text(1530,76,'THE SAMPLE, STEP BY STEP',12,'text-anchor="end" letter-spacing="2" fill="#73786c"');
flow += line(70,114,1530,114);
flow += text(68,195,'One answer can close a circle.',63,'font-family="Georgia, serif" letter-spacing="-2.4"');
flow += text(71,244,'Each matched reader gives one book and receives one. Every exact exchange still needs approval.',21,'fill="#626f60"');
flow += stage(70,2,'A direct swap','Iris and Sam form a pair.',0);
flow += stage(445,6,'Noor says she would read it','A four-person circle can close.',1);
flow += stage(820,2,'Noor steps out','Her circle and approvals clear.',2);
flow += stage(1195,5,'Leo answers the next question','A three-person circle replaces it.',3);
for(const x of [423,798,1173]) flow += `<path d="M${x-10} 399H${x+10}M${x+3} 392L${x+10} 399L${x+3} 406" fill="none" stroke="#8d997f" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
flow += text(70,759,'M Maya / L Leo / N Noor / J Jules / I Iris / S Sam',14,'fill="#73786c"');
flow += text(1530,759,'Arrows show book handoffs. Iris and Sam keep their unchanged pair.',14,'text-anchor="end" fill="#73786c"');
flow += `<rect x="70" y="794" width="1460" height="60" rx="7" fill="#e8ede1"/>`;
flow += text(91,819,'Illustrative sample. Authored rankings and simulated responses.',16,'font-weight="600" fill="#44573e"');
flow += text(91,843,'Changed circles need fresh approvals. These counts describe this fixture, not measured reader benefit.',14,'fill="#637159"');
flow = wrap(1600,900,'SwapCircle sample: 2 to 6 to 2 to 5 matched readers.','Four illustrated stages show an authored six-reader fixture. A direct pair, a new four-person circle, a withdrawal, then a repaired three-person circle. Reading choices are separate from exact-trade approvals. Illustrative sample. Authored rankings and simulated responses.',flow);

await fs.writeFile(path.join(here,'swapcircle-cover.svg'),cover);
await fs.writeFile(path.join(here,'swapcircle-sample-flow.svg'),flow);
await sharp(Buffer.from(cover)).png().toFile(path.join(here,'swapcircle-cover.png'));
await sharp(Buffer.from(flow)).png().toFile(path.join(here,'swapcircle-sample-flow.png'));
await fs.copyFile(path.join(here,'swapcircle-cover.svg'),path.join(root,'public/og-card.svg'));
await fs.copyFile(path.join(here,'swapcircle-cover.png'),path.join(root,'public/og-card.png'));
console.log('Generated 1200x800 cover and 1600x900 sample diagram; copied cover to public/og-card.svg and .png.');

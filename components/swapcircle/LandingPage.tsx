import { ArrowUpRight, ArrowRight, BookOpen, Sparkles, Check, CircleHelp, Heart, Users, MoveUpRight, Play } from "lucide-react";
import { DemoFactory } from "@/lib/demo/DemoFactory";
import { BookCover } from "./BookCover";

export function LandingPage({ onDemo, onCreate, busy, configured }: { onDemo: () => void; onCreate: () => void; busy: boolean; configured: boolean }) {
  const readers = DemoFactory.members();
  return <>
    <main className="landing">
      <section className="hero">
        <div className="hero-copy"><span className="eyebrow"><span className="tiny-line" /> GOOD STORIES DESERVE ANOTHER READER</span><h1>Good books.<br />New people.<br /><em>Full circle.</em></h1><p>The book on your shelf could be someone's next favorite. Find it a new home, and a new read for you, with a circle of people who all say yes.</p>
          <div className="hero-actions"><button className="button primary large" onClick={onDemo} disabled={busy}>{busy ? "Opening your circle…" : "Try a sample circle"}<ArrowUpRight size={19} /></button><a className="button secondary" href="/walkthrough"><Play size={15} aria-hidden="true" /> Watch the walkthrough</a><button className="button plain" onClick={onCreate}>Start your own <ArrowRight size={17} /></button></div>
          <div className="hero-footnote"><div className="avatar-stack">{readers.slice(0, 4).map((reader) => <span key={reader.id} style={{ background: reader.color }}>{reader.name[0]}</span>)}</div><p>One book in. One book out.<br /><strong>Every reader has a say.</strong></p></div>
        </div>
        <div className="hero-art" aria-label="Illustration of a three-person book exchange">
          <div className="hero-paper-circle" />
          <svg viewBox="0 0 520 550" className="hero-arrows" aria-hidden="true"><defs><marker id="hero-arrow" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M2 2l8 4-8 4" fill="none" stroke="#315F4A" strokeWidth="1.5" /></marker></defs><path d="M190 116Q382 33 424 246M427 324Q337 508 151 414M97 343Q47 219 139 159" stroke="#315F4A" strokeWidth="2" strokeDasharray="5 6" fill="none" markerEnd="url(#hero-arrow)" /></svg>
          {[0, 1, 2].map((index) => <div className={`hero-book hero-book-${index}`} key={index}><BookCover book={readers[index].offer} /><div className="hero-reader"><span style={{ background: readers[index].color }}>{readers[index].name[0]}</span>{readers[index].name}'s shelf</div></div>)}
          <div className="hero-sticker"><span>↺</span><strong>A little give.<br />A lovely get.</strong></div>
          <span className="art-note">No direct swap? Find a bigger circle.</span>
        </div>
      </section>
      <div className="trust-strip"><span><Sparkles size={17} /> Taste-led discovery</span><span><Users size={17} /> Groups of 2–8 readers</span><span><Check size={17} /> Your books. Your choice.</span></div>
      <section className="how-section" id="how-it-works"><div className="section-intro"><span className="eyebrow">MORE THAN A TWO-WAY SWAP</span><h2>A good trade doesn't<br />have to be a straight line.</h2><p>You want Leo's book. Leo wants Noor's. Noor wants yours. SwapCircle finds the connection and helps everyone agree on the exact exchange.</p></div><div className="step-cards">
        <article><span className="step-number">01</span><BookOpen size={24} /><h3>Bring a book.<br />Bring your taste.</h3><p>Offer one book and share a few films, artists or stories you love.</p></article>
        <article><span className="step-number">02</span><Heart size={24} /><h3>Discover.<br />Then decide.</h3><p>Qloo suggests books from your group's shelves. You choose which you'd read.</p></article>
        <article><span className="step-number">03</span><Users size={24} /><h3>Close the circle.<br />Pass it on.</h3><p>Approve your exact trade. Meet together when the whole circle is ready.</p></article>
      </div></section>
      <section className="question-feature"><div className="question-visual"><span className="eyebrow">THE NEXT GOOD QUESTION</span><div className="question-quote">"Noor, would you<br />read this one?"</div><p>One answer could connect four readers.</p><span className="sample-badge">Illustrative scenario</span></div><div><h2>Sometimes, the missing<br />piece is one <em>yes.</em></h2><p>When a circle won't close, the agent looks for a useful next question. It asks someone to consider a ranked book that could complete an exchange.</p><p>A pass stays a pass. If nothing works, your book stays with you.</p><button className="text-button" onClick={onDemo} disabled={busy}>See it happen in the sample circle <ArrowUpRight size={17} /></button></div></section>
      <div className="honesty-note"><CircleHelp size={19} /><p>The sample circle uses fictional readers, authored rankings and simulated approvals. Live circles use Qloo's cultural taste data. Suggestions never count as consent.</p><span className={`service-status ${configured ? "online" : ""}`}><i />{configured ? "Live Qloo configured" : "Live Qloo access pending"}</span></div>
    </main>
    <footer className="site-footer"><span className="brand small-brand"><span className="brand-mark">s<span>↗</span></span>SwapCircle</span><p>Give a story another chapter.</p><a href="/about">About & privacy <ArrowUpRight size={13} /></a></footer>
  </>;
}

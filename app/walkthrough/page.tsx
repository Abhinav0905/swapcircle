import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, BookOpen, Code2 } from "lucide-react";
import styles from "./walkthrough.module.css";

export const metadata: Metadata = {
  title: "Watch the walkthrough | SwapCircle",
  description: "An illustrated walkthrough of SwapCircle's sample book exchange, with explicit reading choices, exact-trade approvals and repair after a withdrawal. Live Qloo access remains unverified.",
};

const steps = [
  { count: "2", title: "A pair can swap", description: "Iris and Sam want each other's books. The other four readers do not yet have a closed circle." },
  { count: "6", title: "One answer connects four", description: "Noor accepts a suggested book. A four-person circle becomes possible alongside the pair. Everyone still needs to approve their exact trade." },
  { count: "2", title: "A withdrawal changes the plan", description: "Noor steps out. Her circle is removed and its approvals are cleared. Iris and Sam's unchanged, approved pair stays intact." },
  { count: "5", title: "A new choice repairs it", description: "Leo answers the next reading question. A new three-person circle forms, with fresh approvals required." },
];

export default function WalkthroughPage() {
  return <div className={styles.page}>
    <header className={styles.header}>
      <a className="brand" href="/" aria-label="SwapCircle home"><span className="brand-mark" aria-hidden="true">s<span>↗</span></span>SwapCircle<span className="brand-dot">.</span></a>
      <a className={styles.backLink} href="/"><ArrowLeft size={16} aria-hidden="true" /> Back to the app</a>
    </header>
    <main className={styles.main}>
      <div className={styles.intro}>
        <span className={styles.eyebrow}>THE SWAPCIRCLE WALKTHROUGH</span>
        <h1>One book in.<br /><em>Every reader has a say.</em></h1>
        <p>Follow six readers as one choice closes an exchange, a withdrawal changes it and a new answer helps the group try again.</p>
      </div>

      <section className={styles.disclosure} aria-labelledby="sample-note">
        <strong id="sample-note">Illustrated sample. Live Qloo access is unverified.</strong>
        <p>These scenes illustrate the working sample, checked through the hosted app&apos;s API. This is not a screen recording. The readers are fictional, the rankings are authored and the choices and approvals are simulated. We requested Qloo access, but no API key was available.</p>
      </section>

      <figure className={styles.player}>
        <video controls preload="metadata" playsInline poster="/walkthrough-poster.jpg" aria-label="SwapCircle illustrated sample walkthrough" aria-describedby="video-description">
          <source src="/swapcircle-walkthrough.mp4" type="video/mp4" />
          <track kind="captions" src="/swapcircle-walkthrough.vtt" srcLang="en" label="English" />
          Your browser cannot play this video. <a href="/swapcircle-walkthrough.mp4">Open the MP4 walkthrough.</a>
        </video>
        <figcaption id="video-description"><span>English captions are included in the video. The story is also described below.</span><a href="/swapcircle-walkthrough.mp4">Open video <ArrowUpRight size={14} aria-hidden="true" /></a></figcaption>
      </figure>

      <section className={styles.story} aria-labelledby="story-title">
        <div className={styles.sectionHeading}><span className={styles.eyebrow}>THE SAMPLE, IN FOUR MOMENTS</span><h2 id="story-title">Plans can change.<br /><em>Consent has to keep up.</em></h2><p>The numbers count readers with a proposed exchange, not completed handoffs or measured gains from Qloo.</p></div>
        <ol className={styles.steps}>
          {steps.map((step) => <li key={`${step.count}-${step.title}`}><div className={styles.count}><strong>{step.count}</strong><span>readers matched</span></div><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}
        </ol>
      </section>

      <section className={styles.qloo} aria-labelledby="qloo-title">
        <div><span className={styles.eyebrow}>WHERE CULTURAL TASTE FITS</span><h2 id="qloo-title">Discovery comes<br /><em>before the want list.</em></h2></div>
        <div><p>A reader may know the films and music they love without recognizing any book on the table. Qloo is intended to help with that first discovery step.</p><p>The implemented server client is designed to resolve those favorites and rank only the other available books once a valid key is configured. Its live search and ranking path has not been verified. The sample cannot establish what Qloo would recommend or whether a real reader would enjoy it.</p><p className={styles.principle}>A suggestion is not a reading choice. A reading choice is not permission to exchange a book.</p></div>
      </section>

      <div className={styles.actions}>
        <a className="button primary large" href="https://swapcircle-books.abhinav-0905.chatgpt.site"><BookOpen size={18} aria-hidden="true" /> Try the working app <ArrowUpRight size={17} aria-hidden="true" /></a>
        <a className="button secondary large" href="https://github.com/Abhinav0905/swapcircle" target="_blank" rel="noreferrer"><Code2 size={18} aria-hidden="true" /> Explore the MIT source <ArrowUpRight size={17} aria-hidden="true" /></a>
      </div>
      <p className={styles.closing}>Choose &quot;Try a sample circle&quot; in the app to make the decisions yourself. <a href="/about">Read the project and privacy notes.</a></p>
    </main>
    <footer className={styles.footer}><span>SwapCircle</span><p>Good books deserve another reader.</p></footer>
  </div>;
}

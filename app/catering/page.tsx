import type { Metadata } from "next";
import Link from "next/link";
import { CateringForm } from "./CateringForm";
import { UiIcon } from "../components/UiIcon";
import "./catering.css";

export const metadata: Metadata = {
  title: "Gaziantep Catering Talebi",
  description: "Gaziantep'te nişan, kına, gelin odası, kurumsal toplantı ve özel etkinlikler için Bonj Cake Story catering talep formu.",
  alternates: { canonical: "/catering" },
};

export default function CateringPage() {
  return (
    <main className="catering-page">
      <section className="catering-hero">
        <div className="catering-intro">
          <span className="catering-kicker">BONJ / CATERING STUDIO</span>
          <h1>Davetin<br /><em>tadı.</em></h1>
          <p>İlk görüşmeyi hızlandıracak birkaç detayı paylaş; menüyü, servisi ve sunumu birlikte şekillendirelim.</p>
          <div className="catering-promise">
            <article><strong>01</strong><span>İhtiyacını anlat</span></article>
            <article><strong>02</strong><span>Bonj seni arasın</span></article>
            <article><strong>03</strong><span>Teklifin netleşsin</span></article>
          </div>
          <Link href="/menu">Menüyü incele <span><UiIcon name="arrow-up-right" /></span></Link>
        </div>

        <div className="catering-form-shell">
          <CateringForm />
        </div>
      </section>

      <section className="catering-services" aria-labelledby="catering-services-title">
        <div>
          <span className="catering-kicker">KÜÇÜK BULUŞMADAN BÜYÜK DAVETE</span>
          <h2 id="catering-services-title">Her masanın<br /><em>başka bir hikâyesi var.</em></h2>
        </div>
        <div className="catering-service-grid">
          <article><span>01</span><h3>Özel günler</h3><p>Gelin odası, söz, nişan, kına, düğün, doğum günü ve kutlamalar.</p></article>
          <article><span>02</span><h3>Kurumsal</h3><p>Toplantı, lansman, açılış, eğitim, workshop ve ekip buluşmaları.</p></article>
          <article><span>03</span><h3>Bonj dokunuşu</h3><p>Cheesecake masası, brunch, kahve barı, soğuk içecekler ve paketli ikramlar.</p></article>
        </div>
      </section>
    </main>
  );
}

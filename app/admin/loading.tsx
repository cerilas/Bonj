import { BrandLogo } from "../components/BrandLogo";

export default function AdminLoading() {
  return (
    <main className="admin-page-loader is-visible is-initial" role="status" aria-live="polite">
      <div className="admin-page-loader-card">
        <span className="admin-page-loader-mark" aria-hidden="true"><BrandLogo className="admin-loader-logo bonj-brand-logo--light" alt="" /></span>
        <div>
          <strong>CAKE STORY</strong>
          <small>Yönetim paneli hazırlanıyor</small>
          <i aria-hidden="true"><b /></i>
        </div>
      </div>
    </main>
  );
}

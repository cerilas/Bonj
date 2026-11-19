"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthModal } from "../components/AuthModal";
import { useUser } from "@/lib/use-user";

export function GirisExperience() {
  const { user, isLoggedIn, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoggedIn && user) {
      router.push("/hesabim");
    }
  }, [isLoggedIn, user, router]);

  return (
    <main className="bonj-auth-page">
      <div className="bonj-auth-shell">
        {isLoading ? (
          <div className="bonj-auth-loading">Oturum durumu kontrol ediliyor…</div>
        ) : (
          <AuthModal
            inline
            title="Bonj Dünyasına Hoş Geldiniz"
            subtitle="Cep telefonunuza gelecek 6 haneli SMS kodu ile şifresiz giriş yapın."
            onSuccess={() => {
              router.push("/hesabim");
            }}
          />
        )}
      </div>
    </main>
  );
}

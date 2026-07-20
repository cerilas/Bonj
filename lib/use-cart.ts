"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const cartKey = "bonj-cart-v1";
const cartEvent = "bonj-cart-change";

export type CartItem = {
  menuItemId: number;
  name: string;
  priceInKurus: number;
  imageUrl: string | null;
  imageAlt: string;
  accent: string;
  quantity: number;
};

function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cartKey) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartItem => {
      if (!item || typeof item !== "object") return false;
      const value = item as Partial<CartItem>;
      return Number.isInteger(value.menuItemId) &&
        typeof value.name === "string" &&
        Number.isInteger(value.priceInKurus) &&
        Number.isInteger(value.quantity) &&
        Number(value.quantity) > 0;
    }).map((item) => ({ ...item, quantity: Math.min(20, item.quantity) }));
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  window.localStorage.setItem(cartKey, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(cartEvent));
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    setReady(true);
    window.addEventListener("storage", sync);
    window.addEventListener(cartEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(cartEvent, sync);
    };
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    saveCart(next);
  }, []);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    const current = readCart();
    const existing = current.find((entry) => entry.menuItemId === item.menuItemId);
    const next = existing
      ? current.map((entry) => entry.menuItemId === item.menuItemId
        ? { ...entry, quantity: Math.min(20, entry.quantity + 1) }
        : entry)
      : [...current, { ...item, quantity: 1 }];
    persist(next);
  }, [persist]);

  const setQuantity = useCallback((menuItemId: number, quantity: number) => {
    const current = readCart();
    const next = quantity <= 0
      ? current.filter((item) => item.menuItemId !== menuItemId)
      : current.map((item) => item.menuItemId === menuItemId
        ? { ...item, quantity: Math.min(20, quantity) }
        : item);
    persist(next);
  }, [persist]);

  const clearCart = useCallback(() => persist([]), [persist]);
  const count = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);
  const totalInKurus = useMemo(
    () => items.reduce((total, item) => total + item.priceInKurus * item.quantity, 0),
    [items],
  );

  return { items, ready, count, totalInKurus, addItem, setQuantity, clearCart };
}

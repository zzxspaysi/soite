"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem } from "@/lib/types";
type Store = {
  items: CartItem[];
  add: (item: CartItem) => void;
  setQuantity: (id: string, n: number) => void;
  clear: () => void;
  ready: boolean;
  notice: string;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("anado-cart-v1") || "[]");
      if (Array.isArray(stored))
        setItems(
          stored
            .filter(
              (x) =>
                x &&
                typeof x.offerId === "string" &&
                Number.isInteger(x.quantity) &&
                x.quantity > 0,
            )
            .slice(0, 100),
        );
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem("anado-cart-v1", JSON.stringify(items));
  }, [items, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);
  const add = useCallback((item: CartItem) => {
    setItems((old) =>
      old.some((x) => x.offerId === item.offerId)
        ? old.map((x) =>
            x.offerId === item.offerId
              ? { ...x, quantity: Math.min(99, x.quantity + item.quantity) }
              : x,
          )
        : [...old, item],
    );
    setNotice("Товар добавлен в корзину");
  }, []);
  return (
    <Context.Provider
      value={{
        items,
        add,
        ready,
        notice,
        setQuantity: (id, n) =>
          setItems((old) =>
            n <= 0
              ? old.filter((x) => x.offerId !== id)
              : old.map((x) =>
                  x.offerId === id ? { ...x, quantity: Math.min(99, n) } : x,
                ),
          ),
        clear: () => setItems([]),
      }}
    >
      {children}
      <div role="status" className={`toast ${notice ? "visible" : ""}`}>
        {notice} <a href="/cart">В корзину →</a>
      </div>
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw Error("Store missing");
  return store;
}

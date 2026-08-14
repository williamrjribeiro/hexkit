import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hexkit PetShop",
  description: "Vanilla Next.js PetShop dogfood fixture for Hexkit.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-stone-50 text-stone-950 antialiased">
        <header className="border-b border-stone-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold">
              Hexkit PetShop
            </Link>
            <div className="flex gap-4 text-sm font-medium text-stone-700">
              <Link href="/pets" className="hover:text-stone-950">
                Pets
              </Link>
              <Link href="/orders" className="hover:text-stone-950">
                Orders
              </Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

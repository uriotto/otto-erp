import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הצעת מחיר | OTTO",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import { Suspense } from "react";
import { SearchClient } from "./search-client";

export const metadata = {
  title: "חיפוש — OTTO",
};

export default function SearchPage() {
  return (
    <Suspense>
      <SearchClient />
    </Suspense>
  );
}

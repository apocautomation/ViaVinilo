"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CustomerRecord } from "../customer-record";

function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("nuevo") === "1";
  return <CustomerRecord id={id} isNew={isNew} />;
}

export default function Page() {
  return (
    <Suspense>
      <CustomerPage />
    </Suspense>
  );
}

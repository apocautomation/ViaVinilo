"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api } from "../../../../lib/api";
import { PageHead } from "../../../ui";
import type { Customer } from "../customer";
import { CustomerForm, initialValues, toPayload } from "../customer-form";

export default function NewCustomerPage() {
  const router = useRouter();
  return (
    <div className="page page-narrow">
      <Link href="/ventas/clientes" className="back-link">
        <ChevronLeft size={16} /> Clientes
      </Link>
      <PageHead
        title="Nuevo cliente"
        help="El cliente queda activo y ya puede entrar a la app con cualquiera de sus emails. Queda registrado quién lo dio de alta."
      />
      <CustomerForm
        mode="create"
        initial={initialValues()}
        submitLabel="Dar de alta"
        onSubmit={async (v) => {
          const created = await api<Customer>("/customers", {
            method: "POST",
            body: JSON.stringify(toPayload(v, "create")),
          });
          router.push(`/ventas/clientes/${created.id}?nuevo=1`);
        }}
      />
    </div>
  );
}

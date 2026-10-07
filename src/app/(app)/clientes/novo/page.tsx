import { Header } from "@/components/layout/header";
import { ClienteForm } from "@/components/clientes/cliente-form";

export default function NovoClientePage() {
  return (
    <>
      <Header title="Novo cliente" />
      <ClienteForm />
    </>
  );
}

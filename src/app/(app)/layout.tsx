import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-fundo print:bg-white">
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 pt-[4.5rem] lg:p-8 print:p-0">{children}</main>
      </div>
    </ToastProvider>
  );
}

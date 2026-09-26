import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import Toast from "@/components/Toast";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Finanzas",
  description: "Presupuesto del hogar: plan base, análisis mensual, provisiones y objetivos",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Tema guardado por el botón del sidebar; claro por defecto
  const theme = (await cookies()).get("fin_theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="es" className={inter.variable} data-theme={theme}>
      <body>
        {children}
        <Toast />
      </body>
    </html>
  );
}

"use client";

import { useTransition } from "react";
import { fmt, parseNum } from "@/lib/format";
import { PERSONAS, type Persona } from "@/lib/types";

export function toast(msg: string) {
  window.dispatchEvent(new CustomEvent("toast", { detail: msg }));
}

/** Ejecuta una Server Action mostrando "Guardado" o el error. */
export function useSave() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok = "Guardado", after?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        // Las Server Actions devuelven { error } en lugar de lanzar
        if (r && typeof r === "object" && "error" in r) throw new Error(String((r as { error: unknown }).error));
        if (ok) toast(ok);
        after?.();
      } catch (e) {
        toast("Error: " + (e as Error).message);
      }
    });
  return { pending, run };
}

type Base = { label: string; className?: string };

export function NumCell({ value, onSave, label, className, placeholder }: Base & { value: number | null; placeholder?: string; onSave: (v: number | null) => Promise<unknown> }) {
  const { run } = useSave();
  return (
    <input
      key={String(value)}
      aria-label={label}
      className={"cell n " + (className ?? "")}
      inputMode="decimal"
      placeholder={placeholder ?? "—"}
      defaultValue={fmt(value)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onBlur={(e) => {
        let v: number | null;
        try {
          v = parseNum(e.currentTarget.value);
        } catch {
          toast("Número inválido");
          e.currentTarget.value = fmt(value);
          return;
        }
        if (v !== value) run(() => onSave(v));
      }}
    />
  );
}

export function TextCell({ value, onSave, label, placeholder, className }: Base & { value: string | null; placeholder?: string; onSave: (v: string) => Promise<unknown> }) {
  const { run } = useSave();
  return (
    <input
      key={value ?? ""}
      aria-label={label}
      className={"cell " + (className ?? "")}
      placeholder={placeholder}
      defaultValue={value ?? ""}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onBlur={(e) => {
        const v = e.currentTarget.value;
        if (v !== (value ?? "")) run(() => onSave(v));
      }}
    />
  );
}

export function DateCell({ value, onSave, label }: Base & { value: string | null; onSave: (v: string) => Promise<unknown> }) {
  const { run } = useSave();
  return (
    <input
      key={value ?? ""}
      type="date"
      className="cell"
      aria-label={label}
      defaultValue={value ?? ""}
      onChange={(e) => {
        const v = e.currentTarget.value;
        if (v && v !== (value ?? "")) run(() => onSave(v));
      }}
    />
  );
}

export function SelectCell({ value, options, onSave, label, className }: Base & { value: string; options: { v: string; t: string }[]; onSave: (v: string) => Promise<unknown> }) {
  const { run } = useSave();
  return (
    <select aria-label={label} className={"cell " + (className ?? "")} value={value} onChange={(e) => run(() => onSave(e.currentTarget.value))}>
      {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  );
}

export const personaOptions = PERSONAS.map((p) => ({ v: p.k, t: p.t }));

export function PersonaCell({ value, onSave }: { value: Persona; onSave: (v: Persona) => Promise<unknown> }) {
  return <SelectCell label="Persona" value={value} options={personaOptions} onSave={(v) => onSave(v as Persona)} />;
}

export function ActionButton({ action, children, className = "btn", confirm: msg, title, ok = "" }: {
  action: () => Promise<unknown>; children: React.ReactNode; className?: string; confirm?: string; title?: string; ok?: string;
}) {
  const { pending, run } = useSave();
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={title}
      disabled={pending}
      onClick={() => {
        if (msg && !window.confirm(msg)) return;
        run(action, ok);
      }}
    >
      {children}
    </button>
  );
}

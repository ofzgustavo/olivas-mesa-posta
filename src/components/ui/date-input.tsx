"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface DateInputProps {
  id?: string;
  name?: string;
  required?: boolean;
  defaultValue?: string; // yyyy-mm-dd
  value?: string;        // yyyy-mm-dd (controlled)
  onChange?: (iso: string) => void;
  className?: string;
  placeholder?: string;
}

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!d) return iso;
  return `${d}/${m}/${y}`;
}

// Converte dd/mm/aaaa (8 dígitos) em ISO, apenas se for uma data real
function parseValidISO(digits: string): string | null {
  if (digits.length !== 8) return null;
  const dia = Number(digits.slice(0, 2));
  const mes = Number(digits.slice(2, 4));
  const ano = Number(digits.slice(4, 8));
  const data = new Date(ano, mes - 1, dia);
  const valida =
    ano >= 1900 &&
    data.getFullYear() === ano &&
    data.getMonth() === mes - 1 &&
    data.getDate() === dia;
  if (!valida) return null;
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

export function DateInput({
  id,
  name,
  required,
  defaultValue,
  value,
  onChange,
  className,
  placeholder = "dd/mm/aaaa",
}: DateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [display, setDisplay] = useState(
    value !== undefined ? isoToDisplay(value) : defaultValue ? isoToDisplay(defaultValue) : ""
  );
  const [iso, setIso] = useState(value ?? defaultValue ?? "");

  // Sincroniza quando o valor controlado muda por fora (ex.: botão "Limpar")
  useEffect(() => {
    if (value === undefined) return;
    if (value !== iso) {
      setIso(value);
      setDisplay(isoToDisplay(value));
      inputRef.current?.setCustomValidity("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let digits = e.target.value.replace(/\D/g, "");
    if (digits.length > 8) digits = digits.slice(0, 8);

    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setDisplay(formatted);

    const validISO = parseValidISO(digits) ?? "";
    setIso(validISO);
    e.target.setCustomValidity(
      digits.length === 0 || validISO ? "" : "Data incompleta ou inválida."
    );
    onChange?.(validISO);
  }

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        maxLength={10}
        required={required}
        className={cn("campo", className)}
      />
      {name && <input type="hidden" name={name} value={iso} />}
    </>
  );
}

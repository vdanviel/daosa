import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  if (!digits) return '';

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/(\d{4})(\d)$/, '$1-$2');
}

/** Mascara CPF (11 dígitos) ou CNPJ (14 dígitos) enquanto digita. */
export function maskDocument(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }

  return maskCnpj(digits);
}

/** Valida CPF/CNPJ com dígitos verificadores (mesma regra do backend). */
export function isValidDocument(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.length === 11) {
    if (/^(\d)\1{10}$/.test(digits)) return false;
    const n = digits.split('').map(Number);
    const d1 = (n.slice(0, 9).reduce((s, d, i) => s + d * (10 - i), 0) * 10) % 11 % 10;
    const d2 = (n.slice(0, 10).reduce((s, d, i) => s + d * (11 - i), 0) * 10) % 11 % 10;
    return d1 === n[9] && d2 === n[10];
  }

  if (digits.length === 14) {
    if (/^(\d)\1{13}$/.test(digits)) return false;
    const calc = (base: number[], weights: number[]) => {
      const r = base.reduce((s, d, i) => s + d * weights[i], 0) % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const n = digits.split('').map(Number);
    const d1 = calc(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const d2 = calc(n.slice(0, 12).concat(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    return d1 === n[12] && d2 === n[13];
  }

  return false;
}

export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('55') ? digits.slice(2) : digits;
  const limited = normalized.slice(0, 11);

  if (!limited) return '';
  if (limited.length <= 2) return `+55 ${limited}`;
  if (limited.length <= 7) return `+55 ${limited.slice(0, 2)} ${limited.slice(2)}`;

  return `+55 ${limited.slice(0, 2)} ${limited.slice(2, 7)}-${limited.slice(7)}`;
}

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

export function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const normalized = digits.startsWith('55') ? digits.slice(2) : digits;
  const limited = normalized.slice(0, 11);

  if (!limited) return '';
  if (limited.length <= 2) return `+55 ${limited}`;
  if (limited.length <= 7) return `+55 ${limited.slice(0, 2)} ${limited.slice(2)}`;

  return `+55 ${limited.slice(0, 2)} ${limited.slice(2, 7)}-${limited.slice(7)}`;
}

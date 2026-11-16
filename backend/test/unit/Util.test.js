import { describe, it, expect } from 'vitest';
import Utils from '../../src/util/Util.js';

describe('Utils.isValidDocument', () => {
  it('aceita um CPF válido', () => {
    expect(Utils.isValidDocument('529.982.247-25')).toBe(true);
  });

  it('aceita um CNPJ válido', () => {
    expect(Utils.isValidDocument('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CPF com todos os dígitos repetidos', () => {
    expect(Utils.isValidDocument('111.111.111-11')).toBe(false);
  });

  it('rejeita CPF com dígito verificador errado', () => {
    expect(Utils.isValidDocument('529.982.247-26')).toBe(false);
  });

  it('rejeita entrada vazia e textos', () => {
    expect(Utils.isValidDocument('')).toBe(false);
    expect(Utils.isValidDocument('abc')).toBe(false);
  });
});

describe('Utils.generateCode', () => {
  it('gera código só com dígitos e no tamanho pedido', () => {
    const code = Utils.generateCode(6);

    expect(code).toHaveLength(6);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('gera tamanhos diferentes quando solicitado', () => {
    expect(Utils.generateCode(4)).toHaveLength(4);
  });
});

describe('Utils.formatDate', () => {
  it('formata data ISO para pt-BR', () => {
    expect(Utils.formatDate('2024-01-15')).toBe('15/01/2024');
  });
});

// Dados do app: ficam só no aparelho (localStorage), com backup em arquivo.

const CHAVE = 'controle:v1';

// Valores em centavos. Meses no formato AAAA-MM. Pagamentos no formato AAAA-MM-15 / AAAA-MM-30.
// O código publicado não leva dados pessoais: os dados iniciais vêm cifrados em inicial.js.
export function padrao() {
  return {
    versao: 1,
    inicio: null,
    entradaPadrao: { 15: 0, 30: 0 },
    entradas: {},
    contas: [],
    luz: { acordo: 0, acordoFim: null, pessoas: 1, dia: 15, divisao: 'metade', contas: {}, estimativa: 0 },
    avulsos: [],
    marcados: {},
    gastos: [],
    categorias: ['Mercado', 'Transporte', 'Lanche', 'Lazer', 'Casa', 'Outros'],
    ultimoBackup: null
  };
}

export function completar(dados) {
  const base = padrao();
  const e = { ...base, ...dados };
  e.luz = { ...base.luz, ...(dados.luz || {}) };
  e.entradaPadrao = { ...base.entradaPadrao, ...(dados.entradaPadrao || {}) };
  for (const k of ['entradas', 'marcados']) if (typeof e[k] !== 'object' || !e[k]) e[k] = {};
  for (const k of ['contas', 'avulsos', 'gastos', 'categorias']) if (!Array.isArray(e[k])) e[k] = base[k];
  return e;
}

export function pareceBackup(x) {
  return x && typeof x === 'object' && Array.isArray(x.contas) && x.luz && typeof x.luz === 'object';
}

// null = primeira abertura (o app pede a senha ou um backup).
export function carregar() {
  try {
    const s = localStorage.getItem(CHAVE);
    if (s) return completar(JSON.parse(s));
  } catch { /* sem armazenamento */ }
  return null;
}

export function salvar(e) {
  try { localStorage.setItem(CHAVE, JSON.stringify(e)); return true; } catch { return false; }
}

export function novoId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

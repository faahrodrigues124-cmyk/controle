// Datas, meses e pagamentos (dia 15 e dia 30 de cada mês).

export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const dois = (n) => String(n).padStart(2, '0');

export function mesKey(y, m) { return `${y}-${dois(m)}`; }
export function parseMes(k) { const [y, m] = k.split('-').map(Number); return { y, m }; }

export function somaMes(k, n) {
  let { y, m } = parseMes(k);
  m += n;
  y += Math.floor((m - 1) / 12);
  m = (((m - 1) % 12) + 12) % 12 + 1;
  return mesKey(y, m);
}

export function mesesEntre(a, b) {
  const x = parseMes(a), y = parseMes(b);
  return (y.y - x.y) * 12 + (y.m - x.m);
}

export function rotuloMes(k) { const { y, m } = parseMes(k); return `${MESES[m - 1]}/${String(y).slice(2)}`; }
export function nomeMes(k) { return MESES_LONGOS[parseMes(k).m - 1]; }

const ultimoDia = (y, m) => new Date(y, m, 0).getDate();

// Um pagamento é identificado por mês + 15 ou 30. Em fevereiro, o "30" cai no último dia.
export function pag(y, m, d) {
  const dia = d === 15 ? 15 : Math.min(30, ultimoDia(y, m));
  return { y, m, d, mes: mesKey(y, m), key: `${mesKey(y, m)}-${d}`, data: new Date(y, m - 1, dia) };
}

export function pagDeKey(key) { const [y, m, d] = key.split('-').map(Number); return pag(y, m, d); }
export function pagNoMes(mes, d) { const { y, m } = parseMes(mes); return pag(y, m, d); }

export function seguinte(p) {
  if (p.d === 15) return pag(p.y, p.m, 30);
  return p.m === 12 ? pag(p.y + 1, 1, 15) : pag(p.y, p.m + 1, 15);
}

export function anterior(p) {
  if (p.d === 30) return pag(p.y, p.m, 15);
  return p.m === 1 ? pag(p.y - 1, 12, 30) : pag(p.y, p.m - 1, 30);
}

// O último pagamento que já caiu até a data informada.
export function pagamentoDe(data) {
  const d0 = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const y = d0.getFullYear(), m = d0.getMonth() + 1;
  const p30 = pag(y, m, 30);
  if (d0 >= p30.data) return p30;
  const p15 = pag(y, m, 15);
  if (d0 >= p15.data) return p15;
  return anterior(p15);
}

export function hoje0() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
export function isoData(t) { return `${t.getFullYear()}-${dois(t.getMonth() + 1)}-${dois(t.getDate())}`; }
export function isoHoje() { return isoData(new Date()); }
export function dataDeISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function mesHoje() { const t = new Date(); return mesKey(t.getFullYear(), t.getMonth() + 1); }
export function rotuloData(data) { return `${data.getDate()}/${MESES[data.getMonth()]}`; }
export function diasEntre(a, b) { return Math.round((b - a) / 86400000); }

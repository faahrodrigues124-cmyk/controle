// Regras de dinheiro: o que cada pagamento precisa separar e quanto sobra.
// Regra de divisão: conta "meio a meio" paga no dia X sai metade do pagamento
// anterior e metade do pagamento do dia X. Conta "inteira" sai toda do dia X.

import { pag, pagNoMes, seguinte, somaMes, mesesEntre, rotuloData, dataDeISO, diasEntre, hoje0 } from './datas.js';

export const brl = (c) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function valorNoMes(conta, mes) {
  let v = 0;
  for (const x of conta.valores) if (x.desde <= mes) v = x.valor;
  return v;
}

export function valorAtual(conta, mes) {
  return valorNoMes(conta, mes) || conta.valores[conta.valores.length - 1]?.valor || 0;
}

export function fimConta(c) {
  return c.tipo === 'parcelada' ? somaMes(c.inicio, c.parcelas - 1) : (c.fim || null);
}

export function ativaNoMes(c, mes) {
  if (c.inicio && mes < c.inicio) return false;
  const fim = fimConta(c);
  return !(fim && mes > fim);
}

export function encerrada(c, mes) {
  const fim = fimConta(c);
  return !!fim && fim < mes;
}

export function metades(v) { const a = Math.ceil(v / 2); return [a, v - a]; }

export function luzDoMes(e, mes) {
  const L = e.luz;
  const real = L.contas[mes];
  const contaMes = real ?? L.estimativa;
  const parte = Math.round(contaMes / L.pessoas);
  const acordo = L.acordoFim && mes <= L.acordoFim ? L.acordo : 0;
  return { acordo, parte, contaMes, estimada: real == null, valor: acordo + parte };
}

// Contas que vencem no mês (valor cheio), cada uma ligada ao pagamento em que é paga.
export function ocorrencias(e, mes) {
  const lista = [];
  for (const c of e.contas) {
    if (!ativaNoMes(c, mes)) continue;
    const valor = valorNoMes(c, mes);
    if (!valor) continue;
    const o = { id: c.id, nome: c.nome, mes, valor, dia: c.dia, divisao: c.divisao, tipo: c.tipo, obs: c.obs };
    if (c.tipo === 'parcelada') { o.parcela = mesesEntre(c.inicio, mes) + 1; o.total = c.parcelas; }
    lista.push(o);
  }
  const luz = luzDoMes(e, mes);
  if (luz.valor) {
    lista.push({ id: 'luz', nome: 'Luz', mes, valor: luz.valor, dia: e.luz.dia, divisao: e.luz.divisao, tipo: 'luz', acordo: luz.acordo, estimada: luz.estimada, pessoas: e.luz.pessoas });
  }
  return lista;
}

function detalhe(o, parte, pagaEm) {
  const partes = [];
  if (o.tipo === 'parcelada') partes.push(`${o.parcela}/${o.total}`);
  if (o.tipo === 'luz' && o.estimada) partes.push('estimada');
  partes.push(parte === 'inteira' ? 'inteira' : 'metade');
  partes.push(`paga ${rotuloData(pagaEm.data)}`);
  return partes.join(' · ');
}

function item(o, parte, valor, pagaEm) {
  return { key: `${o.id}:${o.mes}:${parte}`, nome: o.nome, valor, det: detalhe(o, parte, pagaEm), contaId: o.id };
}

// O que o pagamento p precisa separar.
export function obrigacoes(e, p) {
  const itens = [];
  for (const o of ocorrencias(e, p.mes)) {
    if (o.dia !== p.d) continue;
    if (o.divisao === 'inteira') itens.push(item(o, 'inteira', o.valor, p));
    else itens.push(item(o, '2', metades(o.valor)[1], p));
  }
  const n = seguinte(p);
  for (const o of ocorrencias(e, n.mes)) {
    if (o.dia !== n.d || o.divisao !== 'metade') continue;
    itens.push(item(o, '1', metades(o.valor)[0], n));
  }
  for (const a of e.avulsos) {
    if (a.pagamento === p.key) itens.push({ key: `avulso:${a.id}`, nome: a.nome, valor: a.valor, det: 'avulsa · inteira', avulsoId: a.id });
  }
  return itens;
}

export function entradaDe(e, p) {
  return e.entradas[p.key] ?? e.entradaPadrao[p.d];
}

export function gastosDoCiclo(e, p) {
  const n = seguinte(p);
  return e.gastos
    .filter((g) => { const d = dataDeISO(g.data); return d >= p.data && d < n.data; })
    .sort((a, b) => (a.data === b.data ? b.criadoEm - a.criadoEm : a.data < b.data ? 1 : -1));
}

export function resumo(e, p) {
  const n = seguinte(p);
  const marcados = e.marcados[p.key] || {};
  const itens = obrigacoes(e, p).map((i) => ({ ...i, feito: !!marcados[i.key] }));
  const entrada = entradaDe(e, p);
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const separado = itens.filter((i) => i.feito).reduce((s, i) => s + i.valor, 0);
  const gastos = gastosDoCiclo(e, p);
  const gasto = gastos.reduce((s, g) => s + g.valor, 0);
  const hoje = hoje0();
  const futuro = p.data > hoje;
  const dias = futuro ? diasEntre(p.data, n.data) : Math.max(1, diasEntre(hoje, n.data));
  return {
    p, n, itens, entrada, real: e.entradas[p.key] != null, total, separado, falta: total - separado,
    gastos, gasto, livre: entrada - total - gasto, dias, futuro
  };
}

export function contasMes(e, mes) {
  const contas = ocorrencias(e, mes).reduce((s, o) => s + o.valor, 0);
  const avulsas = e.avulsos.filter((a) => a.pagamento.slice(0, 7) === mes).reduce((s, a) => s + a.valor, 0);
  return contas + avulsas;
}

export function entradasMes(e, mes) {
  return entradaDe(e, pagNoMes(mes, 15)) + entradaDe(e, pagNoMes(mes, 30));
}

export function finsDoMes(e, mes) {
  const fins = e.contas
    .filter((c) => fimConta(c) === mes)
    .map((c) => (c.tipo === 'parcelada' ? `última parcela do ${c.nome}` : `${c.nome} acaba`));
  if (e.luz.acordoFim === mes && e.luz.acordo) fins.push('acordo da luz acaba (previsto)');
  return fins;
}

export function projecao(e, inicioMes, qtd) {
  const linhas = [];
  for (let i = 0; i < qtd; i++) {
    const mes = somaMes(inicioMes, i);
    const entradas = entradasMes(e, mes);
    const contas = contasMes(e, mes);
    linhas.push({ mes, entradas, contas, sobra: entradas - contas, fins: finsDoMes(e, mes), alivio: 0 });
  }
  for (let i = 1; i < linhas.length; i++) {
    const dif = linhas[i].sobra - linhas[i - 1].sobra;
    if (linhas[i - 1].fins.length && dif > 0) linhas[i].alivio = dif;
  }
  let depois = null;
  for (let k = qtd; k < qtd + 48; k++) {
    const mes = somaMes(inicioMes, k);
    const fins = finsDoMes(e, mes);
    if (fins.length) {
      const prox = somaMes(mes, 1);
      depois = { mes, fins, prox, sobra: entradasMes(e, prox) - contasMes(e, prox) };
      break;
    }
  }
  return { linhas, depois };
}

// A parcelada de maior valor ainda em andamento no pagamento p.
export function destaqueParcelada(e, p) {
  const ativas = e.contas.filter((c) => c.tipo === 'parcelada' && c.inicio <= p.mes && fimConta(c) >= p.mes);
  if (!ativas.length) return null;
  const c = ativas.sort((a, b) => valorAtual(b, p.mes) - valorAtual(a, p.mes))[0];
  let pagas = 0;
  for (let i = 0; i < c.parcelas; i++) if (pagNoMes(somaMes(c.inicio, i), c.dia).data <= p.data) pagas++;
  const fim = fimConta(c);
  return { nome: c.nome, total: c.parcelas, pagas, valor: valorAtual(c, p.mes), fim, depois: somaMes(fim, 1) };
}

// Próximo mês da luz a pagar a partir de hoje (o mês do próximo pagamento do dia da luz).
export function mesLuzAtual(e) {
  const hoje = hoje0();
  let p = pag(hoje.getFullYear(), hoje.getMonth() + 1, e.luz.dia);
  if (p.data < hoje) p = seguinte(seguinte(p));
  return p.mes;
}

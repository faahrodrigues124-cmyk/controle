import {
  pagDeKey, pagamentoDe, seguinte, anterior, somaMes, mesesEntre, rotuloMes, nomeMes, rotuloData,
  isoHoje, dataDeISO, mesHoje, MESES
} from './datas.js';
import { carregar, salvar, novoId, completar, pareceBackup, padrao } from './estado.js';
import * as C from './calculo.js';
import { INICIAL } from './inicial.js';

let e = carregar();
if (e && !e.inicio) e.inicio = pagamentoDe(new Date()).key;
const ui = { tela: 'inicio', ciclo: null };

const $app = document.getElementById('app');
const $camada = document.getElementById('camada');
const $aviso = document.getElementById('aviso');

const brl = C.brl;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function parseValor(txt) {
  let s = String(txt || '').replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

function gravar() {
  if (!salvar(e)) aviso('Não consegui salvar neste aparelho. Faça um backup.');
}

// ---------- Ícones ----------
const svg = (d, w = 20) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  mais: svg('<path d="M12 5v14M5 12h14"/>', 26),
  maisP: svg('<path d="M12 5v14M5 12h14"/>', 16),
  x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 18),
  lapis: svg('<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', 15),
  esq: svg('<path d="M15 6l-6 6 6 6"/>', 20),
  dir: svg('<path d="M9 6l6 6-6 6"/>', 20),
  seta: svg('<path d="M9 6l6 6-6 6"/>', 16),
  apagar: svg('<path d="M9 6h11v12H9l-6-6z"/><path d="M13 10l4 4M17 10l-4 4"/>', 24)
};
const ICONES_CAT = {
  Mercado: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M3 4h2l2.4 11h11l2-8H6.2"/>',
  Transporte: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21v-4M16 21v-4"/>',
  Lanche: '<path d="M5 8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>',
  Lazer: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/>',
  Casa: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  Outros: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>'
};
const iconeCat = (c) => svg(ICONES_CAT[c] || ICONES_CAT.Outros);

// ---------- Ciclo (pagamento) em foco ----------
function cicloPadrao() {
  let p = pagamentoDe(new Date());
  const ini = pagDeKey(e.inicio);
  if (p.data < ini.data) p = ini;
  return p;
}
const cicloAtual = () => (ui.ciclo ? pagDeKey(ui.ciclo) : cicloPadrao());
// Mês que o pagamento atual está preparando (o do próximo pagamento).
const mesRef = () => seguinte(cicloPadrao()).mes;

// ---------- Tela: Início ----------
// O anel sempre tem os 4 arcos; o JS anima do desenho anterior para o novo (ver animarInicio).
const CIRC = 2 * Math.PI * 118;
let anelAnterior = null;
let livreAnterior = null;

function anel(r) {
  const base = Math.max(r.entrada, r.total + r.gasto, 1);
  const segs = [['separado', r.separado, 'var(--azul)'], ['falta', r.falta, 'var(--ambar)'], ['gasto', r.gasto, 'var(--coral)'], ['livre', Math.max(0, r.livre), 'var(--menta)']];
  const folga = segs.filter(([, v]) => v > 0).length > 1 ? 5 : 0;
  let ini = 0;
  const arcos = segs.map(([nome, v, cor]) => {
    const len = (v / base) * CIRC;
    const alvo = { dash: v > 0 ? Math.max(0, len - folga) : 0, off: -ini };
    const de = anelAnterior?.[nome] || { dash: 0, off: -ini };
    ini += len;
    return `<circle data-arco="${nome}" data-dash="${alvo.dash.toFixed(1)}" data-off="${alvo.off.toFixed(1)}" cx="130" cy="130" r="118" fill="none" stroke="${cor}" stroke-width="12" style="stroke-dasharray:${de.dash.toFixed(1)} ${CIRC.toFixed(1)};stroke-dashoffset:${de.off.toFixed(1)}"/>`;
  }).join('');
  const pct = (v) => Math.round((v / base) * 100);
  const rotulo = `Do pagamento: ${pct(r.separado)}% separado, ${pct(r.falta)}% falta separar, ${pct(r.gasto)}% gasto, ${pct(Math.max(0, r.livre))}% livre`;

  const negativo = r.livre < 0;
  const [inteiro, cent] = brl(Math.abs(r.livre)).split(',');
  const porDia = Math.floor(r.livre / r.dias / 100);
  const sub = negativo
    ? '<span class="anel-sub" style="color:var(--coral)">passou do que tinha livre</span>'
    : `<span class="anel-sub">≈ R$ ${porDia.toLocaleString('pt-BR')} por dia${r.futuro ? ` · ${r.dias} dias` : ''}</span>`;

  return `
  <div class="anel">
    <svg width="280" height="280" viewBox="0 0 260 260" role="img" aria-label="${rotulo}">
      <circle cx="130" cy="130" r="118" fill="none" stroke="var(--sup2)" stroke-width="12"/>
      <g transform="rotate(-90 130 130)">${arcos}</g>
    </svg>
    <div class="anel-centro" aria-live="polite">
      <span class="suave" style="font-size:13px">${negativo ? 'Acima do limite até' : 'Livre até'} ${rotuloData(r.n.data)}</span>
      <span class="anel-valor${negativo ? ' neg' : ''}" data-livre="${r.livre}">${negativo ? '−' : ''}${inteiro}<span class="cent">,${cent}</span></span>
      ${sub}
    </div>
  </div>`;
}

function blocoParcelada(p) {
  const d = C.destaqueParcelada(e, p);
  if (!d) return '';
  const segs = Array.from({ length: d.total }, (_, i) => `<span class="${i < d.pagas ? 'pago' : ''}"></span>`).join('');
  return `
  <div class="card bloco">
    <div class="entre"><span class="forte">${esc(d.nome)} acaba em ${rotuloMes(d.fim)}</span><span class="mono suave" style="font-size:13px">${d.pagas}/${d.total}</span></div>
    <div class="segs" style="grid-template-columns:repeat(${d.total},1fr)">${segs}</div>
    <span style="font-size:13px;color:var(--menta)">+ R$ ${brl(d.valor)} livres por mês a partir de ${nomeMes(d.depois)}</span>
  </div>`;
}

function telaInicio() {
  const p = cicloAtual();
  const r = C.resumo(e, p);
  const primeiro = p.key === e.inicio;
  const feitos = r.itens.filter((i) => i.feito).length;

  const itens = r.itens.length
    ? r.itens.map((i) => `
      <label class="linha">
        <input type="checkbox" data-marcar="${esc(i.key)}"${i.feito ? ' checked' : ''}>
        <span class="nome"><b>${esc(i.nome)}</b><small>${esc(i.det)}</small></span>
        <span class="valor">${brl(i.valor)}</span>
      </label>`).join('')
    : '<p class="vazio">Nada para separar neste pagamento.</p>';

  const gastos = r.gastos.length
    ? `<div class="card lista">${r.gastos.map((g) => `
      <button type="button" class="linha gasto" data-acao="editar-gasto" data-id="${g.id}">
        <span class="icone-cat">${iconeCat(g.categoria)}</span>
        <span class="nome"><b>${esc(g.descricao || g.categoria)}</b><small>${esc(g.categoria)} · ${rotuloData(dataDeISO(g.data))}</small></span>
        <span class="valor">−${brl(g.valor)}</span>
      </button>`).join('')}</div>`
    : '<p class="vazio">Nenhum gasto lançado ainda.</p>';

  return `
  <header class="topo">
    <button type="button" class="redondo" data-acao="ciclo-ant" aria-label="Pagamento anterior"${primeiro ? ' disabled' : ''}>${I.esq}</button>
    <div class="topo-centro">
      <span class="suave" style="font-size:13px">Quinzena ${rotuloData(p.data)} → ${rotuloData(r.n.data)}</span>
      <button type="button" class="entrada" data-acao="entrada">${r.real ? 'Recebido' : 'Previsto'} <span class="mono">R$ ${brl(r.entrada)}</span> ${I.lapis}</button>
    </div>
    <button type="button" class="redondo" data-acao="ciclo-prox" aria-label="Próximo pagamento">${I.dir}</button>
  </header>

  ${anel(r)}

  <div class="stats">
    <div class="stat"><span><i class="ponto" style="background:var(--azul)"></i>Separado</span><span class="valor">${brl(r.separado)}</span></div>
    <div class="stat"><span><i class="ponto" style="background:var(--ambar)"></i>Falta</span><span class="valor">${brl(r.falta)}</span></div>
    <div class="stat"><span><i class="ponto" style="background:var(--coral)"></i>Gasto</span><span class="valor">${brl(r.gasto)}</span></div>
  </div>

  ${blocoParcelada(p)}

  <section class="secao">
    <div class="entre"><h2>Separar deste pagamento</h2><span class="suave" style="font-size:13px">${feitos} de ${r.itens.length}</span></div>
    <div class="card lista">${itens}</div>
    ${r.itens.length ? `<div class="entre total"><span>Total</span><span class="mono">R$ ${brl(r.total)}</span></div>` : ''}
  </section>

  <section class="secao">
    <div class="entre"><h2>Gastos da quinzena</h2>${r.gasto ? `<span class="mono suave" style="font-size:13px">R$ ${brl(r.gasto)}</span>` : ''}</div>
    ${gastos}
  </section>`;
}

// ---------- Tela: Contas ----------
function telaContas() {
  const mes = mesRef();
  const total = C.contasMes(e, mes);
  const luz = C.luzDoMes(e, mes);
  const ativas = e.contas.filter((c) => !C.encerrada(c, mes));
  const fixas = ativas.filter((c) => c.tipo === 'fixa');
  const parceladas = ativas.filter((c) => c.tipo === 'parcelada');
  const fechadas = e.contas.filter((c) => C.encerrada(c, mes));
  const divisao = (c) => (c.divisao === 'metade' ? 'meio a meio' : 'inteira');

  const linhaConta = (c) => {
    const partes = [`dia ${c.dia}`, divisao(c)];
    if (c.obs) partes.unshift(c.obs);
    if (c.inicio && c.inicio > mes) partes.unshift(`começa ${rotuloMes(c.inicio)}`);
    return `
    <button type="button" class="linha" data-acao="editar-conta" data-id="${c.id}">
      <span class="nome"><b>${esc(c.nome)}</b><small>${esc(partes.join(' · '))}</small></span>
      <span class="valor">${brl(C.valorAtual(c, mes))}</span><span class="seta">${I.seta}</span>
    </button>`;
  };

  const linhaParcelada = (c) => {
    const n = Math.min(c.parcelas, Math.max(1, mesesEntre(c.inicio, mes) + 1));
    const segs = Array.from({ length: c.parcelas }, (_, i) => `<span class="${i < n ? 'pago' : ''}"></span>`).join('');
    return `
    <button type="button" class="linha parcelada" data-acao="editar-conta" data-id="${c.id}">
      <span class="entre" style="width:100%;gap:12px">
        <span class="nome"><b>${esc(c.nome)}</b><small>parcela ${n} de ${c.parcelas} · paga dia ${c.dia} · até ${rotuloMes(C.fimConta(c))}</small></span>
        <span class="valor">${brl(C.valorAtual(c, mes))}</span>
      </span>
      <span class="segs fina" style="grid-template-columns:repeat(${c.parcelas},1fr)">${segs}</span>
    </button>`;
  };

  const mesLuz = C.mesLuzAtual(e);
  const luzProx = C.luzDoMes(e, mesLuz);
  const L = e.luz;

  const proximosAvulsos = e.avulsos
    .filter((a) => a.pagamento >= cicloPadrao().key)
    .sort((a, b) => (a.pagamento < b.pagamento ? -1 : 1));

  return `
  <header class="topo-tela">
    <h1>Contas</h1>
    <button type="button" class="pilula" data-acao="nova-conta">${I.maisP} Nova conta</button>
  </header>

  <div class="card resumo-total">
    <div class="col"><span class="suave" style="font-size:13px">Total em ${nomeMes(mes)}</span>
      <span class="numero-medio">${brl(total).split(',')[0]}<span class="cent">,${brl(total).split(',')[1]}</span></span></div>
    <span class="suave direita" style="font-size:12px">de R$ ${brl(C.entradasMes(e, mes))} previstos${luz.estimada ? '<br>luz estimada' : ''}</span>
  </div>

  ${fixas.length ? `<section class="secao"><h2 class="grupo">Fixas</h2><div class="card lista">${fixas.map(linhaConta).join('')}</div></section>` : ''}
  ${parceladas.length ? `<section class="secao"><h2 class="grupo">Parceladas</h2><div class="card lista">${parceladas.map(linhaParcelada).join('')}</div></section>` : ''}

  <section class="secao">
    <h2 class="grupo">Luz · paga dia ${L.dia} · ${L.divisao === 'metade' ? 'meio a meio' : 'inteira'}</h2>
    <div class="card lista">
      ${luzProx.acordo ? `<div class="linha"><span class="nome"><b>Acordo</b><small>sua parte · até ${rotuloMes(L.acordoFim)}</small></span><span class="valor">${brl(luzProx.acordo)}</span></div>` : ''}
      <div class="linha"><span class="nome"><b>Conta de ${nomeMes(mesLuz)} ÷ ${L.pessoas}</b>
        <small${luzProx.estimada ? ' style="color:var(--ambar)"' : ''}>${luzProx.estimada ? `aguardando o valor · estimada em ${brl(L.estimativa)}` : `conta de R$ ${brl(luzProx.contaMes)}`}</small></span>
        <span class="valor${luzProx.estimada ? ' suave' : ''}">${luzProx.estimada ? '~' : ''}${brl(luzProx.parte)}</span></div>
      <div style="padding:6px 0 14px"><button type="button" class="${luzProx.estimada ? 'contorno-ambar' : 'secundario'}" data-acao="luz">${luzProx.estimada ? 'Informar valor da conta' : 'Alterar conta de luz'}</button></div>
    </div>
  </section>

  <section class="secao">
    <h2 class="grupo">Avulsas</h2>
    <div class="card lista">
      ${proximosAvulsos.map((a) => `
        <button type="button" class="linha" data-acao="editar-avulsa" data-id="${a.id}">
          <span class="nome"><b>${esc(a.nome)}</b><small>sai do pagamento de ${rotuloData(pagDeKey(a.pagamento).data)}</small></span>
          <span class="valor">${brl(a.valor)}</span><span class="seta">${I.seta}</span>
        </button>`).join('')}
      <div class="linha"><span class="nome"><b>Água e outras</b><small>lance quando chegar o valor</small></span>
        <button type="button" class="pilula" data-acao="nova-avulsa">Lançar</button></div>
    </div>
  </section>

  ${fechadas.length ? `<section class="secao"><h2 class="grupo">Encerradas</h2><div class="card lista apagada">${fechadas.map(linhaConta).join('')}</div></section>` : ''}

  <div class="card-tracejado linha">
    <span class="nome"><b>Backup</b><small>${e.ultimoBackup ? `último: ${rotuloData(dataDeISO(e.ultimoBackup))}` : 'último: nunca'}</small></span>
    <button type="button" class="pilula" data-acao="restaurar">Restaurar</button>
    <button type="button" class="pilula azul" data-acao="backup">Salvar</button>
  </div>`;
}

// ---------- Tela: Meses ----------
function telaMeses() {
  const { linhas, depois } = C.projecao(e, mesRef(), 12);
  const max = Math.max(...linhas.map((l) => l.sobra), depois ? depois.sobra : 0, 1);
  const subida = linhas.reduce((m, l) => (l.alivio > (m?.alivio || 0) ? l : m), null);
  const anteriorDe = (l) => linhas[linhas.indexOf(l) - 1];
  const [i0, c0] = brl(linhas[0].sobra).split(',');

  const rows = linhas.map((l, i) => {
    const notas = [];
    if (l.mes === mesHoje()) notas.push(['mês atual', 'var(--azul)']);
    l.fins.forEach((f) => notas.push([f, 'var(--suave)']));
    if (l.alivio) notas.push([`+ R$ ${brl(l.alivio)} por mês`, 'var(--menta)']);
    const largura = Math.max(0, (l.sobra / max) * 100).toFixed(1);
    const cor = l.sobra < 0 ? 'var(--coral)' : i > 0 && l.sobra > linhas[0].sobra ? 'var(--menta)' : 'var(--azul)';
    return `
    <div class="mes">
      <div class="mes-topo"><span class="rotulo"${i === 0 ? ' style="color:var(--texto)"' : ''}>${rotuloMes(l.mes)}</span>
        <span class="trilho"><span style="width:${largura}%;background:${cor}"></span></span>
        <span class="num${l.sobra < 0 ? ' neg' : ''}">${brl(l.sobra)}</span></div>
      ${notas.map(([t, c]) => `<small style="color:${c}">${esc(t)}</small>`).join('')}
    </div>`;
  }).join('');

  return `
  <header class="topo-tela"><h1>Meses</h1></header>

  <div class="card destaque">
    <span class="suave" style="font-size:13px">Sobra para o dia a dia em ${nomeMes(linhas[0].mes)}</span>
    <span class="numero-medio">${i0}<span class="cent">,${c0}</span></span>
    ${subida ? `<span style="font-size:14px;color:var(--menta)">Sobe para R$ ${brl(subida.sobra)} em ${nomeMes(subida.mes)}, quando ${esc(anteriorDe(subida).fins[0].replace(/^última parcela do /, 'acaba o ').replace(/ acaba( \(previsto\))?$/, ' termina'))}</span>` : ''}
  </div>

  <div class="card lista">${rows}</div>

  ${depois ? `
  <div class="card-tracejado col">
    <span class="forte" style="font-size:14px">${rotuloMes(depois.mes)} · ${esc(depois.fins.join(' · '))}</span>
    <span class="suave" style="font-size:13px">A partir de ${rotuloMes(depois.prox)}, a sobra passa para <span class="mono" style="color:var(--menta)">${brl(depois.sobra)}</span> por mês</span>
  </div>` : ''}

  <p class="nota">Conta com R$ ${brl(e.entradaPadrao[15])} no dia 15 e R$ ${brl(e.entradaPadrao[30])} no dia 30, luz estimada quando a conta ainda não chegou e todas as contas ativas. Os gastos do dia a dia saem dessa sobra.</p>`;
}

// ---------- Animações do início ----------
const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function formatarLivre(c) {
  const [i, d] = brl(Math.abs(c)).split(',');
  return `${c < 0 ? '−' : ''}${i}<span class="cent">,${d}</span>`;
}

function animarInicio() {
  const arcos = [...$app.querySelectorAll('[data-arco]')];
  if (arcos.length) {
    const novo = {};
    arcos.forEach((a) => { novo[a.dataset.arco] = { dash: +a.dataset.dash, off: +a.dataset.off }; });
    // dois frames: o navegador pinta o estado anterior antes de transicionar
    requestAnimationFrame(() => requestAnimationFrame(() => {
      arcos.forEach((a) => {
        a.style.strokeDasharray = `${a.dataset.dash} ${CIRC.toFixed(1)}`;
        a.style.strokeDashoffset = a.dataset.off;
      });
    }));
    anelAnterior = novo;
  }

  const $livre = $app.querySelector('[data-livre]');
  if (!$livre) return;
  const para = Number($livre.dataset.livre);
  const de = livreAnterior;
  livreAnterior = para;
  if (de == null || de === para || semMovimento()) return;
  const t0 = performance.now();
  const dur = 550;
  $livre.innerHTML = formatarLivre(de);
  const passo = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    const ease = 1 - Math.pow(1 - k, 3);
    $livre.innerHTML = formatarLivre(Math.round(de + (para - de) * ease));
    if (k < 1 && $livre.isConnected) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

// ---------- Primeira abertura ----------
function telaBoasVindas() {
  return `
  <div class="boas-vindas">
    <img src="icones/icone-192.png" alt="" width="88" height="88">
    <h1>Controle</h1>
    <p class="suave">Digite a senha que você recebeu para carregar seus dados. Isso só acontece uma vez neste aparelho.</p>
    <form class="form" data-senha>
      <label class="campo-rot">Senha
        <input name="senha" class="campo" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="palavra-palavra-palavra-000" required></label>
      <p class="efeito" data-erro aria-live="polite"></p>
      <button type="submit" class="primario">Carregar meus dados</button>
    </form>
    <div class="boas-vindas-outros">
      <button type="button" class="pilula" data-acao="restaurar">Restaurar backup</button>
      <button type="button" class="pilula" data-acao="do-zero">Começar do zero</button>
    </div>
  </div>`;
}

async function abrirDadosIniciais(senha) {
  const b = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  const chave = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b(INICIAL.salt), iterations: INICIAL.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(INICIAL.iv) }, chave, b(INICIAL.dados));
  return JSON.parse(new TextDecoder().decode(claro));
}

document.addEventListener('submit', async (ev) => {
  const form = ev.target.closest('[data-senha]');
  if (!form) return;
  ev.preventDefault();
  const $erro = form.querySelector('[data-erro]');
  const botao = form.querySelector('button[type=submit]');
  const senha = form.senha.value.trim().toLowerCase().replace(/\s+/g, '');
  botao.disabled = true;
  $erro.style.color = 'var(--suave)';
  $erro.textContent = 'Abrindo…';
  try {
    e = completar(await abrirDadosIniciais(senha));
    gravar();
    irPara('inicio');
    aviso('Dados carregados. Bem-vindo!');
  } catch {
    botao.disabled = false;
    $erro.style.color = 'var(--coral)';
    $erro.textContent = 'Senha incorreta. Confira os hífens e os números.';
  }
});

// ---------- Render ----------
function render() {
  document.body.classList.toggle('sem-nav', !e);
  if (!e) { $app.innerHTML = telaBoasVindas(); return; }
  const telas = { inicio: telaInicio, contas: telaContas, meses: telaMeses };
  $app.innerHTML = telas[ui.tela]();
  document.querySelectorAll('.barra-nav nav a').forEach((a) => {
    if (a.dataset.tela === ui.tela) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (ui.tela === 'inicio') animarInicio();
}

function irPara(tela) {
  if (!['inicio', 'contas', 'meses'].includes(tela)) tela = 'inicio';
  ui.tela = tela;
  // ao entrar no início vindo de outra aba, o anel se desenha de novo
  if (tela === 'inicio') { anelAnterior = null; livreAnterior = null; }
  render();
  $app.classList.remove('entrando');
  void $app.offsetWidth;
  $app.classList.add('entrando');
  window.scrollTo(0, 0);
}

// ---------- Folha (bottom sheet) ----------
let aoFechar = null;
function abrirFolha(html, montar) {
  $camada.innerHTML = `<div class="veu" data-acao="fechar"></div>
    <div class="folha" role="dialog" aria-modal="true"><div class="alca" aria-hidden="true"></div>${html}</div>`;
  $camada.hidden = false;
  document.body.classList.add('travado');
  requestAnimationFrame(() => requestAnimationFrame(() => $camada.classList.add('aberta')));
  const folha = $camada.querySelector('.folha');
  aoFechar = montar ? montar(folha) : null;
}

function fecharFolha() {
  if ($camada.hidden) return;
  $camada.classList.remove('aberta');
  document.body.classList.remove('travado');
  if (typeof aoFechar === 'function') aoFechar();
  aoFechar = null;
  setTimeout(() => { if (!$camada.classList.contains('aberta')) { $camada.hidden = true; $camada.innerHTML = ''; } }, 260);
}

const topoFolha = (titulo) => `<div class="folha-topo"><h2>${titulo}</h2><button type="button" class="redondo" data-acao="fechar" aria-label="Fechar">${I.x}</button></div>`;
const radio = (nome, valor, rotulo, marcado) => `<label><input type="radio" name="${nome}" value="${valor}"${marcado ? ' checked' : ''}><span>${rotulo}</span></label>`;

// ---------- Aviso (toast) ----------
let timerAviso;
function aviso(texto, desfazer) {
  clearTimeout(timerAviso);
  $aviso.innerHTML = `<span>${esc(texto)}</span>${desfazer ? '<button type="button">Desfazer</button>' : ''}`;
  $aviso.classList.add('visivel');
  if (desfazer) $aviso.querySelector('button').onclick = () => { desfazer(); $aviso.classList.remove('visivel'); };
  timerAviso = setTimeout(() => $aviso.classList.remove('visivel'), 4000);
}

// ---------- Folha: gasto ----------
function folhaGasto(g) {
  // Gastos só contam a partir do primeiro pagamento controlado.
  const minimo = e.inicio.slice(0, 8) + String(pagDeKey(e.inicio).data.getDate()).padStart(2, '0');
  const maximo = isoHoje() > minimo ? isoHoje() : minimo;
  const st = { centavos: g ? g.valor : 0, categoria: g ? g.categoria : e.categorias[0], data: g ? g.data : maximo };
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'apagar']
    .map((t) => `<button type="button" data-tecla="${t}" aria-label="${t === 'apagar' ? 'Apagar' : t}">${t === 'apagar' ? I.apagar : t}</button>`).join('');

  abrirFolha(`
    ${topoFolha(g ? 'Editar gasto' : 'Novo gasto')}
    <div class="valor-grande"><span class="moeda">R$</span><span data-v>0,00</span></div>
    <p class="efeito" data-efeito aria-live="polite"></p>
    <div class="categorias">${e.categorias.map((c) => `<button type="button" data-cat="${esc(c)}" aria-pressed="${c === st.categoria}">${iconeCat(c)}${esc(c)}</button>`).join('')}</div>
    <div class="campos-linha">
      <input type="date" class="campo pilula-data" data-data value="${st.data}" min="${minimo}" max="${maximo}" aria-label="Data do gasto">
      <input type="text" class="campo" data-desc placeholder="Descrição (opcional)" aria-label="Descrição" maxlength="60" value="${esc(g?.descricao || '')}">
    </div>
    <div class="teclado">${teclas}</div>
    <button type="button" class="primario" data-ok>Lançar</button>
    ${g ? '<button type="button" class="perigo" data-excluir>Excluir gasto</button>' : ''}
  `, (f) => {
    const $v = f.querySelector('[data-v]');
    const $ef = f.querySelector('[data-efeito]');
    const $ok = f.querySelector('[data-ok]');

    const atualizar = () => {
      $v.textContent = brl(st.centavos);
      $v.classList.toggle('suave', st.centavos === 0);
      const p = pagamentoDe(dataDeISO(st.data));
      const r = C.resumo(e, p);
      let livre = r.livre - st.centavos;
      if (g && pagamentoDe(dataDeISO(g.data)).key === p.key) livre += g.valor;
      if (st.centavos === 0) $ef.textContent = `Livre até ${rotuloData(r.n.data)}: R$ ${brl(r.livre + (g ? g.valor : 0))}`;
      else if (livre >= 0) $ef.textContent = `Livre fica R$ ${brl(livre)} · ≈ R$ ${Math.floor(livre / r.dias / 100).toLocaleString('pt-BR')} por dia`;
      else $ef.textContent = `Passa R$ ${brl(-livre)} do que estava livre`;
      $ef.style.color = livre < 0 ? 'var(--coral)' : 'var(--menta)';
      $ok.textContent = st.centavos ? `${g ? 'Salvar' : 'Lançar'} R$ ${brl(st.centavos)}` : (g ? 'Salvar' : 'Lançar');
    };

    const tecla = (t) => {
      if (t === 'apagar') st.centavos = Math.floor(st.centavos / 10);
      else if (t === '00') st.centavos = st.centavos * 100;
      else st.centavos = st.centavos * 10 + Number(t);
      st.centavos = Math.min(st.centavos, 9999999);
      atualizar();
    };

    f.querySelector('.teclado').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tecla]');
      if (b) tecla(b.dataset.tecla);
    });
    f.querySelector('.categorias').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-cat]');
      if (!b) return;
      st.categoria = b.dataset.cat;
      f.querySelectorAll('[data-cat]').forEach((x) => x.setAttribute('aria-pressed', x === b));
    });
    f.querySelector('[data-data]').addEventListener('change', (ev) => {
      const v = ev.target.value;
      if (v) { st.data = v < minimo ? minimo : v > maximo ? maximo : v; ev.target.value = st.data; atualizar(); }
    });

    $ok.addEventListener('click', () => {
      if (!st.centavos) { $ef.textContent = 'Digite o valor do gasto'; $ef.style.color = 'var(--ambar)'; return; }
      const descricao = f.querySelector('[data-desc]').value.trim();
      if (g) {
        Object.assign(g, { valor: st.centavos, categoria: st.categoria, data: st.data, descricao });
        gravar(); fecharFolha(); render(); aviso('Gasto atualizado');
      } else {
        const novo = { id: novoId(), data: st.data, valor: st.centavos, categoria: st.categoria, descricao, origem: 'manual', criadoEm: Date.now() };
        e.gastos.push(novo);
        gravar(); fecharFolha(); render();
        aviso(`Gasto de R$ ${brl(novo.valor)} lançado`, () => { e.gastos = e.gastos.filter((x) => x.id !== novo.id); gravar(); render(); });
      }
    });

    f.querySelector('[data-excluir]')?.addEventListener('click', () => {
      const copia = { ...g };
      e.gastos = e.gastos.filter((x) => x.id !== g.id);
      gravar(); fecharFolha(); render();
      aviso('Gasto excluído', () => { e.gastos.push(copia); gravar(); render(); });
    });

    const teclado = (ev) => {
      if (ev.target.matches('input, select, textarea')) return;
      if (/^[0-9]$/.test(ev.key)) tecla(ev.key);
      else if (ev.key === 'Backspace') tecla('apagar');
      else if (ev.key === 'Enter' && !ev.target.matches('button')) $ok.click();
    };
    document.addEventListener('keydown', teclado);
    atualizar();
    return () => document.removeEventListener('keydown', teclado);
  });
}

// ---------- Folha: valor recebido ----------
function folhaEntrada(p) {
  const atual = C.entradaDe(e, p);
  const real = e.entradas[p.key] != null;
  abrirFolha(`
    ${topoFolha(`Pagamento de ${rotuloData(p.data)}`)}
    <form class="form" data-form>
      <label class="campo-rot">Valor que caiu na conta
        <input name="valor" class="campo grande" inputmode="decimal" autocomplete="off" value="${brl(atual)}"></label>
      <label class="check"><input type="checkbox" name="padrao"><span>Usar como previsto para todo dia ${p.d}</span></label>
      <button type="submit" class="primario">Salvar</button>
      ${real ? `<button type="button" class="secundario" data-voltar>Voltar ao previsto (R$ ${brl(e.entradaPadrao[p.d])})</button>` : ''}
    </form>
  `, (f) => {
    f.querySelector('[data-form]').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const v = parseValor(fd.get('valor'));
      if (!v) { aviso('Digite um valor válido'); return; }
      e.entradas[p.key] = v;
      if (fd.get('padrao')) e.entradaPadrao[p.d] = v;
      gravar(); fecharFolha(); render(); aviso('Valor recebido atualizado');
    });
    f.querySelector('[data-voltar]')?.addEventListener('click', () => {
      delete e.entradas[p.key];
      gravar(); fecharFolha(); render();
    });
  });
}

// ---------- Folha: conta ----------
function folhaConta(c) {
  const mes = mesRef();
  const novo = !c;
  const tipo = c?.tipo || 'fixa';
  const valor = c ? C.valorAtual(c, mes) : 0;
  const atualParcela = c?.tipo === 'parcelada' ? Math.min(c.parcelas, Math.max(1, mesesEntre(c.inicio, mes) + 1)) : 1;
  const fechada = c && C.encerrada(c, mes);

  abrirFolha(`
    ${topoFolha(novo ? 'Nova conta' : 'Editar conta')}
    <form class="form" data-form>
      <label class="campo-rot">Nome<input name="nome" class="campo" required maxlength="40" value="${esc(c?.nome || '')}" placeholder="ex.: Academia"></label>
      <label class="campo-rot">Valor por mês<input name="valor" class="campo" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${valor ? brl(valor) : ''}"></label>
      ${novo ? '' : `<fieldset class="seg"><legend>Se mudou o valor, vale a partir de</legend>${radio('desde', 'este', `${nomeMes(mes)}`, true)}${radio('desde', 'proximo', `${nomeMes(somaMes(mes, 1))}`)}</fieldset>`}
      <fieldset class="seg"><legend>Tipo</legend>${radio('tipo', 'fixa', 'Fixa', tipo === 'fixa')}${radio('tipo', 'parcelada', 'Parcelada', tipo === 'parcelada')}</fieldset>
      <div class="duas" data-parc${tipo === 'parcelada' ? '' : ' hidden'}>
        <label class="campo-rot">Total de parcelas<input name="parcelas" type="number" inputmode="numeric" min="1" max="120" class="campo" value="${c?.parcelas || ''}"></label>
        <label class="campo-rot">Parcela de ${MESES[Number(mes.slice(5)) - 1]}<input name="atual" type="number" inputmode="numeric" min="1" max="120" class="campo" value="${atualParcela}"></label>
      </div>
      <div data-fixa${tipo === 'fixa' ? '' : ' hidden'}>
        <label class="campo-rot">Começa em<input name="inicio" type="month" class="campo" value="${c?.inicio || mes}"></label>
      </div>
      <fieldset class="seg"><legend>Paga com o salário do</legend>${radio('dia', '15', 'Dia 15', (c?.dia ?? 15) === 15)}${radio('dia', '30', 'Dia 30', c?.dia === 30)}</fieldset>
      <fieldset class="seg"><legend>Como separar</legend>${radio('divisao', 'metade', 'Meio a meio', (c?.divisao ?? 'metade') === 'metade')}${radio('divisao', 'inteira', 'Inteira', c?.divisao === 'inteira')}</fieldset>
      <p class="dica" data-dica></p>
      <label class="campo-rot">Observação<input name="obs" class="campo" maxlength="50" placeholder="opcional" value="${esc(c?.obs || '')}"></label>
      <button type="submit" class="primario">Salvar</button>
      ${novo ? '' : fechada
        ? (c.tipo === 'fixa' ? '<button type="button" class="secundario" data-reativar>Reativar conta</button>' : '')
        : `<button type="button" class="secundario" data-encerrar>Encerrar depois de ${nomeMes(mes)}</button>`}
      ${novo ? '' : '<button type="button" class="perigo" data-excluir>Excluir conta</button>'}
    </form>
  `, (f) => {
    const form = f.querySelector('[data-form]');
    const dica = f.querySelector('[data-dica]');
    const atualizarForm = () => {
      const t = form.tipo.value;
      f.querySelector('[data-parc]').hidden = t !== 'parcelada';
      f.querySelector('[data-fixa]').hidden = t !== 'fixa';
      const dia = Number(form.dia.value);
      const antes = dia === 15 ? 'dia 30 do mês anterior' : 'dia 15';
      dica.textContent = form.divisao.value === 'metade'
        ? `Metade sai do pagamento do ${antes} e metade do dia ${dia}, quando você paga.`
        : `Sai inteira do pagamento do dia ${dia}.`;
    };
    form.addEventListener('change', atualizarForm);
    atualizarForm();

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const nome = String(fd.get('nome')).trim();
      const v = parseValor(fd.get('valor'));
      if (!nome || !v) { aviso('Preencha o nome e o valor'); return; }
      const t = fd.get('tipo');
      const dados = { nome, tipo: t, dia: Number(fd.get('dia')), divisao: fd.get('divisao'), obs: String(fd.get('obs')).trim() };
      if (t === 'parcelada') {
        const total = Number(fd.get('parcelas'));
        const atual = Number(fd.get('atual'));
        if (!(total >= 1) || !(atual >= 1) || atual > total) { aviso('Confira o total e a parcela atual'); return; }
        dados.parcelas = total;
        dados.inicio = somaMes(mes, -(atual - 1));
        dados.fim = null;
      } else {
        dados.inicio = fd.get('inicio') || mes;
        delete dados.parcelas;
      }

      if (novo) {
        e.contas.push({ id: novoId(), ...dados, fim: dados.fim ?? null, valores: [{ desde: dados.inicio, valor: v }] });
      } else {
        if (t === 'fixa') delete c.parcelas;
        Object.assign(c, dados);
        if (v !== valor) {
          const desde = fd.get('desde') === 'proximo' ? somaMes(mes, 1) : mes;
          c.valores = c.valores.filter((x) => x.desde < desde);
          c.valores.push({ desde, valor: v });
        }
        c.valores.sort((a, b) => (a.desde < b.desde ? -1 : 1));
        if (c.inicio && c.valores[0].desde > c.inicio) c.valores[0].desde = c.inicio;
      }
      gravar(); fecharFolha(); render(); aviso(novo ? 'Conta criada' : 'Conta atualizada');
    });

    f.querySelector('[data-encerrar]')?.addEventListener('click', () => {
      if (c.tipo === 'parcelada') c.parcelas = Math.max(1, mesesEntre(c.inicio, mes) + 1);
      else c.fim = mes;
      gravar(); fecharFolha(); render(); aviso(`${c.nome} encerrada depois de ${nomeMes(mes)}`);
    });
    f.querySelector('[data-reativar]')?.addEventListener('click', () => {
      c.fim = null;
      gravar(); fecharFolha(); render(); aviso(`${c.nome} reativada`);
    });
    f.querySelector('[data-excluir]')?.addEventListener('click', () => {
      if (!confirm(`Excluir "${c.nome}"? Ela some também dos meses anteriores.`)) return;
      e.contas = e.contas.filter((x) => x.id !== c.id);
      gravar(); fecharFolha(); render(); aviso('Conta excluída');
    });
  });
}

// ---------- Folha: luz ----------
function folhaLuz() {
  const L = e.luz;
  const mes = C.mesLuzAtual(e);
  abrirFolha(`
    ${topoFolha('Conta de luz')}
    <form class="form" data-form>
      <label class="campo-rot">Mês da conta<input name="mes" type="month" class="campo" value="${mes}"></label>
      <label class="campo-rot">Valor total da conta<input name="conta" class="campo grande" inputmode="decimal" autocomplete="off" placeholder="ex.: 300,00" value="${L.contas[mes] != null ? brl(L.contas[mes]) : ''}"></label>
      <p class="efeito" data-parte aria-live="polite"></p>
      <details class="mais-opcoes"><summary>Acordo e divisão</summary>
        <div class="form">
          <label class="campo-rot">Acordo por mês (sua parte)<input name="acordo" class="campo" inputmode="decimal" value="${brl(L.acordo)}"></label>
          <label class="campo-rot">Acordo vai até<input name="acordoFim" type="month" class="campo" value="${L.acordoFim || ''}"></label>
          <label class="campo-rot">Pessoas que dividem a conta<input name="pessoas" type="number" inputmode="numeric" min="1" max="10" class="campo" value="${L.pessoas}"></label>
        </div>
      </details>
      <button type="submit" class="primario">Salvar</button>
    </form>
  `, (f) => {
    const form = f.querySelector('[data-form]');
    const $parte = f.querySelector('[data-parte]');
    const atualizar = () => {
      const pessoas = Math.max(1, Number(form.pessoas.value) || L.pessoas);
      const v = parseValor(form.conta.value);
      const acordo = parseValor(form.acordo.value);
      $parte.textContent = v
        ? `Sua parte: R$ ${brl(Math.round(v / pessoas))}${acordo ? ` + acordo R$ ${brl(acordo)} = R$ ${brl(Math.round(v / pessoas) + acordo)}` : ''}`
        : 'Digite o valor total que veio na conta';
    };
    form.mes.addEventListener('change', () => {
      const m = form.mes.value;
      form.conta.value = L.contas[m] != null ? brl(L.contas[m]) : '';
      atualizar();
    });
    form.addEventListener('input', atualizar);
    atualizar();
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const m = form.mes.value;
      const v = parseValor(form.conta.value);
      if (m && v) { L.contas[m] = v; L.estimativa = v; }
      else if (m && !form.conta.value.trim()) delete L.contas[m];
      L.acordo = parseValor(form.acordo.value);
      L.acordoFim = form.acordoFim.value || null;
      L.pessoas = Math.max(1, Number(form.pessoas.value) || 3);
      gravar(); fecharFolha(); render(); aviso('Luz atualizada');
    });
  });
}

// ---------- Folha: conta avulsa ----------
function folhaAvulsa(a) {
  const p0 = cicloPadrao();
  const opcoes = [p0, seguinte(p0), seguinte(seguinte(p0))];
  if (a && !opcoes.some((p) => p.key === a.pagamento)) opcoes.unshift(pagDeKey(a.pagamento));
  const escolhido = a ? a.pagamento : p0.key;
  abrirFolha(`
    ${topoFolha(a ? 'Conta avulsa' : 'Lançar conta avulsa')}
    <form class="form" data-form>
      <label class="campo-rot">Nome<input name="nome" class="campo" maxlength="40" value="${esc(a?.nome || 'Água')}"></label>
      <label class="campo-rot">Valor (sua parte)<input name="valor" class="campo grande" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${a ? brl(a.valor) : ''}"></label>
      <fieldset class="seg"><legend>Sai do pagamento de</legend>${opcoes.map((p) => radio('pagamento', p.key, rotuloData(p.data), p.key === escolhido)).join('')}</fieldset>
      <button type="submit" class="primario">Salvar</button>
      ${a ? '<button type="button" class="perigo" data-excluir>Excluir</button>' : ''}
    </form>
  `, (f) => {
    const form = f.querySelector('[data-form]');
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const nome = form.nome.value.trim() || 'Avulsa';
      const v = parseValor(form.valor.value);
      if (!v) { aviso('Digite o valor'); return; }
      if (a) Object.assign(a, { nome, valor: v, pagamento: form.pagamento.value });
      else e.avulsos.push({ id: novoId(), nome, valor: v, pagamento: form.pagamento.value });
      gravar(); fecharFolha(); render(); aviso(a ? 'Conta avulsa atualizada' : `${nome} lançada`);
    });
    f.querySelector('[data-excluir]')?.addEventListener('click', () => {
      e.avulsos = e.avulsos.filter((x) => x.id !== a.id);
      gravar(); fecharFolha(); render(); aviso('Conta avulsa excluída');
    });
  });
}

// ---------- Backup ----------
async function salvarBackup() {
  const nome = `controle-backup-${isoHoje()}.json`;
  const arquivo = new File([JSON.stringify(e, null, 2)], nome, { type: 'application/json' });
  const celular = matchMedia('(pointer: coarse)').matches;
  try {
    if (celular && navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: 'Backup do Controle' });
      e.ultimoBackup = isoHoje(); gravar(); render(); aviso('Backup salvo');
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(arquivo);
  const link = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  e.ultimoBackup = isoHoje(); gravar(); render(); aviso('Backup baixado');
}

function restaurarBackup() {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
  input.addEventListener('change', async () => {
    const arq = input.files?.[0];
    if (!arq) return;
    try {
      const dados = JSON.parse(await arq.text());
      if (!pareceBackup(dados)) throw new Error('formato');
      if (e && !confirm('Isso troca todos os dados atuais pelos do backup. Continuar?')) return;
      e = completar(dados);
      gravar(); ui.ciclo = null; render(); aviso('Backup restaurado');
    } catch {
      aviso('Esse arquivo não é um backup válido');
    }
  });
  input.click();
}

// ---------- Ações ----------
const acoes = {
  fechar: fecharFolha,
  lancar: () => folhaGasto(),
  'editar-gasto': (el) => { const g = e.gastos.find((x) => x.id === el.dataset.id); if (g) folhaGasto(g); },
  entrada: () => folhaEntrada(cicloAtual()),
  'ciclo-ant': () => { const p = anterior(cicloAtual()); if (p.data >= pagDeKey(e.inicio).data) { ui.ciclo = p.key; render(); } },
  'ciclo-prox': () => { ui.ciclo = seguinte(cicloAtual()).key; render(); },
  'nova-conta': () => folhaConta(),
  'editar-conta': (el) => { const c = e.contas.find((x) => x.id === el.dataset.id); if (c) folhaConta(c); },
  luz: folhaLuz,
  'nova-avulsa': () => folhaAvulsa(),
  'editar-avulsa': (el) => { const a = e.avulsos.find((x) => x.id === el.dataset.id); if (a) folhaAvulsa(a); },
  backup: salvarBackup,
  restaurar: restaurarBackup,
  'do-zero': () => {
    if (!confirm('Começar sem nenhuma conta cadastrada? Você vai preencher tudo à mão.')) return;
    e = padrao();
    e.inicio = pagamentoDe(new Date()).key;
    gravar(); irPara('contas');
  }
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  const fn = acoes[el.dataset.acao];
  if (fn) { ev.preventDefault(); fn(el, ev); }
});

document.addEventListener('change', (ev) => {
  const key = ev.target.dataset?.marcar;
  if (!key) return;
  const p = cicloAtual();
  const m = (e.marcados[p.key] ||= {});
  if (ev.target.checked) m[key] = true; else delete m[key];
  gravar(); render();
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') fecharFolha(); });

window.addEventListener('hashchange', () => irPara(location.hash.slice(1)));

// Volta para o pagamento atual quando o app reabre num outro dia.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !document.body.classList.contains('travado')) render();
});

irPara(location.hash.slice(1) || 'inicio');

navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

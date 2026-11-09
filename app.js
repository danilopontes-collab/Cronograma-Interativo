'use strict';

/* =========================================================
   Calendário de Estudos – Residência
   ========================================================= */

/* ---------------- Constantes ---------------- */

// Chave com a versão do formato dos dados. Se o formato mudar no futuro,
// cria-se uma "v2" e a função migrar() converte os dados antigos.
const CHAVE_DADOS = 'calendarioResidencia.v1';
const VERSAO_DADOS = 1;
const CHAVE_PREFS = 'calendarioResidencia.preferencias';

const AREAS = {
  cm:   { nome: 'Clínica Médica', sigla: 'CM' },
  cir:  { nome: 'Cirurgia', sigla: 'CIR' },
  go:   { nome: 'Ginecologia e Obstetrícia', sigla: 'GO' },
  ped:  { nome: 'Pediatria', sigla: 'PED' },
  prev: { nome: 'Medicina Preventiva', sigla: 'PREV' },
};

const TIPOS = {
  aula:     'Aula',
  questoes: 'Questões',
  revisao:  'Revisão',
};

const ICONES = {
  aula:     '▶',
  questoes: '✎',
  revisao:  '↻',
};

const DIAS_CURTOS =['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DIAS_LONGOS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/* ---------------- Datas ---------------- */

const pad = (n) => String(n).padStart(2, '0');

/** Data -> "aaaa-mm-dd" (formato interno de armazenamento) */
function paraChave(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "aaaa-mm-dd" -> Data local à meia-noite */
function deChave(k) {
  const [a, m, d] = k.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Data -> "dd/mm/aaaa" */
function formatar(d) {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function hoje() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function somarDias(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Índice do dia na semana começando na segunda (0 = segunda … 6 = domingo) */
function indiceSemana(d) {
  return (d.getDay() + 6) % 7;
}

function inicioSemana(d) {
  return somarDias(d, -indiceSemana(d));
}

function mesmaData(a, b) {
  return paraChave(a) === paraChave(b);
}

/* ---------------- Armazenamento ---------------- */

function dadosVazios() {
  return { versao: VERSAO_DADOS, tarefas: [] };
}

/** Converte dados de versões antigas para a versão atual (nunca apaga). */
function migrar(dados) {
  if (!dados || typeof dados !== 'object') return dadosVazios();
  if (!Array.isArray(dados.tarefas)) dados.tarefas = [];
  // Exemplo para o futuro:
  // if (dados.versao === 1) { ...converter...; dados.versao = 2; }
  dados.versao = VERSAO_DADOS;
  return dados;
}

function carregarDados() {
  let bruto = null;
  try {
    bruto = localStorage.getItem(CHAVE_DADOS);
    if (!bruto) return dadosVazios();
    return migrar(JSON.parse(bruto));
  } catch (erro) {
    console.error('Erro ao ler os dados salvos:', erro);
    // Guarda uma cópia do conteúdo ilegível para nada se perder.
    try {
      if (bruto) localStorage.setItem(`${CHAVE_DADOS}.ilegivel.${Date.now()}`, bruto);
    } catch (_) { /* ignora */ }
    return dadosVazios();
  }
}

function salvarDados() {
  try {
    localStorage.setItem(CHAVE_DADOS, JSON.stringify(estado.dados));
  } catch (erro) {
    console.error(erro);
    alert('Não foi possível salvar no navegador. Faça um backup para não perder seus dados.');
  }
}

function carregarPrefs() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_PREFS)) || {};
  } catch (_) {
    return {};
  }
}

function salvarPrefs() {
  try {
    localStorage.setItem(CHAVE_PREFS, JSON.stringify({
      visao: estado.visao,
      tema: estado.tema,
      ultimoBackup: estado.ultimoBackup,
      periodoProgresso: estado.periodoProgresso,
    }));
  } catch (_) { /* ignora */ }
}

/* ---------------- Estado ---------------- */

const prefs = carregarPrefs();

const estado = {
  dados: carregarDados(),
  visao: ['dia', 'semana', 'mes'].includes(prefs.visao) ? prefs.visao : 'semana',
  cursor: hoje(), // data de referência do período exibido
  tema: prefs.tema === 'claro' ? 'claro' : 'escuro',
  ultimoBackup: prefs.ultimoBackup || null,
  periodoProgresso: ['dia', 'semana', 'mes'].includes(prefs.periodoProgresso) ? prefs.periodoProgresso : 'semana',
};

function aplicarTema() {
  if (estado.tema === 'claro') document.documentElement.dataset.tema = 'claro';
  else delete document.documentElement.dataset.tema;
  document.getElementById('btn-tema').textContent = estado.tema === 'claro' ? '🌙 Modo escuro' : '☀️ Modo claro';
}

/** Tarefas de um dia, já na ordem definida pelo usuário */
function tarefasDoDia(chave) {
  return estado.dados.tarefas
    .filter((t) => t.data === chave)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/* ---------------- Utilidades de DOM ---------------- */

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}

/* ---------------- Cartão de tarefa ---------------- */

function cartaoTarefa(t, compacta) {
  const li = el('li', `tarefa area-${t.area} tipo-${t.tipo}${t.concluida ? ' concluida' : ''}${compacta ? ' compacta' : ''}`);
  li.dataset.id = t.id;
  li.draggable = true;
  const atrasada = estaAtrasada(t);
  if (atrasada) li.classList.add('atrasada');

  const marcar = el('button', 'marcar');
  marcar.type = 'button';
  marcar.title = t.concluida ? 'Marcar como não concluída' : 'Marcar como concluída';
  marcar.setAttribute('aria-label', marcar.title);
  li.appendChild(marcar);

  const corpo = el('div', 'tarefa-corpo');
  corpo.tabIndex = 0;
  corpo.setAttribute('role', 'button');
  corpo.title = 'Clique para editar';
  const titulo = el('div', 'tarefa-titulo', t.titulo);
  corpo.appendChild(titulo);

  if (!compacta) {
    const meta = el('div', 'tarefa-meta');
    meta.appendChild(el('span', 'etiqueta tipo', `${ICONES[t.tipo]} ${TIPOS[t.tipo]}`));
    meta.appendChild(el('span', 'etiqueta', AREAS[t.area]?.sigla ?? ''));
    if (t.curso) meta.appendChild(el('span', 'etiqueta', t.curso));
    else if (temEscolhaPendente(t)) meta.appendChild(el('span', 'etiqueta escolher', 'Escolher curso'));
    if (t.dataFixa) meta.appendChild(el('span', 'etiqueta fixa-tag', '📌 Data fixa'));
    if (atrasada) meta.appendChild(el('span', 'etiqueta atrasada-tag', 'Atrasada'));
    if (t.tipo === 'questoes' && t.concluida && t.feitas > 0) {
      const pct = Math.round((t.acertos / t.feitas) * 100);
      meta.appendChild(el('span', 'etiqueta', `${t.acertos}/${t.feitas} (${pct}%)`));
    }
    corpo.appendChild(meta);
  }

  if (estado.visao === 'dia' && t.observacao) {
    corpo.appendChild(el('div', 'tarefa-obs', t.observacao));
  }

  li.appendChild(corpo);
  return li;
}

function listaDoDia(chave, compacta) {
  const ul = el('ul', 'lista-tarefas');
  ul.dataset.data = chave;
  const tarefas = tarefasDoDia(chave);
  if (tarefas.length === 0 && !compacta) {
    ul.appendChild(el('li', 'vazio', 'Sem tarefas'));
  }
  tarefas.forEach((t) => ul.appendChild(cartaoTarefa(t, compacta)));
  return ul;
}

/* ---------------- Visões ---------------- */

function botaoAdicionar(d) {
  const b = el('button', 'btn-add-dia', '+');
  b.type = 'button';
  b.dataset.adicionar = paraChave(d);
  b.title = `Adicionar tarefa em ${formatar(d)}`;
  b.setAttribute('aria-label', b.title);
  return b;
}

function colunaDia(d, nomeLongo) {
  const coluna = el('section', 'dia-coluna');
  if (mesmaData(d, hoje())) coluna.classList.add('hoje');
  if (indiceSemana(d) >= 5) coluna.classList.add('fim-semana');

  const cab = el('div', 'dia-cab');
  cab.appendChild(el('span', 'nome', nomeLongo ? DIAS_LONGOS[indiceSemana(d)] : DIAS_CURTOS[indiceSemana(d)]));
  const lado = el('span', 'lado');
  lado.appendChild(el('span', 'data', nomeLongo ? formatar(d) : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`));
  lado.appendChild(botaoAdicionar(d));
  cab.appendChild(lado);
  coluna.appendChild(cab);

  coluna.appendChild(listaDoDia(paraChave(d), false));
  return coluna;
}

function renderDia(destino) {
  const envolve = el('div', 'visao-dia');
  envolve.appendChild(colunaDia(estado.cursor, true));
  destino.appendChild(envolve);
}

function renderSemana(destino) {
  const grade = el('div', 'grade-semana');
  const ini = inicioSemana(estado.cursor);
  for (let i = 0; i < 7; i++) grade.appendChild(colunaDia(somarDias(ini, i), false));
  destino.appendChild(grade);
}

function renderMes(destino) {
  const cab = el('div', 'cab-mes');
  DIAS_CURTOS.forEach((n) => cab.appendChild(el('div', null, n)));
  destino.appendChild(cab);

  const grade = el('div', 'grade-mes');
  const mes = estado.cursor.getMonth();
  const primeiro = new Date(estado.cursor.getFullYear(), mes, 1);
  const ultimo = new Date(estado.cursor.getFullYear(), mes + 1, 0);
  let d = inicioSemana(primeiro);
  const fim = somarDias(inicioSemana(ultimo), 6);

  while (d <= fim) {
    const celula = el('section', 'celula-mes');
    if (d.getMonth() !== mes) celula.classList.add('outro-mes');
    if (mesmaData(d, hoje())) celula.classList.add('hoje');
    const topo = el('div', 'topo-celula');
    topo.appendChild(el('span', 'num', String(d.getDate())));
    topo.appendChild(botaoAdicionar(d));
    celula.appendChild(topo);
    celula.appendChild(listaDoDia(paraChave(d), true));
    grade.appendChild(celula);
    d = somarDias(d, 1);
  }
  destino.appendChild(grade);
}

function rotuloPeriodo() {
  const c = estado.cursor;
  if (estado.visao === 'dia') return `${DIAS_LONGOS[indiceSemana(c)]}, ${formatar(c)}`;
  if (estado.visao === 'semana') {
    const ini = inicioSemana(c);
    return `${formatar(ini)} – ${formatar(somarDias(ini, 6))}`;
  }
  return `${MESES[c.getMonth()]} de ${c.getFullYear()}`;
}

function render() {
  const destino = document.getElementById('calendario');
  destino.replaceChildren();
  if (estado.visao === 'dia') renderDia(destino);
  else if (estado.visao === 'semana') renderSemana(destino);
  else renderMes(destino);

  document.getElementById('rotulo-periodo').textContent = rotuloPeriodo();
  atualizarInfoBackup();
  atualizarInfoCronograma();
  atualizarInfoAtrasadas();
  renderProgresso();
  document.querySelectorAll('.btn-visao[data-visao]').forEach((b) => {
    const ativo = b.dataset.visao === estado.visao;
    b.classList.toggle('ativo', ativo);
    b.setAttribute('aria-pressed', ativo);
  });
}

function renderLegenda() {
  const leg = document.getElementById('legenda');
  leg.appendChild(el('div'));
  Object.values(TIPOS).forEach((n) => leg.appendChild(el('div', 'cab', n)));
  Object.entries(AREAS).forEach(([cod, a]) => {
    leg.appendChild(el('div', null, a.nome));
    Object.keys(TIPOS).forEach((tipo) => {
      const am = el('div', 'amostra');
      am.style.background = `var(--${cod}-${tipo})`;
      am.title = `${a.nome} – ${TIPOS[tipo]}`;
      leg.appendChild(am);
    });
  });
}

/* ---------------- Painel de progresso ---------------- */

/** Período do painel, sempre em torno da data que está aberta no calendário */
function periodoDoProgresso() {
  const c = estado.cursor;
  if (estado.periodoProgresso === 'dia') {
    return { ini: c, fim: c, rotulo: `${DIAS_LONGOS[indiceSemana(c)]}, ${formatar(c)}` };
  }
  if (estado.periodoProgresso === 'semana') {
    const ini = inicioSemana(c);
    const fim = somarDias(ini, 6);
    return { ini, fim, rotulo: `Semana de ${formatar(ini)} a ${formatar(fim)}` };
  }
  const ini = new Date(c.getFullYear(), c.getMonth(), 1);
  const fim = new Date(c.getFullYear(), c.getMonth() + 1, 0);
  return { ini, fim, rotulo: `${MESES[c.getMonth()]} de ${c.getFullYear()}` };
}

function calcularProgresso(ini, fim) {
  const a = paraChave(ini);
  const b = paraChave(fim);
  const tarefas = estado.dados.tarefas.filter((t) => t.data >= a && t.data <= b);
  const concluidas = tarefas.filter((t) => t.concluida);
  const questoes = concluidas.filter((t) => t.tipo === 'questoes' && t.feitas > 0);

  const porArea = {};
  Object.keys(AREAS).forEach((cod) => { porArea[cod] = { feitas: 0, acertos: 0 }; });
  questoes.forEach((t) => {
    porArea[t.area].feitas += t.feitas;
    porArea[t.area].acertos += t.acertos;
  });

  return {
    total: tarefas.length,
    concluidas: concluidas.length,
    feitas: questoes.reduce((s, t) => s + t.feitas, 0),
    acertos: questoes.reduce((s, t) => s + t.acertos, 0),
    porArea,
  };
}

const pct = (parte, todo) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);

function barra(percentual, cor) {
  const b = el('div', 'barra');
  const preenchido = el('div');
  preenchido.style.width = `${Math.max(0, Math.min(100, percentual))}%`;
  if (cor) preenchido.style.background = cor;
  b.appendChild(preenchido);
  return b;
}

function renderProgresso() {
  const { ini, fim, rotulo } = periodoDoProgresso();
  document.getElementById('prog-rotulo').textContent = rotulo;
  document.querySelectorAll('.btn-visao[data-periodo]').forEach((b) => {
    const ativo = b.dataset.periodo === estado.periodoProgresso;
    b.classList.toggle('ativo', ativo);
    b.setAttribute('aria-pressed', ativo);
  });

  const p = calcularProgresso(ini, fim);
  const destino = document.getElementById('prog-conteudo');
  destino.replaceChildren();

  if (p.total === 0) {
    destino.appendChild(el('p', 'texto-suave', 'Nenhuma tarefa neste período.'));
    return;
  }

  // Tarefas concluídas
  const b1 = el('div', 'prog-bloco');
  b1.appendChild(el('h3', null, 'Tarefas concluídas'));
  b1.appendChild(el('div', 'prog-numero', `${pct(p.concluidas, p.total)}%`));
  b1.appendChild(el('div', 'prog-sub', `${p.concluidas} de ${p.total} ${p.total === 1 ? 'tarefa' : 'tarefas'}`));
  b1.appendChild(barra(pct(p.concluidas, p.total)));
  destino.appendChild(b1);

  // Questões
  const b2 = el('div', 'prog-bloco');
  b2.appendChild(el('h3', null, 'Questões'));
  const duas = el('div', 'prog-duas');
  const feitas = el('div');
  feitas.appendChild(el('div', 'prog-numero', String(p.feitas)));
  feitas.appendChild(el('div', 'prog-sub', 'feitas'));
  const acerto = el('div');
  acerto.appendChild(el('div', 'prog-numero', p.feitas ? `${pct(p.acertos, p.feitas)}%` : '—'));
  acerto.appendChild(el('div', 'prog-sub', p.feitas ? `de acerto (${p.acertos})` : 'de acerto'));
  duas.appendChild(feitas);
  duas.appendChild(acerto);
  b2.appendChild(duas);
  destino.appendChild(b2);

  // Acerto por grande área
  const b3 = el('div', 'prog-bloco');
  b3.appendChild(el('h3', null, 'Acerto por grande área'));
  Object.entries(AREAS).forEach(([cod, a]) => {
    const dados = p.porArea[cod];
    const linha = el('div', 'prog-area');
    const nome = el('span', null, a.sigla);
    nome.title = a.nome;
    linha.appendChild(nome);
    if (dados.feitas > 0) {
      const v = pct(dados.acertos, dados.feitas);
      linha.appendChild(barra(v, `var(--${cod}-questoes)`));
      linha.appendChild(el('span', 'valor', `${v}% (${dados.acertos}/${dados.feitas})`));
    } else {
      linha.appendChild(barra(0));
      linha.appendChild(el('span', 'valor sem-dados', '—'));
    }
    b3.appendChild(linha);
  });
  destino.appendChild(b3);
}

/* ---------------- Utilidades gerais ---------------- */

function novoId() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function acharTarefa(id) {
  return estado.dados.tarefas.find((t) => t.id === id);
}

function proximaOrdem(chave) {
  const lista = tarefasDoDia(chave);
  return lista.length ? Math.max(...lista.map((t) => t.ordem ?? 0)) + 1 : 0;
}

/** "dd/mm/aaaa" -> "aaaa-mm-dd" (ou null se a data não existir) */
function lerDataBR(texto) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const [dia, mes, ano] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return paraChave(d);
}

/** Insere as barras automaticamente enquanto a data é digitada */
function aplicarMascaraData(input) {
  input.addEventListener('input', () => {
    const dig = input.value.replace(/\D/g, '').slice(0, 8);
    if (dig.length > 4) input.value = `${dig.slice(0, 2)}/${dig.slice(2, 4)}/${dig.slice(4)}`;
    else if (dig.length > 2) input.value = `${dig.slice(0, 2)}/${dig.slice(2)}`;
    else input.value = dig;
  });
}

/** Lê um número inteiro de um campo: '' -> null, inválido -> NaN */
function lerInteiro(input) {
  const v = input.value.trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

let temporizadorAviso = null;
function aviso(msg) {
  let caixa = document.querySelector('.aviso');
  if (!caixa) {
    caixa = el('div', 'aviso');
    caixa.setAttribute('role', 'status');
    document.body.appendChild(caixa);
  }
  caixa.textContent = msg;
  caixa.hidden = false;
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => { caixa.hidden = true; }, 3000);
}

/** Janela de confirmação. Devolve uma Promise com true (sim) ou false. */
function confirmar(titulo, texto, rotuloSim, perigo = true) {
  const dlg = document.getElementById('dlg-confirmar');
  document.getElementById('c-titulo').textContent = titulo;
  document.getElementById('c-texto').textContent = texto;
  const sim = document.getElementById('c-sim');
  sim.textContent = rotuloSim;
  sim.className = `btn ${perigo ? 'btn-perigo' : 'btn-primario'}`;
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise((resolver) => {
    dlg.addEventListener('close', () => resolver(dlg.returnValue === 'sim'), { once: true });
  });
}

/* ---------------- Formulário de tarefa ---------------- */

const form = {
  dlg: () => document.getElementById('dlg-tarefa'),
  titulo: () => document.getElementById('f-titulo'),
  area: () => document.getElementById('f-area'),
  data: () => document.getElementById('f-data'),
  curso: () => document.getElementById('f-curso'),
  feitas: () => document.getElementById('f-feitas'),
  acertos: () => document.getElementById('f-acertos'),
  obs: () => document.getElementById('f-obs'),
  concluida: () => document.getElementById('f-concluida'),
  erro: () => document.getElementById('f-erro'),
  tipo: () => document.querySelector('#form-tarefa input[name="tipo"]:checked').value,
  setTipo: (v) => { document.querySelector(`#form-tarefa input[name="tipo"][value="${v}"]`).checked = true; },
};

let editandoId = null;
let ultimaArea = 'cm';

function atualizarCamposQuestoes() {
  document.getElementById('f-bloco-questoes').hidden = form.tipo() !== 'questoes';
}

function mostrarErro(elemento, msg, campo) {
  elemento.textContent = msg;
  document.querySelectorAll('.invalido').forEach((c) => c.classList.remove('invalido'));
  if (campo) {
    campo.classList.add('invalido');
    campo.focus();
  }
}

function abrirFormulario(tarefa, dataPadrao) {
  editandoId = tarefa ? tarefa.id : null;
  document.getElementById('dlg-tarefa-titulo').textContent = tarefa ? 'Editar tarefa' : 'Nova tarefa';

  const chaveData = tarefa?.data ?? dataPadrao ?? paraChave(estado.visao === 'dia' ? estado.cursor : hoje());
  form.titulo().value = tarefa?.titulo ?? '';
  form.setTipo(tarefa?.tipo ?? 'aula');
  form.area().value = tarefa?.area ?? ultimaArea;
  form.data().value = formatar(deChave(chaveData));
  form.curso().value = tarefa?.curso ?? '';
  const temNumeros = tarefa && tarefa.tipo === 'questoes' && (tarefa.feitas > 0 || tarefa.concluida);
  form.feitas().value = temNumeros ? tarefa.feitas : '';
  form.acertos().value = temNumeros ? tarefa.acertos : '';
  form.obs().value = tarefa?.observacao ?? '';
  form.concluida().checked = !!tarefa?.concluida;
  document.getElementById('f-fixa').checked = !!tarefa?.dataFixa;
  document.getElementById('btn-excluir').hidden = !tarefa;

  mostrarErro(form.erro(), '');
  atualizarCamposQuestoes();
  renderOpcoes(tarefa);
  form.dlg().showModal();
  form.titulo().focus();
}

function salvarFormulario(evento) {
  evento.preventDefault();
  const erro = form.erro();

  const titulo = form.titulo().value.trim();
  if (!titulo) return mostrarErro(erro, 'Escreva um título para a tarefa.', form.titulo());

  const data = lerDataBR(form.data().value);
  if (!data) return mostrarErro(erro, 'Data inválida. Use o formato dd/mm/aaaa, por exemplo 11/01/2027.', form.data());

  const tipo = form.tipo();
  const concluida = form.concluida().checked;
  let feitas = 0;
  let acertos = 0;

  if (tipo === 'questoes') {
    const f = lerInteiro(form.feitas());
    const a = lerInteiro(form.acertos());
    if (Number.isNaN(f)) return mostrarErro(erro, 'Questões feitas deve ser um número inteiro (0 ou mais).', form.feitas());
    if (Number.isNaN(a)) return mostrarErro(erro, 'Acertos deve ser um número inteiro (0 ou mais).', form.acertos());
    if (concluida && !f) return mostrarErro(erro, 'Para marcar como concluída, informe quantas questões você fez.', form.feitas());
    feitas = f ?? 0;
    acertos = a ?? 0;
    if (acertos > feitas) return mostrarErro(erro, 'O número de acertos não pode ser maior que o de questões feitas.', form.acertos());
  }

  const area = form.area().value;
  ultimaArea = area;

  const campos = {
    titulo,
    tipo,
    area,
    data,
    curso: form.curso().value,
    observacao: form.obs().value.trim(),
    feitas,
    acertos,
    dataFixa: document.getElementById('f-fixa').checked,
  };

  if (editandoId) {
    const t = acharTarefa(editandoId);
    if (!t) return form.dlg().close();
    const escolheuMedcof = podeEscolherCurso(t) && campos.curso === 'Medcof';
    if (t.data !== data) campos.ordem = proximaOrdem(data);
    if (concluida && !t.concluida) campos.concluidaEm = new Date().toISOString();
    if (!concluida) campos.concluidaEm = null;
    Object.assign(t, campos, { concluida });
    if (escolheuMedcof) {
      const r = aplicarMedcof(t);
      aviso(r.n > 1
        ? `Medcof: ${r.n} aulas até ${formatar(r.ultimo)}. Questões e Revisão foram para ${formatar(r.depois)}.`
        : 'Curso escolhido: Medcof.');
    } else {
      aviso('Tarefa atualizada.');
    }
  } else {
    estado.dados.tarefas.push({
      id: novoId(),
      ...campos,
      ordem: proximaOrdem(data),
      concluida,
      concluidaEm: concluida ? new Date().toISOString() : null,
      criadaEm: new Date().toISOString(),
    });
    aviso(`Tarefa criada em ${formatar(deChave(data))}.`);
  }

  salvarDados();
  form.dlg().close();
  render();
}

/* ---------------- Escolha Medway / Medcof ---------------- */

/** Tema do cronograma que existe nos dois cursinhos e ainda não teve o curso escolhido */
function podeEscolherCurso(t) {
  return !!(t && t.tipo === 'aula' && t.opcoes && t.opcoes.medway && t.opcoes.medcof?.length && !t.dividida);
}

function temEscolhaPendente(t) {
  return podeEscolherCurso(t) && !t.curso;
}

function renderOpcoes(t) {
  const caixa = document.getElementById('f-opcoes');
  caixa.replaceChildren();
  const mostrar = podeEscolherCurso(t);
  caixa.hidden = !mostrar;
  if (!mostrar) return;

  const n = t.opcoes.medcof.length;
  caixa.appendChild(el('p', null, 'Este tema está nos dois cursinhos. Escolha no campo "Curso" qual aula vai assistir:'));
  caixa.appendChild(el('strong', null, 'Medway (1 aula):'));
  const ulW = el('ul');
  ulW.appendChild(el('li', null, t.opcoes.medway));
  caixa.appendChild(ulW);
  caixa.appendChild(el('strong', null, `Medcof (${n} ${n === 1 ? 'aula' : 'aulas'}):`));
  const ulC = el('ul');
  t.opcoes.medcof.forEach((a) => ulC.appendChild(el('li', null, a)));
  caixa.appendChild(ulC);
  if (n > 1) {
    caixa.appendChild(el('p', 'texto-suave',
      `Se escolher Medcof, esta tarefa vira ${n} aulas em dias úteis seguidos, e as Questões e a Revisão do tema vão para o dia útil depois da última aula.`));
  }
  caixa.appendChild(el('p', 'texto-suave', 'As Questões deste tema são sempre pela lista Medway.'));
}

function ehDiaUtil(d) {
  return indiceSemana(d) < 5;
}

function proximoDiaUtil(d) {
  let x = somarDias(d, 1);
  while (!ehDiaUtil(x)) x = somarDias(x, 1);
  return x;
}

/** Troca a aula do tema pelas aulas da Medcof (uma por dia útil) */
function aplicarMedcof(t) {
  const aulas = t.opcoes.medcof;
  t.dividida = true;
  t.curso = 'Medcof';
  t.titulo = aulas[0];

  let d = deChave(t.data);
  for (let i = 1; i < aulas.length; i++) {
    d = proximoDiaUtil(d);
    const k = paraChave(d);
    estado.dados.tarefas.push({
      ...t,
      id: novoId(),
      titulo: aulas[i],
      data: k,
      ordem: proximaOrdem(k),
      concluida: false,
      concluidaEm: null,
      observacao: '',
      criadaEm: new Date().toISOString(),
    });
  }

  const depois = proximoDiaUtil(d);
  if (aulas.length > 1) {
    const k = paraChave(depois);
    estado.dados.tarefas.forEach((x) => {
      if (x.tema === t.tema && x.tipo !== 'aula' && !x.concluida && x.data < k) {
        x.data = k;
        x.ordem = proximaOrdem(k);
      }
    });
  }
  return { n: aulas.length, ultimo: d, depois };
}

/* ---------------- Carregar cronograma ---------------- */

function diasUteisEntre(inicio, fim) {
  const lista = [];
  for (let d = deChave(inicio); paraChave(d) <= fim; d = somarDias(d, 1)) {
    if (ehDiaUtil(d)) lista.push(d);
  }
  return lista;
}

/**
 * Distribui os temas pelos dias úteis: Aula no dia D;
 * Questões (se houver Medway) e Revisão no dia útil seguinte.
 */
function gerarTarefasCronograma(cron) {
  const dias = diasUteisEntre(cron.inicio, cron.fim);
  const diasParaAula = dias.length - 1; // o último dia útil fica só para Questões/Revisão
  const total = cron.temas.length;
  const agora = new Date().toISOString();
  const ordens = {};
  const proxOrdem = (k) => {
    ordens[k] = (ordens[k] ?? proximaOrdem(k) - 1) + 1;
    return ordens[k];
  };

  const novas = [];
  cron.temas.forEach(([area, medway, medcof], i) => {
    const iDia = Math.floor((i * diasParaAula) / total);
    const dAula = paraChave(dias[iDia]);
    const dDepois = paraChave(dias[iDia + 1]);
    const nome = medway || medcof[0];
    const base = {
      area,
      tema: `${cron.id}-${String(i + 1).padStart(3, '0')}`,
      origem: cron.id,
      observacao: '',
      concluida: false,
      concluidaEm: null,
      feitas: 0,
      acertos: 0,
      criadaEm: agora,
    };
    const ambos = !!medway && medcof.length > 0;

    novas.push({
      ...base,
      id: novoId(),
      titulo: nome,
      tipo: 'aula',
      data: dAula,
      ordem: proxOrdem(dAula),
      curso: ambos ? '' : (medway ? 'Medway' : 'Medcof'),
      opcoes: { medway: medway || null, medcof: medcof.slice() },
    });
    if (medway) {
      novas.push({ ...base, id: novoId(), titulo: `Questões – ${medway}`, tipo: 'questoes', data: dDepois, ordem: proxOrdem(dDepois), curso: 'Medway' });
    }
    novas.push({
      ...base,
      id: novoId(),
      titulo: `Revisão – ${nome}`,
      tipo: 'revisao',
      data: dDepois,
      ordem: proxOrdem(dDepois),
      curso: '',
      observacao: 'Criar os flashcards deste tema no app de revisão.',
    });
  });
  return novas;
}

function cronogramaCarregado() {
  return estado.dados.tarefas.some((t) => t.origem === CRONOGRAMA_2027.id);
}

function atualizarInfoCronograma() {
  const info = document.getElementById('info-cronograma');
  const botao = document.getElementById('btn-carregar-cronograma');
  const cron = CRONOGRAMA_2027;
  if (cronogramaCarregado()) {
    const pendentes = estado.dados.tarefas.filter(temEscolhaPendente).length;
    info.textContent = `Cronograma 2027 carregado. ${pendentes} ${pendentes === 1 ? 'aula aguarda' : 'aulas aguardam'} a escolha entre Medway e Medcof.`;
    botao.hidden = true;
  } else {
    info.textContent = `${cron.temas.length} temas (Medcof Alta/Diamante + Medway), de ${formatar(deChave(cron.inicio))} a ${formatar(deChave(cron.fim))}, de segunda a sexta.`;
    botao.hidden = false;
  }
}

async function carregarCronograma() {
  const cron = CRONOGRAMA_2027;
  if (cronogramaCarregado()) {
    aviso('O cronograma 2027 já está no calendário.');
    return;
  }
  const novas = gerarTarefasCronograma(cron);
  const conta = (tipo) => novas.filter((t) => t.tipo === tipo).length;
  const ok = await confirmar(
    'Carregar cronograma 2027?',
    `Serão adicionadas ${novas.length} tarefas (${conta('aula')} aulas, ${conta('questoes')} listas de questões e ${conta('revisao')} revisões) de ${formatar(deChave(cron.inicio))} a ${formatar(deChave(cron.fim))}, de segunda a sexta. Suas tarefas atuais não serão alteradas.`,
    'Carregar',
    false,
  );
  if (!ok) return;

  estado.dados.tarefas.push(...novas);
  salvarDados();
  estado.cursor = deChave(cron.inicio);
  estado.visao = 'semana';
  salvarPrefs();
  render();
  aviso(`Cronograma carregado: ${novas.length} tarefas.`);
}

/* ---------------- Replanejar atrasadas ---------------- */

function estaAtrasada(t) {
  return !t.concluida && t.data < paraChave(hoje());
}

/**
 * Calcula o replanejamento sem alterar nada.
 * As tarefas pendentes são agrupadas por tema (Aula + Questões + Revisão), na ordem
 * original. Cada aula ocupa o próximo dia permitido a partir de hoje (no máximo uma
 * aula por dia), mas nunca vai para antes da sua data original. Questões e Revisão
 * ficam no dia seguinte à aula. Os dias do cronograma sem aula funcionam como folga:
 * é neles que o atraso é absorvido, e daí em diante nada muda.
 */
function calcularReplanejamento(usarSabado) {
  const hojeK = paraChave(hoje());
  const porOrdem = (a, b) => a.data.localeCompare(b.data) || (a.ordem ?? 0) - (b.ordem ?? 0);
  const movaveis = estado.dados.tarefas.filter((t) => !t.concluida && !t.dataFixa).sort(porOrdem);
  const atrasadas = movaveis.filter((t) => t.data < hojeK);
  if (atrasadas.length === 0) return null;

  const permitido = (d) => indiceSemana(d) < 5 || (usarSabado && indiceSemana(d) === 5);
  const primeiroPermitido = (d) => {
    let x = d;
    while (!permitido(x)) x = somarDias(x, 1);
    return x;
  };
  const proximoPermitido = (d) => primeiroPermitido(somarDias(d, 1));
  const maior = (a, b) => (a > b ? a : b);

  // Dias que já têm uma aula que não vai mudar (data fixa ou já concluída)
  const diasComAulaFixa = new Set(
    estado.dados.tarefas
      .filter((t) => t.tipo === 'aula' && (t.dataFixa || t.concluida) && t.data >= hojeK)
      .map((t) => t.data),
  );

  // Agrupa por tema; tarefas avulsas formam um grupo cada
  const grupos = new Map();
  movaveis.forEach((t) => {
    const chave = t.tema || `avulsa-${t.id}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(t);
  });

  const inicio = primeiroPermitido(hoje());
  let cursor = inicio; // próximo dia livre para uma aula
  const novaData = new Map(); // id -> nova data
  const definir = (t, d) => {
    const k = paraChave(d);
    if (k !== t.data) novaData.set(t.id, k);
  };

  for (const lista of grupos.values()) {
    const aulas = lista.filter((t) => t.tipo === 'aula' && t.tema);
    const outras = lista.filter((t) => !(t.tipo === 'aula' && t.tema));

    let ultimaAula = null;
    aulas.forEach((t) => {
      let d = maior(cursor, deChave(t.data));
      d = primeiroPermitido(d);
      while (diasComAulaFixa.has(paraChave(d))) d = proximoPermitido(d);
      definir(t, d);
      ultimaAula = d;
      cursor = proximoPermitido(d);
    });

    // Questões, Revisão e tarefas avulsas: nunca antes de hoje nem antes da aula do tema
    const minimo = ultimaAula ? proximoPermitido(ultimaAula) : inicio;
    outras.forEach((t) => {
      const original = deChave(t.data);
      definir(t, original >= minimo ? original : minimo);
    });
  }

  const ultimaAntes = movaveis[movaveis.length - 1].data;
  const ultimaDepois = movaveis.reduce((m, t) => {
    const d = novaData.get(t.id) ?? t.data;
    return d > m ? d : m;
  }, '');
  const datasAtrasadas = atrasadas.map((t) => t.data);
  return {
    atrasadas: atrasadas.length,
    desde: datasAtrasadas[0],
    ate: datasAtrasadas[datasAtrasadas.length - 1],
    novaData,
    ultimaAntes,
    ultimaDepois,
  };
}

function resumoReplanejamento() {
  const r = calcularReplanejamento(document.getElementById('r-sabado').checked);
  const caixa = document.getElementById('r-resumo');
  caixa.replaceChildren();
  const linha = (txt) => caixa.appendChild(el('p', null, txt));
  linha(`${r.atrasadas} ${r.atrasadas === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} (de ${formatar(deChave(r.desde))} a ${formatar(deChave(r.ate))}).`);
  linha(`${r.novaData.size} ${r.novaData.size === 1 ? 'tarefa muda' : 'tarefas mudam'} de data.`);
  linha(r.ultimaDepois === r.ultimaAntes
    ? `A última tarefa continua em ${formatar(deChave(r.ultimaAntes))}: a folga absorve o atraso.`
    : `A última tarefa passa de ${formatar(deChave(r.ultimaAntes))} para ${formatar(deChave(r.ultimaDepois))}.`);
  if (cronogramaCarregado() && r.ultimaDepois > CRONOGRAMA_2027.fim) {
    const p = el('p', 'erro', `Atenção: o cronograma passa de ${formatar(deChave(CRONOGRAMA_2027.fim))}. Considere usar os sábados.`);
    caixa.appendChild(p);
  }
}

function abrirReplanejar() {
  if (!calcularReplanejamento(false)) {
    aviso('Nenhuma tarefa atrasada. Tudo em dia!');
    return;
  }
  resumoReplanejamento();
  document.getElementById('dlg-replanejar').showModal();
}

function aplicarReplanejamento(evento) {
  evento.preventDefault();
  const r = calcularReplanejamento(document.getElementById('r-sabado').checked);
  document.getElementById('dlg-replanejar').close();
  if (!r) return;

  const movidas = new Set(r.novaData.keys());
  const diasAfetados = new Set(r.novaData.values());
  // Ordem dos movidos: a mesma em que foram calculados (data e ordem originais)
  const ordemCalculo = [...r.novaData.keys()];
  ordemCalculo.forEach((id) => { acharTarefa(id).data = r.novaData.get(id); });

  diasAfetados.forEach((k) => {
    const doDia = estado.dados.tarefas.filter((t) => t.data === k);
    const ficaram = doDia.filter((t) => !movidas.has(t.id)).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
    const chegaram = ordemCalculo.filter((id) => r.novaData.get(id) === k).map(acharTarefa);
    [...ficaram, ...chegaram].forEach((t, i) => { t.ordem = i; });
  });

  salvarDados();
  estado.cursor = hoje();
  render();
  aviso(`Replanejado: ${r.novaData.size} tarefas mudaram de data.`);
}

function atualizarInfoAtrasadas() {
  const n = estado.dados.tarefas.filter(estaAtrasada).length;
  document.getElementById('info-atrasadas').textContent = n
    ? `${n} ${n === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}.`
    : 'Nenhuma tarefa atrasada.';
}

async function excluirTarefaAtual() {
  const t = acharTarefa(editandoId);
  if (!t) return;
  const ok = await confirmar(
    'Excluir tarefa?',
    `A tarefa "${t.titulo}" será excluída. Isso não pode ser desfeito.`,
    'Excluir',
  );
  if (!ok) return;
  estado.dados.tarefas = estado.dados.tarefas.filter((x) => x.id !== t.id);
  salvarDados();
  form.dlg().close();
  render();
  aviso('Tarefa excluída.');
}

/* ---------------- Concluir com um clique ---------------- */

let concluindoId = null;

function alternarConcluida(id) {
  const t = acharTarefa(id);
  if (!t) return;

  if (t.concluida) {
    t.concluida = false;
    t.concluidaEm = null;
    salvarDados();
    render();
    return;
  }

  if (t.tipo === 'questoes') {
    concluindoId = id;
    document.getElementById('q-nome').textContent = t.titulo;
    document.getElementById('q-feitas').value = t.feitas > 0 ? t.feitas : '';
    document.getElementById('q-acertos').value = t.feitas > 0 ? t.acertos : '';
    mostrarErro(document.getElementById('q-erro'), '');
    document.getElementById('dlg-questoes').showModal();
    document.getElementById('q-feitas').focus();
    return;
  }

  t.concluida = true;
  t.concluidaEm = new Date().toISOString();
  salvarDados();
  render();
}

function salvarQuestoes(evento) {
  evento.preventDefault();
  const erro = document.getElementById('q-erro');
  const cFeitas = document.getElementById('q-feitas');
  const cAcertos = document.getElementById('q-acertos');
  const feitas = lerInteiro(cFeitas);
  const acertos = lerInteiro(cAcertos);

  if (!feitas) return mostrarErro(erro, 'Informe quantas questões você fez (1 ou mais).', cFeitas);
  if (acertos === null || Number.isNaN(acertos)) return mostrarErro(erro, 'Informe quantas você acertou (0 ou mais).', cAcertos);
  if (acertos > feitas) return mostrarErro(erro, 'O número de acertos não pode ser maior que o de questões feitas.', cAcertos);

  const t = acharTarefa(concluindoId);
  if (t) {
    Object.assign(t, { feitas, acertos, concluida: true, concluidaEm: new Date().toISOString() });
    salvarDados();
    render();
    aviso(`Concluída: ${acertos}/${feitas} (${Math.round((acertos / feitas) * 100)}% de acerto).`);
  }
  document.getElementById('dlg-questoes').close();
}

/* ---------------- Arrastar e soltar ---------------- */

let arrastandoId = null;
const indicadorSoltar = el('li', 'indicador-soltar');
indicadorSoltar.setAttribute('aria-hidden', 'true');

/** Lista de tarefas do dia sob o mouse (coluna da semana, célula do mês ou dia) */
function listaSobMouse(e) {
  const recipiente = e.target.closest('.dia-coluna, .celula-mes');
  return recipiente ? recipiente.querySelector('.lista-tarefas') : null;
}

/** Posição onde a tarefa será inserida, conforme a altura do mouse */
function posicaoInsercao(lista, y) {
  const cartoes = [...lista.querySelectorAll('.tarefa')].filter((c) => c.dataset.id !== arrastandoId);
  for (let i = 0; i < cartoes.length; i++) {
    const r = cartoes[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return { indice: i, antesDe: cartoes[i] };
  }
  return { indice: cartoes.length, antesDe: null };
}

function limparArraste() {
  arrastandoId = null;
  indicadorSoltar.remove();
  document.querySelectorAll('.alvo-soltar').forEach((x) => x.classList.remove('alvo-soltar'));
  document.querySelectorAll('.arrastando').forEach((x) => x.classList.remove('arrastando'));
}

/** Move a tarefa para outro dia (ou outra posição no mesmo dia) e renumera a ordem */
function moverTarefa(id, novaData, indice) {
  const t = acharTarefa(id);
  if (!t) return;
  const origem = t.data;
  const posAntiga = tarefasDoDia(origem).findIndex((x) => x.id === id);
  if (origem === novaData && posAntiga === indice) return;

  const destino = tarefasDoDia(novaData).filter((x) => x.id !== id);
  destino.splice(indice, 0, t);
  t.data = novaData;
  destino.forEach((x, i) => { x.ordem = i; });
  if (origem !== novaData) tarefasDoDia(origem).forEach((x, i) => { x.ordem = i; });

  salvarDados();
  render();
  if (origem !== novaData) aviso(`Tarefa movida para ${formatar(deChave(novaData))}.`);
}

function ativarArrastar(cal) {
  cal.addEventListener('dragstart', (e) => {
    const cartao = e.target.closest('.tarefa');
    if (!cartao) return;
    arrastandoId = cartao.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', arrastandoId);
    requestAnimationFrame(() => cartao.classList.add('arrastando'));
  });

  cal.addEventListener('dragover', (e) => {
    if (!arrastandoId) return;
    const lista = listaSobMouse(e);
    if (!lista) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const recipiente = lista.closest('.dia-coluna, .celula-mes');
    if (!recipiente.classList.contains('alvo-soltar')) {
      document.querySelectorAll('.alvo-soltar').forEach((x) => x.classList.remove('alvo-soltar'));
      recipiente.classList.add('alvo-soltar');
    }
    const { antesDe } = posicaoInsercao(lista, e.clientY);
    if (antesDe) {
      if (indicadorSoltar.nextSibling !== antesDe) lista.insertBefore(indicadorSoltar, antesDe);
    } else if (lista.lastElementChild !== indicadorSoltar) {
      lista.appendChild(indicadorSoltar);
    }
  });

  cal.addEventListener('drop', (e) => {
    if (!arrastandoId) return;
    const lista = listaSobMouse(e);
    if (!lista) return;
    e.preventDefault();
    const id = arrastandoId;
    const { indice } = posicaoInsercao(lista, e.clientY);
    limparArraste();
    moverTarefa(id, lista.dataset.data, indice);
  });

  cal.addEventListener('dragend', limparArraste);
}

/* ---------------- Backup ---------------- */

function atualizarInfoBackup() {
  const n = estado.dados.tarefas.length;
  const ultimo = estado.ultimoBackup ? `Último backup: ${formatar(new Date(estado.ultimoBackup))}.` : 'Nenhum backup feito ainda.';
  document.getElementById('info-backup').textContent = `${n} ${n === 1 ? 'tarefa salva' : 'tarefas salvas'} neste navegador. ${ultimo}`;
}

function exportarBackup() {
  const conteudo = {
    aplicativo: 'calendarioResidencia',
    versao: VERSAO_DADOS,
    exportadoEm: new Date().toISOString(),
    dados: estado.dados,
  };
  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-calendario-${paraChave(hoje())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  estado.ultimoBackup = new Date().toISOString();
  salvarPrefs();
  atualizarInfoBackup();
  aviso('Backup exportado. O arquivo foi para a pasta Downloads.');
}

function inteiroSeguro(v) {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** Confere e corrige uma tarefa vinda de um arquivo. Devolve null se for inválida. */
function sanitizarTarefa(t) {
  if (!t || typeof t !== 'object') return null;
  if (typeof t.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t.data)) return null;
  if (!TIPOS[t.tipo] || !AREAS[t.area]) return null;
  const feitas = inteiroSeguro(t.feitas);
  return {
    ...t,
    id: typeof t.id === 'string' && t.id ? t.id : novoId(),
    titulo: String(t.titulo ?? '').slice(0, 200) || '(sem título)',
    ordem: Number.isFinite(t.ordem) ? t.ordem : 0,
    curso: ['Medway', 'Medcof'].includes(t.curso) ? t.curso : '',
    observacao: String(t.observacao ?? ''),
    concluida: !!t.concluida,
    feitas,
    acertos: Math.min(inteiroSeguro(t.acertos), feitas),
  };
}

async function restaurarBackup(arquivo) {
  let obj;
  try {
    obj = JSON.parse(await arquivo.text());
  } catch (_) {
    alert('Não consegui ler este arquivo. Escolha o arquivo .json gerado pelo botão "Exportar backup".');
    return;
  }

  const bruto = obj && obj.dados ? obj.dados : obj;
  if (!bruto || !Array.isArray(bruto.tarefas)) {
    alert('Este arquivo não parece ser um backup do Calendário de Estudos.');
    return;
  }
  if (Number(bruto.versao) > VERSAO_DADOS) {
    alert('Este backup foi feito por uma versão mais nova do site. Atualize a página e tente de novo.');
    return;
  }

  const vistos = new Set();
  const tarefas = [];
  let descartadas = 0;
  for (const t of bruto.tarefas) {
    const s = sanitizarTarefa(t);
    if (!s) { descartadas++; continue; }
    if (vistos.has(s.id)) s.id = novoId();
    vistos.add(s.id);
    tarefas.push(s);
  }

  const quando = obj.exportadoEm ? ` (feito em ${formatar(new Date(obj.exportadoEm))})` : '';
  const extra = descartadas ? ` ${descartadas} item(ns) com problema serão ignorados.` : '';
  const ok = await confirmar(
    'Restaurar backup?',
    `As ${estado.dados.tarefas.length} tarefas atuais serão substituídas pelas ${tarefas.length} tarefas do backup${quando}.${extra}`,
    'Restaurar',
  );
  if (!ok) return;

  // Guarda uma cópia do que existia antes, por segurança.
  try {
    localStorage.setItem(`${CHAVE_DADOS}.antesDeRestaurar`, JSON.stringify(estado.dados));
  } catch (_) { /* ignora */ }

  estado.dados = migrar({ versao: Number(bruto.versao) || 1, tarefas });
  salvarDados();
  render();
  aviso(`Backup restaurado: ${tarefas.length} tarefas.`);
}

/* ---------------- Navegação ---------------- */

function mover(direcao) {
  const c = estado.cursor;
  if (estado.visao === 'dia') estado.cursor = somarDias(c, direcao);
  else if (estado.visao === 'semana') estado.cursor = somarDias(c, 7 * direcao);
  else estado.cursor = new Date(c.getFullYear(), c.getMonth() + direcao, 1);
  render();
}

function iniciar() {
  document.querySelectorAll('.btn-visao[data-visao]').forEach((b) => {
    b.addEventListener('click', () => {
      estado.visao = b.dataset.visao;
      salvarPrefs();
      render();
    });
  });
  document.querySelectorAll('.btn-visao[data-periodo]').forEach((b) => {
    b.addEventListener('click', () => {
      estado.periodoProgresso = b.dataset.periodo;
      salvarPrefs();
      renderProgresso();
    });
  });
  document.getElementById('btn-anterior').addEventListener('click', () => mover(-1));
  document.getElementById('btn-proximo').addEventListener('click', () => mover(1));
  document.getElementById('btn-hoje').addEventListener('click', () => {
    estado.cursor = hoje();
    render();
  });

  document.getElementById('btn-tema').addEventListener('click', () => {
    estado.tema = estado.tema === 'claro' ? 'escuro' : 'claro';
    salvarPrefs();
    aplicarTema();
  });

  // Calendário: cliques em tarefas e nos botões "+"
  const cal = document.getElementById('calendario');
  cal.addEventListener('click', (e) => {
    const add = e.target.closest('[data-adicionar]');
    if (add) return abrirFormulario(null, add.dataset.adicionar);
    const cartao = e.target.closest('.tarefa');
    if (!cartao) return;
    if (e.target.closest('.marcar')) alternarConcluida(cartao.dataset.id);
    else if (e.target.closest('.tarefa-corpo')) abrirFormulario(acharTarefa(cartao.dataset.id));
  });
  ativarArrastar(cal);
  cal.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tarefa-corpo')) {
      e.preventDefault();
      abrirFormulario(acharTarefa(e.target.closest('.tarefa').dataset.id));
    }
  });

  // Formulário
  const selArea = document.getElementById('f-area');
  Object.entries(AREAS).forEach(([cod, a]) => {
    const op = el('option', null, a.nome);
    op.value = cod;
    selArea.appendChild(op);
  });
  aplicarMascaraData(document.getElementById('f-data'));
  document.querySelectorAll('#form-tarefa input[name="tipo"]').forEach((r) => r.addEventListener('change', atualizarCamposQuestoes));
  document.getElementById('form-tarefa').addEventListener('submit', salvarFormulario);
  document.getElementById('btn-excluir').addEventListener('click', excluirTarefaAtual);
  document.getElementById('btn-nova').addEventListener('click', () => abrirFormulario(null));
  document.getElementById('form-questoes').addEventListener('submit', salvarQuestoes);
  document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

  // Cronograma
  document.getElementById('btn-carregar-cronograma').addEventListener('click', carregarCronograma);
  document.getElementById('btn-replanejar').addEventListener('click', abrirReplanejar);
  document.getElementById('r-sabado').addEventListener('change', resumoReplanejamento);
  document.getElementById('form-replanejar').addEventListener('submit', aplicarReplanejamento);

  // Backup
  document.getElementById('btn-exportar').addEventListener('click', exportarBackup);
  const entradaArquivo = document.getElementById('arquivo-backup');
  document.getElementById('btn-restaurar').addEventListener('click', () => entradaArquivo.click());
  entradaArquivo.addEventListener('change', async () => {
    const arq = entradaArquivo.files[0];
    entradaArquivo.value = '';
    if (arq) await restaurarBackup(arq);
  });

  aplicarTema();
  renderLegenda();
  render();
}

iniciar();

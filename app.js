/* JavaScript puro, sem framework e sem etapa de compilação.
   Fluxo: estado -> filtros -> renderização -> eventos.
   Os dados ficam em data.js; os estilos em style.css. */
'use strict';

const $ = (selector) => document.querySelector(selector);
const coursesById = new Map(DATA.courses.map(course => [course.id, course]));
const careersById = new Map(DATA.careers.map(career => [career.id, career]));
const areasById = new Map(DATA.areas.map(area => [area.id, area]));
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const escapeHTML = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// O armazenamento pode estar indisponível em alguns navegadores; o mapa continua funcionando.
function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* exploration still works */ }
}
const savedIds = readStorage('conexoes-si-favorites', []);
const state = {
  view: 'profissoes', plan: null, interests: new Set(), allSuggestions: false, area: 'programacao', query: '', period: '', type: '', course: null,
  career: null, favoritesOnly: false,
  favorites: new Set(Array.isArray(savedIds) ? savedIds.filter(id => careersById.has(id)) : []),
  comparison: new Set()
};
let dialogReturnFocus = null;
let dialogContent = null;
let visibleCourses = [];
let visibleCareers = [];

for (let i = 1; i <= 8; i++) $('#period').insertAdjacentHTML('beforeend', `<option value="${i}">${i}º período</option>`);
$('#period').insertAdjacentHTML('beforeend', '<option value="0">Sem período fixo</option>');
const preferredTheme = readStorage('conexoes-si-theme', 'light');
document.documentElement.dataset.theme = preferredTheme === 'dark' ? 'dark' : 'light';
updateThemeLabel();

function updateThemeLabel() {
  $('#theme').setAttribute('aria-label', `Alternar para tema ${document.documentElement.dataset.theme === 'dark' ? 'claro' : 'escuro'}`);
}
function typeName(type) { return {obrigatoria:'Obrigatória', optativa:'Optativa', componente:'Componente'}[type]; }
function courseMeta(course) {
  return `${course.period ? `${course.period}º período` : course.type === 'optativa' ? 'Oferta variável' : 'Ao longo do curso'} · ${course.hours} h`;
}
function courseButton(course, map = false) {
  return `<button class="node course ${course.type} ${state.course === course.id && map ? 'selected' : ''}" data-course="${course.id}" ${map ? `data-node="course-${course.id}"` : ''}><strong>${escapeHTML(course.name)}</strong><small>${courseMeta(course)} <span class="badge ${course.type === 'optativa' ? 'opt' : ''}">${typeName(course.type)}</span></small></button>`;
}
function careerButton(career, map = false) {
  return `<button class="node career ${state.career === career.id && map ? 'selected' : ''}" data-career="${career.id}" ${map ? `data-node="career-${career.id}"` : ''}><strong>${escapeHTML(career.name)}</strong></button>`;
}
function careerCourseIds(career) { return [...new Set([...career.core, ...career.support, ...DATA.transversal])]; }
function matchesCourse(course) {
  if (state.period !== '' && String(course.period) !== state.period) return false;
  if (state.type && course.type !== state.type) return false;
  if (state.career && !careerCourseIds(careersById.get(state.career)).includes(course.id)) return false;
  if (state.favoritesOnly && !course.careers.some(id => state.favorites.has(id))) return false;
  if (!state.query) return true;
  const connected = course.careers.map(id => careersById.get(id).name).join(' ');
  return normalize(`${course.name} ${course.summary} ${course.id} ${areasById.get(course.area).name} ${connected}`).includes(normalize(state.query));
}
function sortedCourses(courses) {
  return [...courses].sort((a,b) => (a.period || 9) - (b.period || 9) || a.name.localeCompare(b.name, 'pt-BR'));
}
function relation(career, course) {
  if (career.core.includes(course.id)) return 'Conexão central';
  if (career.support.includes(course.id)) return 'Conexão de apoio';
  if (DATA.transversal.includes(course.id)) return 'Formação transversal';
  return '';
}

function render() {
  document.querySelectorAll('.tabs [data-view]').forEach(button => {
    const selected = button.dataset.view === state.view;
    button.setAttribute('aria-selected', selected);
    button.tabIndex = selected ? 0 : -1;
  });
  $('#view').setAttribute('aria-labelledby', `tab-${state.view}`);
  $('#filters').hidden = state.view === 'fontes' || (state.view === 'profissoes' && Boolean(state.plan));
  $('.map-caption').hidden = state.view !== 'mapa';
  $('#saved-count').textContent = state.favorites.size;
  $('#saved').hidden = state.view === 'interesses';
  $('#saved').setAttribute('aria-pressed', state.favoritesOnly);
  const renderers = {profissoes:renderProfessions, interesses:renderInterests, mapa:renderMap, matriz:renderCurriculum, carreiras:renderCareers, fontes:renderSources};
  renderers[state.view]();
  updateComparison();
}

function renderMap() {
  // Escolher uma área reduz as conexões visíveis, mantendo o mapa legível.
  const filtered = DATA.courses.filter(matchesCourse);
  visibleCourses = sortedCourses(filtered.filter(course => !state.area || course.area === state.area));
  if (state.course) visibleCourses = visibleCourses.filter(course => course.id === state.course);
  const linkedCareerIds = new Set(visibleCourses.flatMap(course => course.careers));
  visibleCareers = DATA.careers.filter(career => linkedCareerIds.has(career.id) && (!state.career || career.id === state.career) && (!state.favoritesOnly || state.favorites.has(career.id)));
  const selectedArea = areasById.get(state.area);
  $('#context').innerHTML = `${selectedArea ? `<strong>${escapeHTML(selectedArea.name)}</strong> · ` : 'Todas as áreas · '}${visibleCourses.length} disciplinas/componentes e ${visibleCareers.length} carreiras relacionadas. <button data-all-areas>Ver todas as áreas</button>${state.course || state.career ? '<button data-unfocus>Remover seleção</button>' : ''}`;
  const areaNodes = DATA.areas.map(area => {
    const count = DATA.courses.filter(course => course.area === area.id).length;
    return `<button class="node area ${state.area === area.id ? 'selected' : ''}" data-area="${area.id}" data-node="area-${area.id}" style="--area-color:${area.color}" aria-pressed="${state.area === area.id}"><span class="area-num">${area.number}</span><strong>${escapeHTML(area.name)}</strong><small>${count} ${count === 1 ? 'disciplina' : 'disciplinas/componentes'}</small></button>`;
  }).join('');
  $('#view').innerHTML = `<div class="map"><svg class="map-lines" aria-hidden="true"></svg><div class="map-grid"><div class="area-column"><div class="column-title">01 · ÁREAS <b>12</b></div>${areaNodes}</div><div><div class="column-title">02 · O QUE VOCÊ APRENDE <b>${visibleCourses.length}</b></div>${visibleCourses.map(course => courseButton(course,true)).join('') || '<p class="empty">Nenhuma disciplina neste recorte. Limpe os filtros ou escolha outra área.</p>'}<p class="column-note">Os agrupamentos temáticos são uma organização do mapa. Uma disciplina pode contribuir para várias carreiras.</p></div><div><div class="column-title">03 · ONDE VOCÊ PODE ATUAR <b>${visibleCareers.length}</b></div>${visibleCareers.map(career => careerButton(career,true)).join('') || '<p class="empty">Nenhuma carreira neste recorte.</p>'}<p class="column-note">Clique para ver contribuições, optativas e uma ideia de projeto.</p></div></div></div>`;
  requestAnimationFrame(drawConnections);
}
function drawConnections() {
  const map = $('.map');
  if (!map || innerWidth <= 680) return;
  const svg = $('.map-lines');
  const bounds = map.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  const point = (id, side) => {
    const node = map.querySelector(`[data-node="${id}"]`);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return {x:(side === 'right' ? rect.right : rect.left) - bounds.left, y:rect.top + rect.height/2 - bounds.top};
  };
  const paths=[];
  function connect(from,to,active=false) {
    const a=point(from,'right'), b=point(to,'left');
    if (!a || !b) return;
    const middle=(a.x+b.x)/2;
    paths.push(`<path class="${active ? 'active' : ''}" d="M${a.x},${a.y} C${middle},${a.y} ${middle},${b.y} ${b.x},${b.y}"/>`);
  }
  visibleCourses.forEach(course => {
    connect(`area-${course.area}`, `course-${course.id}`, Boolean(state.course));
    visibleCareers.forEach(career => {
      if (relation(career, course)) connect(`course-${course.id}`, `career-${career.id}`, Boolean(state.course || state.career));
    });
  });
  svg.innerHTML=paths.join('');
}

function renderCurriculum() {
  const filtered = DATA.courses.filter(matchesCourse);
  $('#context').textContent = `${filtered.length} disciplinas/componentes encontrados. Períodos de referência: PPC e matriz. As optativas não têm semestre fixo.`;
  const semesters = Array.from({length:8},(_,i) => {
    const courses=filtered.filter(course => course.period === i+1);
    return `<section class="semester"><h3>${i+1}º período</h3><p class="semester-meta">${courses.length} matérias encontradas</p>${courses.map(course => courseButton(course)).join('') || '<p class="column-note">Nenhuma matéria com esses filtros.</p>'}${i >= 4 ? '<p class="column-note">Optativa: 64 h.</p>' : ''}</section>`;
  }).join('');
  const optatives=filtered.filter(course => course.type === 'optativa');
  const components=filtered.filter(course => course.type === 'componente');
  $('#view').innerHTML=`<div class="semester-grid">${semesters}<section class="semester wide"><h3>Matérias optativas</h3><p class="semester-meta">O curso inclui 256 h de optativas. Você escolhe entre as matérias oferecidas.</p><div class="opt-grid">${optatives.map(course => courseButton(course)).join('') || '<p class="empty">Nenhuma optativa com esses filtros.</p>'}</div></section><section class="semester wide"><h3>Outras atividades do curso</h3><div class="opt-grid">${components.map(course => courseButton(course)).join('')}</div><p class="column-note">Projeto Integrador: 320 h, do 2º ao 6º período. Atividades Complementares: 220 h. Estágio não obrigatório (PPC, p. 109).</p></section></div>`;
}

function filteredCareers() {
  const query=normalize(state.query);
  return DATA.careers.filter(career => {
    if (state.favoritesOnly && !state.favorites.has(career.id)) return false;
    const related=careerCourseIds(career).map(id => coursesById.get(id));
    if ((state.period !== '' || state.type) && !related.some(course => (state.period === '' || String(course.period) === state.period) && (!state.type || course.type === state.type))) return false;
    return !query || normalize(`${career.name} ${career.description} ${related.map(course => `${course.name} ${areasById.get(course.area).name}`).join(' ')}`).includes(query);
  });
}
function renderCareers() {
  const careers=filteredCareers();
  $('#context').textContent=`${careers.length} possibilidades de carreira · Marque até 3 para comparar. Favoritas ficam salvas neste navegador.`;
  $('#view').innerHTML=careers.length ? `<div class="cards">${careers.map(career => `<article class="career-card"><h3>${escapeHTML(career.name)}</h3><p>${escapeHTML(career.description)}</p><p class="column-note">${career.core.length + career.support.length} matérias relacionadas</p><div class="card-actions"><button class="subtle" data-career="${career.id}">Explorar formação ↗</button><button class="star" data-favorite="${career.id}" aria-label="${state.favorites.has(career.id) ? 'Remover' : 'Adicionar'} ${escapeHTML(career.name)} ${state.favorites.has(career.id) ? 'das' : 'às'} favoritas" aria-pressed="${state.favorites.has(career.id)}">${state.favorites.has(career.id) ? '★' : '☆'}</button></div><label class="check-label"><input type="checkbox" data-compare="${career.id}" ${state.comparison.has(career.id) ? 'checked' : ''}> Comparar esta carreira</label></article>`).join('')}</div>` : '<p class="empty">Nenhuma carreira encontrada. Tente outra busca ou limpe os filtros.</p>';
}

function renderSources() {
  $('#context').textContent='Documentos usados para montar o site.';
  $('#view').innerHTML=`<div class="source-grid"><article class="source-card"><h3>PPC do curso</h3><p>Apresenta a formação, a grade e as áreas de trabalho. A versão fornecida é a de 2020.</p><a href="${DATA.sources.ppc}" target="_blank" rel="noopener">Abrir PPC · 155 páginas ↗</a></article><article class="source-card"><h3>Ementário</h3><p>Mostra o conteúdo, os objetivos e a carga horária de cada matéria.</p><a href="${DATA.sources.ementario}" target="_blank" rel="noopener">Abrir ementário · 60 páginas ↗</a></article><article class="source-card"><h3>Matriz e organograma</h3><p>Mostra as matérias por semestre. A tabela está identificada como versão 2022.1.</p><a href="${DATA.sources.matriz}" target="_blank" rel="noopener">Abrir matriz · 5 páginas ↗</a></article></div><article class="prose"><h3>De onde vêm as informações?</h3><p>Os nomes, códigos, períodos e cargas horárias vêm desses documentos. As descrições resumem o que cada matéria ensina.</p><p>O PPC cita profissões como programador, analista de sistemas, administrador de banco de dados e gerente de projetos (p. 23). O site também inclui outras áreas relacionadas ao conteúdo das aulas, como desenvolvimento Full-Stack, jogos e robótica. A relação entre cada profissão e suas matérias foi organizada para este site; não é uma lista oficial de requisitos profissionais.</p><p>As sugestões usam as matérias que você selecionou: uma ligação direta vale 3 pontos e uma matéria de apoio vale 1. Ética, comunicação, pesquisa e atividades práticas ajudam em todas as profissões e não entram na pontuação.</p><p>O site usa os documentos fornecidos. Para saber qual grade vale para a sua turma, consulte a coordenação do curso.</p><details><summary>Diferenças entre os documentos</summary><ul><li><strong>Ética e Legislação:</strong> obrigatória no 1º período. Consta no ementário (p. 4) e na matriz (p. 1), mas não aparece na tabela principal do PPC (p. 32).</li><li><strong>Sistemas de Garantia de Qualidade:</strong> 64 h no PPC (p. 89) e no ementário (pp. 51–52). A matriz (p. 4) registra 32 h e o nome Sistemas de Gestão da Qualidade. Aqui consta 64 h, conforme o PPC.</li><li><strong>Banco de Dados II:</strong> o campo da ementa está vazio. A descrição usa os objetivos da matéria (ementário p. 34; PPC p. 71).</li><li><strong>Nomes:</strong> Cálculo Diferencial e Integral I segue o nome da matriz. No código .066, a expressão “Sistemas de Computacionais” foi ajustada para “Sistemas Computacionais”.</li><li><strong>Carga horária:</strong> o PPC registra 3.004 h. No 7º período, o organograma escreve 284 h, mas a tabela e a soma das matérias indicam 288 h.</li><li><strong>Ordem de estudo:</strong> segue os períodos da grade. As relações com profissões não são pré-requisitos de matrícula. A matriz e o regulamento do TCC têm informações diferentes sobre seus pré-requisitos.</li></ul></details><p>Projeto estudantil, sem vínculo oficial com o IFMG.</p><a class="source-link" href="./dados.json" download>Baixar dados do site (JSON) ↓</a></article>`;
}

function openDialog(html, descriptor) {
  if (!$('#detail').open) dialogReturnFocus=document.activeElement;
  dialogContent=descriptor;
  $('#detail-body').innerHTML=html;
  if (!$('#detail').open) $('#detail').showModal();
  $('#detail').scrollTop=0;
  $('#close-detail').focus();
}
function sourceLinks(course) {
  const pageLink=course.page ? `<a class="source-link" href="${DATA.sources.ementario}#page=${course.page}" target="_blank" rel="noopener">Ementário · página ${course.page} ↗</a>` : `<a class="source-link" href="${DATA.sources.ppc}#page=${course.ppcPage}" target="_blank" rel="noopener">PPC · página ${course.ppcPage} ↗</a>`;
  return `${pageLink} <span aria-hidden="true"> · </span><a class="source-link" href="${DATA.sources.ppc}" target="_blank" rel="noopener">Consultar PPC ↗</a>`;
}
function showCourse(id) {
  const course=coursesById.get(id);
  if (!course) return;
  const technical=DATA.careers.filter(career => career.core.includes(id) || career.support.includes(id));
  const transversal=DATA.transversal.includes(id);
  const list=transversal ? DATA.careers : technical;
  openDialog(`<span class="badge">${typeName(course.type)}</span><span class="badge">${courseMeta(course)}</span><h2 id="detail-title">${escapeHTML(course.name)}</h2><p>${course.id.length === 3 ? `Código oficial: OBBGSIN.${course.id} · ` : ''}Área temática: ${escapeHTML(areasById.get(course.area).name)}</p><h3>O que você aprende</h3><p>${escapeHTML(course.summary)}</p><p>${sourceLinks(course)}</p><div class="dialog-actions"><button class="primary" data-focus-course="${id}">Ver matérias por semestre ↗</button></div><div class="detail-group"><h3>${transversal ? 'Útil em todas as profissões' : `${list.length} carreiras relacionadas`}</h3>${transversal ? '<p>Esta matéria ajuda em qualquer uma das profissões abaixo.</p>' : '<p>Estas profissões usam conhecimentos ensinados nesta matéria.</p>'}<div class="detail-courses">${list.map(career => `${careerButton(career)}<span class="sr-only">${relation(career,course)}</span>`).join('')}</div></div>`,{type:'course',id});
}
function showCareer(id) {
  const career=careersById.get(id);
  if (!career) return;
  const section=(title,ids) => `<div class="detail-group"><h3>${title}</h3><div class="detail-courses">${sortedCourses(ids.map(code => coursesById.get(code))).map(course => courseButton(course)).join('')}</div></div>`;
  const transversal=DATA.transversal.filter(code => !career.core.includes(code) && !career.support.includes(code));
  openDialog(`<h2 id="detail-title">${escapeHTML(career.name)}</h2><p>${escapeHTML(career.description)}</p><p class="notice">Veja as matérias relacionadas a esta profissão. As optativas dependem da oferta do curso.</p><div class="dialog-actions"><button class="primary" data-focus-career="${id}">Ver matérias na ordem dos semestres ↗</button><button class="star" data-favorite="${id}" aria-pressed="${state.favorites.has(id)}" aria-label="${state.favorites.has(id) ? 'Remover das' : 'Adicionar às'} favoritas">${state.favorites.has(id) ? '★' : '☆'}</button><button class="subtle" data-add-compare="${id}">${state.comparison.has(id) ? 'Remover da comparação' : 'Adicionar à comparação'}</button></div>${section('Matérias diretamente relacionadas',career.core)}${section('Matérias que ajudam como base',career.support)}${section('Matérias úteis em todas as profissões',transversal)}<div class="detail-group"><h3>Experimente em um projeto</h3><p>${escapeHTML(career.project)}</p><h3>Para aprofundar depois</h3><p>${escapeHTML(career.extra)}</p><p><a class="source-link" href="${DATA.sources.ppc}#page=${career.official ? 23 : 19}" target="_blank" rel="noopener">PPC · perfil do egresso ↗</a> · Abra uma disciplina para consultar a fonte específica de sua contribuição.</p></div>`,{type:'career',id});
}
function updateComparison() {
  $('#compare-bar').hidden=state.comparison.size === 0;
  $('#compare-label').textContent=`${state.comparison.size} de 3 carreiras selecionadas`;
  $('#compare-open').disabled=state.comparison.size < 2;
}
function toggleCompare(id) {
  if (state.comparison.has(id)) state.comparison.delete(id);
  else if (state.comparison.size < 3) state.comparison.add(id);
  else { $('#announcement').textContent='Você pode comparar até 3 carreiras. Remova uma seleção para adicionar outra.'; $('#compare-label').textContent='Limite de 3: remova uma para trocar'; return false; }
  updateComparison(); return true;
}
function showComparison() {
  const careers=[...state.comparison].map(id => careersById.get(id));
  if (careers.length < 2) return;
  const shared=careerCourseIds(careers[0]).filter(id => careers.every(career => careerCourseIds(career).includes(id)) && !DATA.transversal.includes(id));
  openDialog(`<h2 id="detail-title">Compare suas possibilidades</h2><p>Compare o trabalho de cada profissão e as matérias relacionadas a ela.</p><div class="comparison">${careers.map(career => `<div><h3>${escapeHTML(career.name)}</h3><p>${escapeHTML(career.description)}</p><h4>Disciplinas centrais</h4><ul>${career.core.map(id => `<li>${escapeHTML(coursesById.get(id).name)}${coursesById.get(id).type === 'optativa' ? ' (optativa)' : ''}</li>`).join('')}</ul><h4>Ideia de projeto</h4><p>${escapeHTML(career.project)}</p><h4>Aprofundamento</h4><p>${escapeHTML(career.extra)}</p></div>`).join('')}</div><div class="common"><h3>Matérias em comum</h3><p>${shared.map(id => escapeHTML(coursesById.get(id).name)).join(' · ') || 'Estas profissões não têm matérias técnicas em comum na lista.'}</p><p>Ética, comunicação, pesquisa, TCC, Projeto Integrador e Atividades Complementares acompanham todas as carreiras.</p></div><button class="subtle" data-print>Imprimir ou salvar como PDF</button>`,{type:'comparison'});
}
function closeDialog() { $('#detail').close(); }
$('#detail').addEventListener('close', () => {
  if (dialogReturnFocus?.isConnected) dialogReturnFocus.focus();
  else $(`#tab-${state.view}`).focus();
});
$('#close-detail').addEventListener('click', closeDialog);
$('#detail').addEventListener('click', event => { if (event.target === $('#detail')) { const r=$('#detail').getBoundingClientRect(); if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) closeDialog(); } });

function setView(view, scroll = false) {
  if (view === 'carreiras') view='profissoes';
  state.view=view;
  render();
  if (scroll) $('#explorar').scrollIntoView({behavior:'smooth'});
}
function resetFilters() {
  Object.assign(state,{area:'programacao',query:'',period:'',type:'',course:null,career:null,favoritesOnly:false});
  $('#search').value=''; $('#period').value=''; $('#type').value='';
  render();
}
// Delegação de eventos: um único listener atende os botões gerados pela renderização.
document.addEventListener('click', event => {
  const button=event.target.closest('button');
  if (!button) return;
  if (button.dataset.view) setView(button.dataset.view,true);
  if (button.dataset.area) { state.area=button.dataset.area; state.course=null; state.career=null; render(); }
  if ('allAreas' in button.dataset) { state.area=null; state.course=null; render(); }
  if ('unfocus' in button.dataset) { state.course=null; state.career=null; render(); }
  if (button.dataset.course) showCourse(button.dataset.course);
  if (button.dataset.career) showCareer(button.dataset.career);
  if (button.dataset.favorite) {
    const id=button.dataset.favorite;
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    saveStorage('conexoes-si-favorites',[...state.favorites]); render();
    if ($('#detail').open && dialogContent?.type === 'career') showCareer(dialogContent.id);
  }
  if (button.dataset.addCompare) {
    toggleCompare(button.dataset.addCompare); render();
    if (dialogContent?.type === 'career') showCareer(dialogContent.id);
  }
  if (button.dataset.focusCourse) {
    const course=coursesById.get(button.dataset.focusCourse);
    resetFilters(); state.view='matriz'; render(); closeDialog(); $('#explorar').scrollIntoView();
  }
  if (button.dataset.focusCareer) {
    resetFilters(); state.view='profissoes'; state.plan=button.dataset.focusCareer; render(); closeDialog(); $('#explorar').scrollIntoView();
  }
  if ('print' in button.dataset) window.print();
});
document.addEventListener('change', event => {
  if (event.target.dataset.compare) {
    const accepted=toggleCompare(event.target.dataset.compare);
    if (!accepted) event.target.checked=false;
  }
});
$('#search').addEventListener('input', event => {
  state.query=event.target.value; state.course=null; state.career=null;
  // A busca abre todas as áreas para a seleção inicial não esconder resultados.
  if (state.query) state.area=null;
  render();
});
$('#period').addEventListener('change', event => { state.period=event.target.value; state.course=null; render(); });
$('#type').addEventListener('change', event => { state.type=event.target.value; state.course=null; render(); });
$('#reset').addEventListener('click', resetFilters);
$('#saved').addEventListener('click', () => { state.favoritesOnly=!state.favoritesOnly; state.plan=null; state.view='profissoes'; render(); });
$('#theme').addEventListener('click', () => {
  const next=document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme=next; saveStorage('conexoes-si-theme',next); updateThemeLabel();
});
$('#compare-open').addEventListener('click',showComparison);
$('#compare-clear').addEventListener('click', () => { state.comparison.clear(); render(); });
$('.tabs').addEventListener('keydown', event => {
  const tabs=[...document.querySelectorAll('.tabs [role=tab]')];
  const index=tabs.indexOf(event.target);
  if (index < 0) return;
  const direction=event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  let next;
  if (direction) next=(index+direction+tabs.length)%tabs.length;
  else if (event.key === 'Home') next=0;
  else if (event.key === 'End') next=tabs.length-1;
  else return;
  event.preventDefault(); setView(tabs[next].dataset.view); tabs[next].focus();
});
new ResizeObserver(() => requestAnimationFrame(drawConnections)).observe($('#view'));
render();


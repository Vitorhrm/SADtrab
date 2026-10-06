/* Duas entradas para a mesma formação:
   profissão -> disciplinas por período; interesses -> sugestões explicadas.
   Os dados e as funções comuns vêm de data.js e app.js. */

function renderProfessions() {
  if (state.plan) { renderCareerPlan(careersById.get(state.plan)); return; }
  renderCareers();
  $('#context').textContent='Escolha uma profissão para ver as matérias relacionadas, organizadas pelos períodos do curso.';
  document.querySelectorAll('.career-card [data-career]').forEach(button => {
    button.dataset.plan=button.dataset.career;
    delete button.dataset.career;
    button.textContent='Ver matérias e ordem de estudo ↗';
  });
}

function planCourse(course, career) {
  const connection={'Conexão central':'Ligação direta com a profissão','Conexão de apoio':'Ajuda a aprofundar','Formação transversal':'Base para todas as profissões'}[relation(career,course)];
  return `<div class="plan-subject"><button class="node course ${course.type}" data-course="${course.id}"><strong>${escapeHTML(course.name)}</strong><small>${course.hours} h · ${typeName(course.type)} · ${connection}</small></button><p>${escapeHTML(course.summary)}</p></div>`;
}

function renderCareerPlan(career) {
  const related=careerCourseIds(career).map(id=>coursesById.get(id));
  const required=related.filter(course=>course.type==='obrigatoria');
  const optional=related.filter(course=>course.type==='optativa');
  $('#context').textContent='Profissão → matérias do curso · Organizadas na ordem dos semestres.';
  const timeline=Array.from({length:8},(_,i)=>{
    const courses=sortedCourses(required.filter(course=>course.period===i+1));
    if (!courses.length) return '';
    return `<section class="timeline-step"><div class="step-number">${i+1}</div><div class="step-content"><h3>${i+1}º período <span>${i<2 ? 'Construir a base' : i<5 ? 'Desenvolver competências' : 'Integrar e aprofundar'}</span></h3><div class="plan-grid">${courses.map(course=>planCourse(course,career)).join('')}</div></div></section>`;
  }).join('');
  $('#view').innerHTML=`<button class="subtle back-map" data-back-professions>← Escolher outra profissão</button><article class="plan-heading"><p class="eyebrow">CONHEÇA A PROFISSÃO</p><h2>${escapeHTML(career.name)}</h2><p>${escapeHTML(career.description)}</p><label class="select-label">Trocar de profissão<select id="career-switch">${DATA.careers.map(c=>`<option value="${c.id}" ${c.id===career.id?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select></label></article><p class="notice"><strong>Ordem de estudo:</strong> As matérias estão na ordem dos semestres. Esta lista destaca as relacionadas à profissão; as demais obrigatórias também fazem parte do curso.</p><div class="timeline">${timeline}</div><section class="prose"><h3>Outras matérias que você pode escolher</h3><p>Estas matérias são optativas. Você pode escolhê-las conforme a oferta do curso, do 5º ao 8º semestre.</p><div class="plan-grid">${optional.map(course=>planCourse(course,career)).join('') || '<p>Não há optativas indicadas para esta profissão.</p>'}</div></section><button class="subtle discovery-bottom" data-view="interesses">Quero explorar outras profissões pelas matérias ↗</button>`;
}

function rankInterests() {
  // Regras transparentes: central = 3 pontos, apoio = 1, transversal = 0.
  // É afinidade curricular com a seleção, não chance de emprego ou teste vocacional.
  return DATA.careers.map(career=>{
    const central=[...state.interests].filter(id=>career.core.includes(id) && !DATA.transversal.includes(id));
    const support=[...state.interests].filter(id=>career.support.includes(id) && !DATA.transversal.includes(id));
    return {career,central,support,score:central.length*3+support.length};
  }).filter(result=>result.score>0).sort((a,b)=>b.score-a.score || b.central.length-a.central.length || a.career.name.localeCompare(b.career.name,'pt-BR'));
}

function renderInterests() {
  const query=normalize(state.query);
  const subjects=DATA.courses.filter(course=>
    (state.period==='' || String(course.period)===state.period) &&
    (!state.type || state.type===course.type) &&
    (!query || normalize(`${course.name} ${course.summary} ${areasById.get(course.area).name}`).includes(query))
  );
  const selected=[...state.interests].map(id=>coursesById.get(id));
  const ranked=rankInterests();
  const shown=state.allSuggestions ? ranked : ranked.slice(0,6);
  $('#context').textContent=`${selected.length} matérias selecionadas · Você pode combinar matérias de diferentes áreas. `;
  const groups=DATA.areas.map(area=>{
    const courses=sortedCourses(subjects.filter(course=>course.area===area.id));
    if (!courses.length) return '';
    const count=courses.filter(course=>state.interests.has(course.id)).length;
    return `<details class="interest-group" data-group="${area.id}" ${query || area.id==='programacao' || count ? 'open':''}><summary><span>${escapeHTML(area.name)}</span><small>${count ? `${count} selecionadas · `:''}${courses.length} matérias</small></summary><div class="interest-options">${courses.map(course=>`<label class="interest-option ${state.interests.has(course.id)?'chosen':''}"><input type="checkbox" data-interest="${course.id}" ${state.interests.has(course.id)?'checked':''}><span><strong>${escapeHTML(course.name)}</strong><small>${courseMeta(course)} · ${typeName(course.type)}</small><span class="interest-description">${escapeHTML(course.summary)}</span></span></label>`).join('')}</div></details>`;
  }).join('');
  const suggestions=shown.map(result=>`<article class="suggestion"><div class="suggestion-heading"><h3>${escapeHTML(result.career.name)}</h3><span class="badge">${result.score} pontos de conexão</span></div><p>${escapeHTML(result.career.description)}</p><p class="match-explanation"><strong>Por que apareceu?</strong> ${[...result.central.map(id=>`${escapeHTML(coursesById.get(id).name)} <span class="badge">ligação direta · 3</span>`),...result.support.map(id=>`${escapeHTML(coursesById.get(id).name)} <span class="badge opt">ajuda como base · 1</span>`)].join(' · ')}</p><button class="subtle" data-plan="${result.career.id}">Ver matérias e ordem de estudo ↗</button></article>`).join('');
  $('#view').innerHTML=`<div class="discovery-intro"><h3>O que você gostaria de aprender?</h3><p>Marque quantas matérias quiser. Veja as profissões relacionadas às suas escolhas.</p></div><div class="selected-interests"><div>${selected.map(course=>`<button class="selection-chip" data-remove-interest="${course.id}" aria-label="Remover ${escapeHTML(course.name)}">${escapeHTML(course.name)} <span aria-hidden="true">×</span></button>`).join('') || '<span class="column-note">Nenhuma matéria selecionada ainda.</span>'}</div>${selected.length?'<button class="subtle" data-clear-interests>Limpar seleção</button>':''}</div>${selected.length ? '<button class="primary suggestion-jump" data-jump-suggestions>Ver profissões sugeridas ↓</button>' : ''}<div class="discovery-layout"><section class="subject-picker" aria-label="Selecionar matérias">${groups || '<p class="empty">Nenhuma matéria encontrada. Tente outra busca ou limpe os filtros.</p>'}</section><section class="recommendations" aria-labelledby="recommend-title"><h3 id="recommend-title">Profissões para explorar <span class="badge">${ranked.length}</span></h3><p class="ranking-note">Ligação direta: 3 pontos. Matéria de apoio: 1 ponto. A pontuação usa as matérias que você marcou. Ética, comunicação e prática são comuns a todas as profissões e não somam pontos.</p>${!selected.length?'<div class="empty"><h3>Suas sugestões aparecem aqui</h3><p>Por exemplo, combine Programação Web, Banco de Dados I e Interface Humano Computador para descobrir profissões ligadas a essas matérias.</p></div>':!ranked.length?'<div class="empty"><h3>Uma base para qualquer profissão</h3><p>Essas matérias são importantes em qualquer profissão do curso. Marque também uma matéria de programação, dados, redes, gestão ou outra área para receber sugestões mais específicas.</p><button class="subtle" data-view="profissoes">Explorar todas as profissões</button></div>':suggestions}${ranked.length>6?`<button class="subtle" data-more-suggestions>${state.allSuggestions?'Mostrar as 6 primeiras':`Ver todas as ${ranked.length} sugestões`}</button>`:''}<p class="column-note">Para ver todas as profissões, volte à primeira aba.</p></section></div>`;
}

// Estes listeners só executam depois que app.js inicializou o estado.
document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if (!button) return;
  if (button.dataset.plan) {
    state.plan=button.dataset.plan;
    setView('profissoes',true);
    $('#view h2').setAttribute('tabindex','-1'); $('#view h2').focus({preventScroll:true});
  }
  if ('jumpSuggestions' in button.dataset) $('.recommendations').scrollIntoView({behavior:'smooth'});
  if ('backProfessions' in button.dataset) { state.plan=null; setView('profissoes'); }
  if (button.dataset.removeInterest) { state.interests.delete(button.dataset.removeInterest); render(); }
  if ('clearInterests' in button.dataset) { state.interests.clear(); render(); }
  if ('moreSuggestions' in button.dataset) { state.allSuggestions=!state.allSuggestions; render(); }
});
document.addEventListener('change',event=>{
  if (event.target.id==='career-switch') { state.plan=event.target.value; render(); }
  if (event.target.dataset.interest) {
    const id=event.target.dataset.interest;
    const opened=[...document.querySelectorAll('.interest-group[open]')].map(group=>group.dataset.group);
    event.target.checked ? state.interests.add(id) : state.interests.delete(id);
    render();
    opened.forEach(id=>{ const group=document.querySelector(`[data-group="${id}"]`); if(group) group.open=true; });
    document.querySelector(`[data-interest="${id}"]`)?.focus({preventScroll:true});
    $('#announcement').textContent=`${state.interests.size} matérias selecionadas. ${rankInterests().length} profissões relacionadas.`;
  }
});

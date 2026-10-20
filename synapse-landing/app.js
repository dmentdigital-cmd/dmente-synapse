'use strict';

// Static, illustrative content only. No API calls, tracking, storage or real approvals.
document.body.classList.add('js-ready');
const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#site-nav');
menuToggle.hidden = false;
function closeMenu() {
  menuToggle.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuToggle.focus();
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.site-header')) closeMenu();
});
window.matchMedia('(max-width: 540px)').addEventListener('change', closeMenu);

const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = false) {
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (focus) tab.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', (event) => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      selectTab(tabs[nextIndex], true);
    }
  });
});

const projectExamples = {
  brand: {
    title: 'Revisar propuesta visual',
    description: 'El agente de diseño preparó un resumen. El equipo revisa la propuesta antes de compartirla.',
    owner: 'Equipo de diseño',
    milestone: 'Propuesta visual · 3 de 4',
    blocker: 'Sin bloqueo registrado',
  },
  website: {
    title: 'Aprobar estructura del sitio',
    description: 'La estructura propuesta está lista. La persona responsable debe revisarla antes de iniciar la siguiente fase.',
    owner: 'Equipo de desarrollo',
    milestone: 'Estructura del sitio · 2 de 4',
    blocker: 'Aprobación de estructura pendiente',
  },
  campaign: {
    title: 'Consolidar insumos de campaña',
    description: 'Faltan textos y piezas de referencia. El equipo debe aclarar responsables y coordinar la entrega de los insumos.',
    owner: 'Equipo de marketing',
    milestone: 'Recopilación de insumos · 1 de 4',
    blocker: 'Material de campaña pendiente',
  },
};
const liveStatus = document.getElementById('demo-live-status');
const projectButtons = [...document.querySelectorAll('[data-project]')];
projectButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const project = projectExamples[button.dataset.project];
    if (!project) return;
    projectButtons.forEach((item) => {
      item.classList.toggle('selected', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    for (const [key, value] of Object.entries(project)) {
      document.getElementById(`detail-${key}`).textContent = value;
    }
    liveStatus.textContent = `Proyecto de ejemplo seleccionado. Próxima acción: ${project.title}. Responsable: ${project.owner}. Bloqueo: ${project.blocker}.`;
  });
});

const approvalButton = document.getElementById('simulate-approval');
let approvalSimulated = false;
approvalButton.addEventListener('click', () => {
  const requestStatus = document.getElementById('request-status');
  if (!approvalSimulated) {
    const entry = document.createElement('li');
    entry.id = 'simulated-entry';
    const time = document.createElement('time');
    time.textContent = 'Ahora · Simulación';
    const title = document.createElement('strong');
    title.textContent = 'Aprobación de ejemplo registrada';
    const description = document.createElement('p');
    description.textContent = 'Persona responsable · No se envió ningún mensaje.';
    entry.append(time, title, description);
    document.getElementById('approval-log').append(entry);
    requestStatus.textContent = 'Aprobación simulada';
    requestStatus.classList.replace('amber-text', 'teal-text');
    approvalButton.textContent = 'Reiniciar simulación';
    liveStatus.textContent = 'Aprobación simulada en esta demostración. No se ha enviado ningún mensaje ni se ha modificado su operación.';
  } else {
    document.getElementById('simulated-entry')?.remove();
    requestStatus.textContent = 'Pendiente de aprobación';
    requestStatus.classList.replace('teal-text', 'amber-text');
    approvalButton.textContent = 'Simular aprobación';
    liveStatus.textContent = 'Simulación reiniciada. La solicitud de ejemplo está pendiente de aprobación.';
  }
  approvalSimulated = !approvalSimulated;
});

// An anchor can point to a FAQ answer without requiring a second click.
function revealLinkedAnswer() {
  if (window.location.hash === '#faq-control') {
    document.getElementById('faq-control').open = true;
  }
}
window.addEventListener('hashchange', revealLinkedAnswer);
revealLinkedAnswer();

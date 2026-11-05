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
window.matchMedia('(max-width: 680px)').addEventListener('change', closeMenu);


const motionPreference = window.matchMedia('(prefers-reduced-motion: no-preference)');

function animateChange(element) {
  if (!motionPreference.matches) return;
  element.getAnimations().forEach((animation) => animation.cancel());
  element.animate(
    [{ opacity: 0.45, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 260, easing: 'cubic-bezier(.2, 0, 0, 1)' },
  );
}

const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(tab, focus = false) {
  const changed = tab.getAttribute('aria-selected') !== 'true';
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  }
  if (changed) animateChange(document.getElementById(tab.getAttribute('aria-controls')));
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


document.querySelectorAll('[data-open-tab]').forEach((link) => {
  link.addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const tab = document.getElementById(link.dataset.openTab);
    selectTab(tab);
    requestAnimationFrame(() => tab.focus({ preventScroll: true }));
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
    animateChange(document.querySelector('.project-detail'));
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

// The three strands share a single curve. Scroll and pointer movement change
// the camera, and the warm pulse travels through the same geometry.
function mountSculpture() {
  const canvas = document.querySelector('.kinetic-canvas');
  const context = canvas?.getContext('2d');
  if (!context) return;

  const toggle = document.querySelector('.motion-toggle');
  const figure = canvas.parentElement;
  const samples = 148;
  const filaments = 11;
  const depthBands = 6;
  const materials = [
    [[114, 51, 27], [255, 123, 62]],
    [[105, 67, 42], [255, 221, 163]],
    [[105, 37, 25], [255, 157, 111]],
  ];

  function center(angle) {
    const radius = 1.23 + .56 * Math.cos(3 * angle);
    return [radius * Math.cos(2 * angle), radius * Math.sin(2 * angle), .62 * Math.sin(3 * angle)];
  }

  const frames = Array.from({ length: samples + 1 }, (_, sample) => {
    const angle = sample / samples * Math.PI * 2;
    const [x, y, z] = center(angle);
    const before = center(angle - .001);
    const after = center(angle + .001);
    const [dx, dy, dz] = after.map((value, index) => value - before[index]);
    const length = Math.hypot(dx, dy, dz);
    const radialX = Math.cos(2 * angle);
    const radialY = Math.sin(2 * angle);
    const acrossX = -dz * radialY / length;
    const acrossY = dz * radialX / length;
    const acrossZ = (dx * radialY - dy * radialX) / length;
    return { x, y, z, radialX, radialY, acrossX, acrossY, acrossZ, angle };
  });

  const strands = materials.map((_, material) => Array.from({ length: filaments }, (_, filament) =>
    frames.map(({ x, y, z, radialX, radialY, acrossX, acrossY, acrossZ, angle }) => {
      const twist = angle * 2 + material * Math.PI * 2 / materials.length + (filament / (filaments - 1) - .5) * 1.14;
      const a = .31 * Math.cos(twist);
      const b = .31 * Math.sin(twist);
      return [x + a * radialX + b * acrossX, y + a * radialY + b * acrossY, z + b * acrossZ];
    })
  ));
  const palette = materials.map(([shadow, highlight]) => Array.from({ length: depthBands }, (_, band) => {
    const intensity = (band + 1) / depthBands;
    return 'rgb(' + shadow.map((value, index) => Math.round(value + (highlight[index] - value) * intensity)).join(',') + ')';
  }));

  let width = 0;
  let height = 0;
  let density = 1;
  let pointerX = 0;
  let pointerY = 0;
  let tiltX = 0;
  let tiltY = 0;
  let phase = 0;
  let previousTime = 0;
  let frameId = 0;
  let inView = true;
  let paused = !motionPreference.matches;
  const allowsMotion = () => !paused;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

  function draw(time) {
    frameId = 0;
    if (!width || !height) return;

    const moving = allowsMotion() && inView;
    if (moving && previousTime) phase += Math.min(time - previousTime, 34) / 1000;
    previousTime = moving ? time : 0;
    tiltX += (pointerX - tiltX) * .075;
    tiltY += (pointerY - tiltY) * .075;

    const scroll = allowsMotion() ? clamp(-figure.getBoundingClientRect().top / height + .2, 0, 1) : 0;
    const yaw = .32 + Math.sin(phase * .39) * .44 + tiltX * .37 + scroll * .7;
    const pitch = -.37 + Math.cos(phase * .48) * .25 + tiltY * .28;
    const roll = -.3 + Math.sin(phase * .31) * .34;
    const [cy, sy, cx, sx, cr, sr] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch), Math.cos(roll), Math.sin(roll)];
    const scale = Math.min(width, height) * (.209 + scroll * .015);
    const midX = width * .51;
    const midY = height * .46;

    context.setTransform(density, 0, 0, density, 0, 0);
    context.clearRect(0, 0, width, height);
    const strokes = materials.map(() => Array.from({ length: depthBands }, () => new Path2D()));
    const sparks = new Path2D();
    const pulse = phase * 28 % samples;

    for (const [material, strandsInMaterial] of strands.entries()) {
      for (const [filament, strand] of strandsInMaterial.entries()) {
        let previousX = 0;
        let previousY = 0;
        for (const [sample, [x, y, z]] of strand.entries()) {
          const horizontal = x * cy + z * sy;
          const axis = z * cy - x * sy;
          const vertical = y * cx - axis * sx;
          const depth = y * sx + axis * cx;
          const perspective = 5.6 / (5.6 - depth);
          const screenX = midX + (horizontal * cr - vertical * sr) * scale * perspective;
          const screenY = midY + (horizontal * sr + vertical * cr) * scale * perspective;
          if (sample) {
            const band = clamp(Math.floor((depth + 1.55) * 1.9 + .6 * Math.sin(sample * .14 + filament * .19)), 0, depthBands - 1);
            const stroke = strokes[material][band];
            stroke.moveTo(previousX, previousY);
            stroke.lineTo(screenX, screenY);
            const distance = (sample - pulse + samples - material * 35) % samples;
            if (filament === 3 && distance < 7) {
              sparks.moveTo(previousX, previousY);
              sparks.lineTo(screenX, screenY);
            }
          }
          previousX = screenX;
          previousY = screenY;
        }
      }
    }
    context.lineCap = 'round';
    for (let band = 0; band < depthBands; band++) {
      context.lineWidth = .62 + band * .15;
      for (const [material, paths] of strokes.entries()) {
        context.strokeStyle = palette[material][band];
        context.stroke(paths[band]);
      }
    }
    context.lineWidth = 2.4;
    context.strokeStyle = '#fff5dc';
    context.stroke(sparks);

    if (moving) frameId = requestAnimationFrame(draw);
  }

  function schedule() {
    if (!frameId) frameId = requestAnimationFrame(draw);
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    width = box.width;
    height = box.height;
    density = Math.min(devicePixelRatio || 1, 1.65);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(height * density);
    schedule();
  }

  toggle.hidden = false;
  updateToggle();
  function updateToggle() {
    toggle.textContent = paused ? 'Activar movimiento' : 'Pausar movimiento';
  }
  toggle.addEventListener('click', () => {
    paused = !paused;
    updateToggle();
    schedule();
  });
  motionPreference.addEventListener('change', () => {
    paused = !motionPreference.matches;
    updateToggle();
    pointerX = pointerY = tiltX = tiltY = 0;
    schedule();
  });
  figure.addEventListener('pointermove', (event) => {
    if (!allowsMotion() || event.pointerType === 'touch') return;
    const bounds = figure.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width * 2 - 1;
    pointerY = (event.clientY - bounds.top) / bounds.height * 2 - 1;
  }, { passive: true });
  figure.addEventListener('pointerleave', () => { pointerX = pointerY = 0; });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) schedule();
    });
    observer.observe(figure);
  }
  new ResizeObserver(resize).observe(figure);
  resize();
}

function mountScrollStory() {
  const consolePanel = document.querySelector('.story-console');
  const steps = [...document.querySelectorAll('[data-story-step]')];
  const status = consolePanel.querySelector('[data-story-status]');
  const stages = [
    'Solicitud asignada al equipo de diseño',
    'Resumen preparado · Requiere aprobación',
    'Aprobación de ejemplo registrada en la bitácora',
  ];
  let frameId = 0;
  function update() {
    frameId = 0;
    const trigger = window.innerHeight * .66;
    const stage = steps.reduce((current, step, index) => step.getBoundingClientRect().top <= trigger ? index : current, 0);
    if (consolePanel.dataset.stage === String(stage)) return;
    consolePanel.dataset.stage = String(stage);
    status.textContent = stages[stage];
    animateChange(status);
  }
  function schedule() {
    if (!frameId) frameId = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
}

mountSculpture();
mountScrollStory();

// 아날로그 시계: 렌더링 + 드래그 조작
const AnalogClock = (() => {
  const CX = 150, CY = 150;
  // 바깥부터 안쪽으로: 분 안내 숫자 → 눈금 → 경과 분 게이지 → 시 숫자
  const R_MINUTE_NUM = 131;
  const R_TICK_OUT = 120;
  const R_TICK_MINOR = 113;
  const R_TICK_MAJOR = 106;
  const R_ARC = 96;
  const R_HOUR_NUM = 74;

  let svg, hourHand, minuteHand, secondHand, hourHit, minuteHit, minuteArc;
  let state = { hour: 12, minute: 0, isPM: false };
  let draggable = false;
  let changeListeners = [];
  let dragInfo = null;
  let secTurns = 0, prevSec = null;

  function hour24(s) {
    return (s.hour % 12) + (s.isPM ? 12 : 0);
  }

  function fromHour24(h24) {
    const norm = ((h24 % 24) + 24) % 24;
    return { isPM: norm >= 12, hour: (norm % 12) === 0 ? 12 : norm % 12 };
  }

  function drawFace() {
    const ticksG = svg.querySelector('#clockTicks');
    const numsG = svg.querySelector('#clockNumbers');
    const minNumsG = svg.querySelector('#minuteNumbers');
    ticksG.innerHTML = '';
    numsG.innerHTML = '';
    minNumsG.innerHTML = '';
    for (let i = 0; i < 60; i++) {
      const angle = i * 6;
      const major = i % 5 === 0;
      const r1 = major ? R_TICK_MAJOR : R_TICK_MINOR;
      const r2 = R_TICK_OUT;
      const line = svgEl('line', {
        x1: CX, y1: CY - r1, x2: CX, y2: CY - r2,
        class: 'tick' + (major ? ' major' : ''),
        transform: `rotate(${angle} ${CX} ${CY})`
      });
      ticksG.appendChild(line);
    }
    for (let n = 1; n <= 12; n++) {
      const angle = n * 30 * (Math.PI / 180);
      const r = R_HOUR_NUM;
      const x = CX + r * Math.sin(angle);
      const y = CY - r * Math.cos(angle);
      const text = svgEl('text', { x, y, class: 'clock-number' });
      text.textContent = n;
      numsG.appendChild(text);
    }
    // 5분 단위 가이드 숫자 (5,10,...,60) - 분침 색으로 바깥쪽 링에 표시 (1분 눈금과 함께 시간 읽기 학습)
    for (let m = 0; m < 60; m += 5) {
      const angle = m * 6 * (Math.PI / 180);
      const r = R_MINUTE_NUM;
      const x = CX + r * Math.sin(angle);
      const y = CY - r * Math.cos(angle);
      const label = m === 0 ? '60' : String(m);
      const text = svgEl('text', { x, y, class: 'minute-number' });
      text.textContent = label;
      minNumsG.appendChild(text);
    }
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  // 12시부터 현재 분침까지의 호 — 몇 분 지났는지를 '양'으로 보여준다
  function arcPath(r, deg) {
    if (deg <= 0) return '';
    const d = Math.min(deg, 359.9);
    const rad = (d - 90) * (Math.PI / 180);
    const x = CX + r * Math.cos(rad);
    const y = CY + r * Math.sin(rad);
    return `M ${CX} ${CY - r} A ${r} ${r} 0 ${d > 180 ? 1 : 0} 1 ${x} ${y}`;
  }

  function render() {
    const minuteAngle = state.minute * 6;
    const hourAngle = (state.hour % 12) * 30 + state.minute * 0.5;
    setRotate(hourHand, hourAngle);
    setRotate(hourHit, hourAngle);
    setRotate(minuteHand, minuteAngle);
    setRotate(minuteHit, minuteAngle);
    minuteArc.setAttribute('d', arcPath(R_ARC, minuteAngle));
    changeListeners.forEach(fn => fn({ ...state }));
  }

  function renderSeconds(date) {
    if (secondHand.hasAttribute('hidden')) return;
    const sec = date.getSeconds();
    // 59초 → 0초에서 뒤로 되감기지 않도록 각도를 계속 누적한다
    if (prevSec !== null && sec < prevSec) secTurns++;
    prevSec = sec;
    setRotate(secondHand, secTurns * 360 + sec * 6);
  }

  function setRotate(el, deg) {
    el.setAttribute('transform', `rotate(${deg} ${CX} ${CY})`);
  }

  function angleFromEvent(e) {
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let deg = Math.atan2(dx, -dy) * (180 / Math.PI);
    if (deg < 0) deg += 360;
    return deg;
  }

  function onPointerDown(which, e) {
    if (!draggable) return;
    e.preventDefault();
    const hitEl = which === 'hour' ? hourHit : minuteHit;
    hitEl.setPointerCapture(e.pointerId);
    hitEl.classList.add('dragging');
    dragInfo = {
      which,
      lastAngle: angleFromEvent(e),
      accum: 0,
      baseHour24: hour24(state),
      baseMinute: state.minute
    };
  }

  function onPointerMove(e) {
    if (!dragInfo) return;
    const angle = angleFromEvent(e);
    let delta = angle - dragInfo.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    dragInfo.accum += delta;
    dragInfo.lastAngle = angle;

    if (dragInfo.which === 'minute') {
      const minuteFloat = dragInfo.baseMinute + dragInfo.accum / 6;
      const minuteRounded = Math.round(minuteFloat);
      const hourSteps = Math.floor(minuteRounded / 60);
      const newMinute = ((minuteRounded % 60) + 60) % 60;
      const newHour24 = dragInfo.baseHour24 + hourSteps;
      const conv = fromHour24(newHour24);
      state = { hour: conv.hour, minute: newMinute, isPM: conv.isPM };
    } else {
      const hourFloat = dragInfo.baseHour24 + dragInfo.accum / 30;
      const newHour24 = Math.round(hourFloat);
      const conv = fromHour24(newHour24);
      state = { hour: conv.hour, minute: dragInfo.baseMinute, isPM: conv.isPM };
    }
    render();
  }

  function onPointerUp(e) {
    if (!dragInfo) return;
    const hitEl = dragInfo.which === 'hour' ? hourHit : minuteHit;
    hitEl.classList.remove('dragging');
    dragInfo = null;
  }

  function init(svgSelector) {
    svg = document.querySelector(svgSelector);
    hourHand = svg.querySelector('#hourHand');
    minuteHand = svg.querySelector('#minuteHand');
    secondHand = svg.querySelector('#secondHand');
    hourHit = svg.querySelector('#hourHandHit');
    minuteHit = svg.querySelector('#minuteHandHit');
    minuteArc = svg.querySelector('#minuteArc');
    drawFace();
    hourHit.addEventListener('pointerdown', e => onPointerDown('hour', e));
    minuteHit.addEventListener('pointerdown', e => onPointerDown('minute', e));
    hourHit.addEventListener('pointermove', onPointerMove);
    minuteHit.addEventListener('pointermove', onPointerMove);
    hourHit.addEventListener('pointerup', onPointerUp);
    minuteHit.addEventListener('pointerup', onPointerUp);
    render();
  }

  return {
    init,
    setState(s) { state = { ...s }; render(); },
    getState() { return { ...state }; },
    setDraggable(v) {
      draggable = v;
      hourHit.classList.toggle('draggable', v);
      minuteHit.classList.toggle('draggable', v);
    },
    showSeconds(v) {
      secondHand.toggleAttribute('hidden', !v);
      if (!v) return;
      // 다시 보일 때는 이전 각도에서 애니메이션으로 되감기지 않게 첫 프레임만 전환을 끈다
      secTurns = 0;
      prevSec = null;
      secondHand.classList.add('no-anim');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        secondHand.classList.remove('no-anim');
      }));
    },
    renderSeconds,
    onChange(fn) { changeListeners.push(fn); }
  };
})();

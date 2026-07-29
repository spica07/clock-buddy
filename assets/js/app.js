// 모드 전환 + 실시간/자유/퀴즈 모드 진행
(() => {
  const modeTabs = document.getElementById('modeTabs');
  const subTabs = document.getElementById('subTabs');
  const quizCard = document.getElementById('quizCard');
  const quizTarget = document.getElementById('quizTarget');
  const quizFeedback = document.getElementById('quizFeedback');
  const checkBtn = document.getElementById('checkBtn');
  const digitalTime = document.getElementById('digitalTime');
  const digitalAmpm = document.getElementById('digitalAmpm');
  const analogSvg = document.getElementById('analogClock');
  const shareBtn = document.getElementById('shareBtn');
  const shareToast = document.getElementById('shareToast');

  let mode = 'live';       // 'live' | 'practice'
  let subMode = 'free';    // 'free' | 'quiz'
  let liveTimer = null;

  AnalogClock.init('#analogClock');

  // 시는 시침 색, 분은 분침 색 — 어떤 바늘이 어떤 숫자인지 색으로 짝지어 준다
  function updateDigital(state) {
    const mm = String(state.minute).padStart(2, '0');
    digitalTime.innerHTML =
      `<span class="dc-h">${state.hour}</span>` +
      `<span class="dc-sep">:</span>` +
      `<span class="dc-m">${mm}</span>`;
    digitalAmpm.textContent = state.isPM ? '오후' : '오전';
  }

  AnalogClock.onChange(updateDigital);

  function dateToState(date) {
    let h = date.getHours();
    const isPM = h >= 12;
    h = h % 12;
    if (h === 0) h = 12;
    return { hour: h, minute: date.getMinutes(), isPM };
  }

  function stopLiveTimer() {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  }

  function tickLive() {
    const now = new Date();
    AnalogClock.setState(dateToState(now));
    AnalogClock.renderSeconds(now);
  }

  function enterLiveMode() {
    subTabs.hidden = true;
    quizCard.hidden = true;
    checkBtn.hidden = true;
    AnalogClock.setDraggable(false);
    AnalogClock.showSeconds(true);
    tickLive();
    liveTimer = setInterval(tickLive, 1000);
  }

  function enterPracticeMode() {
    subTabs.hidden = false;
    AnalogClock.showSeconds(false);
    AnalogClock.setDraggable(true);
    if (subMode === 'free') {
      enterFreeMode();
    } else {
      enterQuizMode();
    }
  }

  function enterFreeMode() {
    quizCard.hidden = true;
    checkBtn.hidden = true;
    quizFeedback.textContent = '';
  }

  function enterQuizMode() {
    quizCard.hidden = false;
    checkBtn.hidden = false;
    startNewQuizProblem();
  }

  function startNewQuizProblem() {
    quizFeedback.textContent = '';
    quizFeedback.className = 'quiz-feedback';
    const target = Quiz.newProblem();
    quizTarget.innerHTML =
      `<span class="t-ampm">${target.isPM ? '오후' : '오전'}</span>` +
      `<span class="t-h">${target.hour}시</span> ` +
      `<span class="t-m">${target.minute}분</span>`;
    AnalogClock.setState({ hour: 12, minute: 0, isPM: target.isPM });
  }

  function switchMode(newMode) {
    if (mode === newMode) return;
    mode = newMode;
    stopLiveTimer();
    [...modeTabs.querySelectorAll('.tab-btn')].forEach(btn => {
      const on = btn.dataset.mode === newMode;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    if (mode === 'live') enterLiveMode();
    else enterPracticeMode();
  }

  function switchSubMode(newSub) {
    if (subMode === newSub) return;
    subMode = newSub;
    [...subTabs.querySelectorAll('.sub-tab-btn')].forEach(btn => {
      const on = btn.dataset.submode === newSub;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    if (subMode === 'free') enterFreeMode();
    else enterQuizMode();
  }

  modeTabs.addEventListener('click', e => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchMode(btn.dataset.mode);
  });

  subTabs.addEventListener('click', e => {
    const btn = e.target.closest('.sub-tab-btn');
    if (btn) switchSubMode(btn.dataset.submode);
  });

  checkBtn.addEventListener('click', () => {
    const current = AnalogClock.getState();
    const correct = Quiz.check(current);
    if (correct) {
      Quiz.playCorrect();
      quizFeedback.textContent = '정답이에요! 참 잘했어요 🎉';
      quizFeedback.className = 'quiz-feedback correct';
      analogSvg.classList.add('celebrate');
      setTimeout(() => {
        analogSvg.classList.remove('celebrate');
        startNewQuizProblem();
      }, 1200);
    } else {
      Quiz.playWrong();
      quizFeedback.textContent = '다시 확인해볼까요?';
      quizFeedback.className = 'quiz-feedback wrong';
      analogSvg.classList.add('shake');
      setTimeout(() => analogSvg.classList.remove('shake'), 400);
    }
  });

  function showShareToast() {
    shareToast.hidden = false;
    clearTimeout(showShareToast._t);
    showShareToast._t = setTimeout(() => { shareToast.hidden = true; }, 2000);
  }

  shareBtn.addEventListener('click', async () => {
    const url = location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, url });
      } catch (e) {
        // 사용자가 공유를 취소한 경우 등은 무시
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showShareToast();
    } catch (e) {
      window.prompt('아래 링크를 복사하세요', url);
    }
  });

  // 초기 진입: 실시간 모드
  enterLiveMode();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();

// 퀴즈 모드: 문제 출제, 정답 판정, 사운드 피드백
const Quiz = (() => {
  let target = null;
  let audioCtx = null;

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playTone(freqs, duration) {
    const ctx = ensureAudioCtx();
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const startAt = ctx.currentTime + i * duration;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + duration);
    });
  }

  function playCorrect() {
    playTone([523.25, 659.25, 783.99], 0.16); // 도-미-솔
  }

  function playWrong() {
    playTone([220, 196], 0.22);
  }

  function randomTarget() {
    return {
      hour: 1 + Math.floor(Math.random() * 12),
      minute: Math.floor(Math.random() * 60),
      isPM: Math.random() < 0.5
    };
  }

  function formatTarget(t) {
    const ampm = t.isPM ? '오후' : '오전';
    return `${ampm} ${t.hour}시 ${t.minute}분`;
  }

  function newProblem() {
    target = randomTarget();
    return target;
  }

  function check(current) {
    return current.hour === target.hour &&
      current.minute === target.minute &&
      current.isPM === target.isPM;
  }

  return { newProblem, formatTarget, check, playCorrect, playWrong, getTarget: () => target };
})();

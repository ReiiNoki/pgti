/* ============================================================
   PGTI - 前端（调用 Worker API）
   ============================================================ */

(function () {
  'use strict';

  const API_BASE = 'https://pgti.reiinoki.workers.dev/'; // 空字符串 = 同源，生产环境改为你的 Worker 域名

  const state = {
    phase: 'home',
    currentQ: 0,
    answers: {},
    result: null,
    traitScores: null,
    questions: null,
    restoredFromStorage: false,
    _transitioning: false
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function fetchQuestions() {
    const res = await fetch(API_BASE + '/api/questions');
    return await res.json();
  }

  async function submitAnswers(answers, questionIds) {
    const res = await fetch(API_BASE + '/api/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers, questionIds })
    });
    return await res.json();
  }

  function render() {
    if (state.phase === 'home') renderHome();
    else if (state.phase === 'quiz') renderQuiz();
    else if (state.phase === 'result') renderResult();
  }

  function renderHome() {
    showPage('home-page');
  }

  function renderQuiz() {
    showPage('quiz-page');
    const q = state.questions[state.currentQ];
    const total = state.questions.length;

    document.getElementById('progress-fill').style.width = ((state.currentQ + 1) / total * 100).toFixed(1) + '%';
    document.getElementById('progress-fill').setAttribute('aria-valuenow', state.currentQ + 1);
    document.getElementById('progress-label').textContent = '第 ' + (state.currentQ + 1) + ' / ' + total + ' 题';
    document.getElementById('question-text').textContent = q.text;

    const container = document.getElementById('options-list');
    container.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    q.options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn' + (state.answers[state.currentQ] === i ? ' selected' : '');
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', state.answers[state.currentQ] === i ? 'true' : 'false');
      btn.innerHTML = '<span class="option-letter">' + letters[i] + '</span><span>' + opt.text + '</span>';
      btn.onclick = () => selectOption(i);
      container.appendChild(btn);
    });

    document.getElementById('prev-btn').style.visibility = state.currentQ === 0 ? 'hidden' : 'visible';
    document.getElementById('next-btn').textContent = state.currentQ === total - 1 ? '查看结果' : '下一题';
    document.getElementById('error-msg').classList.add('hidden');
  }

  function renderResult() {
    showPage('result-page');
    if (!state.result) return;

    const r = state.result;
    const card = document.getElementById('result-card');
    card.className = 'result-card rarity-' + r.rarity;

    const fieldsHtml = r.fields.map(f => '<span class="tag tag-field">' + f + '</span>').join('');
    const friendsHtml = r.friends.map(f => '<span class="tag tag-friend">' + f + '</span>').join('');
    const enemiesHtml = r.enemies.map(f => '<span class="tag tag-enemy">' + f + '</span>').join('');

    const traitsHtml = state.traitScores.map((t, i) => {
      const level = i === 0 ? 'high' : (i === 1 ? 'mid' : 'low');
      return '<div class="trait-bar-row"><span class="trait-bar-label">' + t.name +
             '</span><div class="trait-bar-track"><div class="trait-bar-fill ' + level +
             '" style="width:100%"></div></div></div>';
    }).join('');

    const restoredBanner = state.restoredFromStorage ?
      '<div class="restored-banner">📋 这是你上次的测试结果</div>' : '';

    card.innerHTML = restoredBanner +
      '<span class="rarity-badge label-' + r.rarity + '">' + r.rarity + '</span>' +
      '<div class="result-lang-name rarity-' + r.rarity + '">' + r.name + '</div>' +
      '<div class="result-title">' + r.title + '</div>' +
      '<div class="result-quote">"' + r.quote + '"</div>' +
      '<div class="result-section"><div class="result-section-title">详细说明</div><div class="result-section-text">' + r.description + '</div></div>' +
      '<div class="result-section"><div class="result-section-title">适合领域</div><div class="tag-list">' + fieldsHtml + '</div></div>' +
      '<div class="result-section"><div class="result-section-title">⚠ 危险倾向</div><div class="result-section-text">' + r.danger + '</div></div>' +
      '<div class="friend-enemy-row"><div class="friend-enemy-col"><div class="friend-enemy-label">🤝 好友语言</div><div class="tag-list">' + friendsHtml + '</div></div><div class="friend-enemy-col"><div class="friend-enemy-label">⚔ 天敌语言</div><div class="tag-list">' + enemiesHtml + '</div></div></div>' +
      '<div class="result-section"><div class="result-section-title">你的隐藏倾向</div><div class="traits-section">' + traitsHtml + '</div></div>';
  }

  function selectOption(optIndex) {
    state.answers[state.currentQ] = optIndex;
    renderQuiz();
  }

  function prevQuestion() {
    if (state.currentQ > 0) {
      state.currentQ--;
      renderQuiz();
    }
  }

  async function nextQuestion() {
    if (state._transitioning) return;

    if (state.answers[state.currentQ] === undefined) {
      document.getElementById('error-msg').classList.remove('hidden');
      return;
    }

    if (state.currentQ < state.questions.length - 1) {
      state.currentQ++;
      renderQuiz();
    } else {
      state._transitioning = true;
      const questionIds = state.questions.map(q => q.id);
      const answers = Object.values(state.answers);

      try {
        const data = await submitAnswers(answers, questionIds);
        state.result = data.result;
        state.traitScores = data.traitScores;
        state.restoredFromStorage = false;
        state.phase = 'result';
        saveToStorage();
        renderResult();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        alert('计算结果失败: ' + e.message);
      }
      state._transitioning = false;
    }
  }

  function restart() {
    state.phase = 'home';
    state.currentQ = 0;
    state.answers = {};
    state.result = null;
    state.traitScores = null;
    state.questions = null;
    state.restoredFromStorage = false;
    state._transitioning = false;
    renderHome();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showPage(pageId) {
    const pages = ['home-page', 'quiz-page', 'result-page'];
    pages.forEach(p => {
      document.getElementById(p).classList.toggle('hidden', p !== pageId);
    });
  }

  function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = 'toast ' + (type || '');
    toast.classList.remove('hidden');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.add('hidden'), 2500);
  }

  function saveToStorage() {
    try {
      localStorage.setItem('pgti_last_result', JSON.stringify({
        result: state.result,
        traitScores: state.traitScores,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem('pgti_last_result');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.result) {
          state.result = data.result;
          state.traitScores = data.traitScores;
          state.restoredFromStorage = true;
          state.phase = 'result';
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function copyResult() {
    if (!state.result) return;
    const r = state.result;
    const text = '我在 PGTI 程序员极客人格测试中测出了「' + r.name + ' 型人格」：' + r.title + '。"' + r.quote + '"来测测你适合哪种编程语言。';

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板！快去分享吧 ✨', 'success'));
    } else {
      showToast('复制失败，请手动复制文本', 'error');
    }
  }

  async function init() {
    loadFromStorage();

    document.getElementById('start-btn').onclick = async () => {
      state.phase = 'quiz';
      state.currentQ = 0;
      state.answers = {};
      state.result = null;
      state.traitScores = null;
      state.restoredFromStorage = false;

      try {
        state.questions = await fetchQuestions();
        renderQuiz();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        alert('获取题目失败: ' + e.message);
      }
    };

    document.getElementById('prev-btn').onclick = prevQuestion;
    document.getElementById('next-btn').onclick = nextQuestion;
    document.getElementById('restart-btn').onclick = restart;
    document.getElementById('copy-btn').onclick = copyResult;

    document.addEventListener('keydown', e => {
      if (state.phase !== 'quiz') return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 4) {
        e.preventDefault();
        selectOption(num - 1);
      }
      if (e.key === 'ArrowLeft' && state.currentQ > 0) {
        e.preventDefault();
        prevQuestion();
      }
      if ((e.key === 'ArrowRight' || e.key === 'Enter') && state.answers[state.currentQ] !== undefined) {
        e.preventDefault();
        nextQuestion();
      }
    });

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
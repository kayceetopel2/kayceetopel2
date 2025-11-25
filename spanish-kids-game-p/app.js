/* Spanish Kids Game - app.js
   Implements levels, question types, timer/scoring, rewards, and leaderboard.
*/
(function(){
  const DOM = {
    startBtn: document.getElementById('startBtn'),
    categorySelect: document.getElementById('categorySelect'),
    levelSelect: document.getElementById('levelSelect'),
    timer: document.getElementById('timer'),
    score: document.getElementById('score'),
    stars: document.getElementById('stars'),
    questionPanel: document.getElementById('questionPanel'),
    feedback: document.getElementById('feedback'),
    hintArea: document.getElementById('hintArea'),
    controlsArea: document.getElementById('controlsArea'),
    leaderboardList: document.getElementById('leaderboardList'),
    wheelCanvas: document.getElementById('categoryWheel'),
    spinWheel: document.getElementById('spinWheel')
  };

  // Simple dataset: 3 levels, 5 question types, 2 sets each
  const QUESTIONS = generateQuestions();

  // Wheel categories (labels visible on the wheel) and their select values
  const WHEEL_CATEGORIES = ['Animales','Comida','Casa','Colores','Naturaleza'];
  const WHEEL_KEYS = ['animals','food','home','colors','nature'];

  let state = {
    timeLeft: 0, timerInterval: null, totalTime: 60,
    score:0, stars:0, roundActive:false, currentQuestion:null
  };

  // Initialize
  renderLeaderboard();
  drawWheel();
  // audio context & simple sounds
  const Audio = (function(){
    let ctx = null;
    function getCtx(){ if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); return ctx; }
    function tone(freq,dur,vol=0.12,type='sine'){ const c=getCtx(); const o=c.createOscillator(); const g=c.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=vol; o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+dur/1000); }
    return {
      correct: ()=>{ tone(880,160,0.12,'sine'); setTimeout(()=>tone(1100,120,0.09,'sine'),120); },
      wrong: ()=>{ tone(220,220,0.14,'square'); setTimeout(()=>tone(160,160,0.10,'square'),140); },
      click: ()=>{ tone(660,80,0.06,'sine'); }
    };
  })();

  DOM.startBtn.addEventListener('click', startRound);
  DOM.spinWheel.addEventListener('click', spinWheel);
  DOM.startBtn.addEventListener('mousedown', ()=>Audio.click());

  function startRound(){
    const category = DOM.categorySelect.value;
    const level = Number(DOM.levelSelect.value);
    const pool = QUESTIONS.filter(q => q.category === category && q.level === level);
    if(pool.length===0){ alert('No questions for this category/level'); return }

    // pick random question from pool and remove it for variety
    const idx = Math.floor(Math.random()*pool.length);
    const q = JSON.parse(JSON.stringify(pool[idx]));
    state.currentQuestion = q;
    state.totalTime = q.time || (60 - level*10);
    state.timeLeft = state.totalTime;
    state.score = state.score; // keep cumulative across rounds
    state.roundActive = true;
    updateUI();
    renderQuestion(q);
    startTimer();
  }

  function startTimer(){
    clearInterval(state.timerInterval);
    updateTimerDisplay();
    state.timerInterval = setInterval(()=>{
      state.timeLeft -= 1;
      updateTimerDisplay();
      if(state.timeLeft <= 0){
        clearInterval(state.timerInterval);
        endRound(false,'Tiempo agotado');
      }
    },1000);
  }

  function updateTimerDisplay(){
    DOM.timer.textContent = `Time: ${state.timeLeft}s`;
  }

  function updateUI(){
    DOM.score.textContent = `Score: ${state.score}`;
    DOM.stars.textContent = `Stars: ${state.stars}`;
  }

  function renderQuestion(q){
    DOM.questionPanel.innerHTML = '';
    DOM.hintArea.innerHTML = '';
    DOM.controlsArea.innerHTML = '';
    DOM.feedback.textContent = '';
    state._firstPick = null;

    const card = document.createElement('div'); card.className='card';
    if(state._fromWheel){
      const badge = document.createElement('div');
      badge.style.cssText = 'display:inline-block;background:#FFD54F;color:#4E342E;padding:4px 8px;border-radius:12px;font-size:12px;margin-bottom:8px;font-weight:600';
      badge.textContent = '⭐ Wheel Challenge';
      card.appendChild(badge);
      state._fromWheel = false;
    }
    const title = document.createElement('h2'); title.textContent = q.prompt_en || q.prompt || q.type;
    const instruct = document.createElement('div'); instruct.style.marginBottom='6px'; instruct.style.color='#5D4037'; instruct.textContent = 'Answer in Spanish. Hints/explanations appear in English.';
    card.appendChild(instruct);
    card.appendChild(title);

    // Show/hide wheel container based on question type
    DOM.wheelCanvas.parentElement.style.display = (q.type === 'wheel-challenge') ? 'flex' : 'none';

    if(q.type === 'image-match'){
      // show images on left and words on right; require selecting an image then a word
      const instr = document.createElement('div');
      instr.style.cssText = 'background:#FFF3E0;padding:8px;border-radius:6px;margin-bottom:10px;font-size:13px;color:#5D4037';
      instr.textContent = '👉 Click an image on the left, then the matching word on the right';
      card.appendChild(instr);
      const grid = document.createElement('div'); grid.className='matchGrid';
      const left = document.createElement('div'); left.className='matchImages';
      const right = document.createElement('div'); right.className='matchWords';

      // prepare words array and shuffle so words won't be next to original images
      const words = q.items.map(it=>({key: it.word, display: it.word_es || it.word, en: it.word_en || ''}));
      for(let i=words.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [words[i],words[j]]=[words[j],words[i]] }

      q.items.forEach((it)=>{
        const imgBox = document.createElement('div'); imgBox.className='matchImageBox'; imgBox.dataset.key = it.word;
        imgBox.innerHTML = `<img src="assets/${it.img}" width="84" alt="${it.word}">`;
        imgBox.addEventListener('click', ()=>{
          // select this image for matching
          if(state._firstPick && state._firstPick.type === 'image'){
            state._firstPick.el.classList.remove('selected');
          }
          state._firstPick = {type:'image', key: it.word, el: imgBox};
          imgBox.classList.add('selected');
          DOM.feedback.textContent = 'Now pick the matching Spanish word on the right.';
        });
        left.appendChild(imgBox);
      });

      words.forEach(w=>{
        const wordBox = document.createElement('div'); wordBox.className='matchWordBox'; wordBox.dataset.key = w.key;
        wordBox.innerHTML = `<strong>${w.display}</strong>` + (w.en?`<div style="font-size:12px;color:#5D4037">(${w.en})</div>`:'');
        wordBox.addEventListener('click', ()=>{
          if(!state._firstPick || state._firstPick.type !== 'image'){
            DOM.feedback.textContent = 'Please select an image first on the left.'; return;
          }
          const imageKey = state._firstPick.key;
          if(wordBox.dataset.key === imageKey){
            // correct match
            finishCorrect(q);
            state._firstPick.el.classList.remove('selected');
            state._firstPick = null;
          } else {
            // wrong
            finishWrong(q);
            wordBox.classList.add('selected');
            setTimeout(()=>wordBox.classList.remove('selected'),700);
            if(state._firstPick && state._firstPick.el) state._firstPick.el.classList.remove('selected');
            state._firstPick = null;
          }
        });
        right.appendChild(wordBox);
      });

      grid.appendChild(left); grid.appendChild(right);
      card.appendChild(grid);
    }

    else if(q.type === 'wheel-challenge'){
      // Show a spin button that picks a quick sub-question from the same category/level
      const info = document.createElement('div'); info.textContent = q.prompt || 'Spin the wheel and answer the challenge'; info.style.marginBottom='8px';
      const spinBtn = document.createElement('button'); spinBtn.textContent = 'Spin Challenge';
      spinBtn.addEventListener('click', ()=>{
        // animate the wheel visually then pick sub-question
        spinWheelVisual(()=>{
          const allowed = ['multiple-choice','image-match','true-false','reorder'];
          const pool = QUESTIONS.filter(sq=>sq.level===q.level && sq.category===DOM.categorySelect.value && allowed.includes(sq.type));
          if(pool.length===0){ DOM.feedback.textContent = 'No challenges available for this selection.'; return }
          const pick = JSON.parse(JSON.stringify(pool[Math.floor(Math.random()*pool.length)]));
          // preserve parent wheel question so we can return to it after sub-question; mark it as from wheel
          state._wheelParent = JSON.parse(JSON.stringify(q));
          state._fromWheel = true;
          renderQuestion(pick);
        });
      });
      card.appendChild(info);
      card.appendChild(spinBtn);
      // auto-spin for speed rounds
      setTimeout(()=>{ try{ spinBtn.click(); }catch(e){} }, 700);
    }

    else if(q.type === 'multiple-choice'){
      q.choices.forEach(choice=>{
        const c = document.createElement('div'); c.className='choice';
        // show Spanish and small English translation if provided
        c.innerHTML = choice.text + (choice.text_en?` <div style="font-size:12px;color:#5D4037">(${choice.text_en})</div>`:'');
        c.addEventListener('click', ()=> handleMC(c, choice, q));
        card.appendChild(c);
      });
    }

    else if(q.type === 'true-false'){
      const stmt = document.createElement('div');
      stmt.style.cssText = 'background:#fff;padding:12px;border-radius:8px;margin-bottom:12px;font-size:14px;font-style:italic;color:#4E342E';
      stmt.textContent = q.prompt.replace(' / ', ' — ');
      card.appendChild(stmt);
      const t = document.createElement('div'); t.className='choice'; t.textContent = 'True (Verdadero)'; t.addEventListener('click', ()=> handleTF(true,q));
      const f = document.createElement('div'); f.className='choice'; f.textContent = 'False (Falso)'; f.addEventListener('click', ()=> handleTF(false,q));
      card.appendChild(t); card.appendChild(f);
    }

    else if(q.type === 'reorder'){
      // create draggable words
      const container = document.createElement('div'); container.className='dropzone'; container.id='dropzone';
      const wordBar = document.createElement('div');
      q.words_shuffled.forEach(w=>{
        const d = document.createElement('span'); d.className='draggable'; d.draggable=true; d.textContent=w;
        d.addEventListener('dragstart',(ev)=>ev.dataTransfer.setData('text/plain', w));
        wordBar.appendChild(d);
      });
      container.addEventListener('dragover', e=>e.preventDefault());
      container.addEventListener('drop', e=>{
        e.preventDefault(); const w = e.dataTransfer.getData('text/plain'); const el = document.createElement('span'); el.className='draggable'; el.textContent=w; container.appendChild(el);
      });
      const check = document.createElement('button'); check.textContent='Check Order'; check.addEventListener('click', ()=>{
        const got = Array.from(container.querySelectorAll('.draggable')).map(n=>n.textContent.trim());
        if(got.join(' ') === q.answer.join(' ')) finishCorrect(q);
        else finishWrong(q);
      });
      card.appendChild(wordBar); card.appendChild(container); card.appendChild(check);
    }

    DOM.questionPanel.appendChild(card);

    // show hint button
    if(q.hint){
      const hintBtn = document.createElement('button'); hintBtn.textContent='Hint'; hintBtn.addEventListener('click', ()=>{
        DOM.hintArea.textContent = `Hint: ${q.hint}`;
      });
      DOM.controlsArea.appendChild(hintBtn);
    }
  }

  function handleMatchSelect(box,q){
    // For simplicity, first selection stores value; second checks against a target
    if(!state._firstPick){
      state._firstPick = box; box.classList.add('selected');
      DOM.feedback.textContent = 'Select the matching image';
      return;
    }
    const first = state._firstPick; const second = box;
    // check if words are same pair (simple equality)
    if(first.dataset.answer === second.dataset.answer){
      finishCorrect(q);
    } else {
      finishWrong(q);
    }
    first.classList.remove('selected'); state._firstPick = null;
  }

  function handleMC(el, choice, q){
    if(choice.correct) finishCorrect(q, choice);
    else finishWrong(q, choice);
    markChoice(el, choice.correct);
  }

  function handleTF(value,q){
    if(value === q.answer) finishCorrect(q);
    else finishWrong(q);
  }

  function markChoice(el, correct){
    if(correct) el.classList.add('correct'); else el.classList.add('wrong');
  }

  function finishCorrect(q, choice){
    Audio.correct();
    addConfetti();
    const multiplier = 1 + (state.timeLeft / state.totalTime);
    const base = q.points||100;
    const gain = Math.round(base * multiplier);
    state.score += gain;
    state.stars += q.stars||1;
    updateUI();
    DOM.feedback.textContent = `Correct! +${gain} points. Explanation: ${q.explain || 'Well done!'}`;
    // If this was a wheel sub-question, return to the wheel view instead of ending the round
    if(state._wheelParent){
      const parent = state._wheelParent; state._wheelParent = null;
      // brief pause so child sees feedback, then show wheel parent again
      setTimeout(()=>{
        renderQuestion(parent);
      },900);
      return;
    }
    // otherwise end the round and prompt for leaderboard
    clearInterval(state.timerInterval);
    saveScoreIfFinished();
  }

  function finishWrong(q, choice){
    Audio.wrong();
    DOM.feedback.textContent = `Incorrect. ${q.explain || 'Try again.'}`;
    // shake feedback
    DOM.questionPanel.classList.add('shake');
    setTimeout(()=>DOM.questionPanel.classList.remove('shake'),700);
    state.score -= q.penalty || 5;
    if(state.score < 0) state.score = 0;
    updateUI();
    // If this was a wheel sub-question, return to the wheel view
    if(state._wheelParent){
      const parent = state._wheelParent; state._wheelParent = null;
      setTimeout(()=>{ renderQuestion(parent); },900);
    }
  }

  // confetti helper
  function addConfetti(){
    const container = DOM.questionPanel;
    container.classList.add('celebrate');
    const colors = ['#FF8A65','#FFD54F','#FFAB91','#FF7043','#4DB6AC','#AED581'];
    const pieces = 14;
    for(let i=0;i<pieces;i++){
      const p = document.createElement('div'); p.className='confetti-piece';
      p.style.left = (20 + Math.random()* (container.clientWidth-40)) + 'px';
      p.style.top = (container.clientHeight + 10) + 'px';
      p.style.background = colors[Math.floor(Math.random()*colors.length)];
      p.style.transform = `translateY(0) rotate(${Math.random()*360}deg)`;
      p.style.animationDelay = (Math.random()*120) + 'ms';
      container.appendChild(p);
      // remove after animation
      setTimeout(()=>{ if(p && p.parentNode) p.parentNode.removeChild(p); },1700);
    }
    setTimeout(()=>container.classList.remove('celebrate'),1600);
  }

  function endRound(correct, msg){
    state.roundActive = false;
    clearInterval(state.timerInterval);
    DOM.feedback.textContent = msg || 'Round ended';
    saveScoreIfFinished();
  }

  function saveScoreIfFinished(){
    // prompt for name and save to leaderboard if score > 0
    if(state.score>0){
      const name = prompt('Enter player name for leaderboard (or cancel):');
      if(name){
        addLeaderboardEntry({name: name.slice(0,24), score: state.score, stars: state.stars, date: new Date().toISOString()});
      }
    }
    renderLeaderboard();
  }

  // Leaderboard: localStorage
  function addLeaderboardEntry(entry){
    const L = JSON.parse(localStorage.getItem('spanishKidsLeaderboard')||'[]');
    L.push(entry); L.sort((a,b)=>b.score-a.score);
    localStorage.setItem('spanishKidsLeaderboard', JSON.stringify(L.slice(0,20)));
  }
  function renderLeaderboard(){
    const L = JSON.parse(localStorage.getItem('spanishKidsLeaderboard')||'[]');
    DOM.leaderboardList.innerHTML = '';
    L.forEach(it=>{
      const li = document.createElement('li'); li.textContent = `${it.name} — ${it.score} pts — ${it.stars}★`; DOM.leaderboardList.appendChild(li);
    });
  }

  // Category wheel
  function drawWheel(){
    const canvas = DOM.wheelCanvas; const ctx = canvas.getContext('2d');
    const categories = WHEEL_CATEGORIES;
    const colors = ['#FFCC80','#FFAB91','#FFE082','#FFD54F','#FF8A65'];
    const radius = canvas.width/2;
    categories.forEach((label,i)=>{
      const start = (i/categories.length) * Math.PI*2;
      const end = ((i+1)/categories.length) * Math.PI*2;
      ctx.beginPath(); ctx.moveTo(radius,radius);
      ctx.arc(radius,radius,radius,start,end); ctx.closePath(); ctx.fillStyle = colors[i%colors.length]; ctx.fill();
      ctx.save(); ctx.translate(radius,radius); ctx.rotate((start+end)/2); ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.textAlign='right'; ctx.font='14px sans-serif'; ctx.fillText(label, radius-10, 6); ctx.restore();
    });
  }

  function spinWheel(){
    // pick a random category and set the select
    const cats = ['animals','food','home','colors','nature'];
    const pick = cats[Math.floor(Math.random()*cats.length)];
    DOM.categorySelect.value = pick==='animals'?'animals':(pick==='food'?'food':(pick==='home'?'home':'animals'));
    DOM.feedback.textContent = `Wheel picked: ${pick}`;
  }

  // Visual wheel spin: rotate canvas element then call callback
  function spinWheelVisual(callback){
    const canvas = DOM.wheelCanvas;
    const n = WHEEL_CATEGORIES.length;
    // pick a target segment index to land on
    const targetIndex = Math.floor(Math.random()*n);
    // compute segment center angle (radians) measured from +X axis
    const theta = ((targetIndex + 0.5)/n) * Math.PI * 2;
    // we want the label at the top (negative 90deg), so rotation = -90deg - theta
    const rotationDegForLabel = -90 - (theta * 180/Math.PI);
    // add full spins for animation
    const extra = 720 + Math.floor(Math.random()*360);
    const finalDeg = extra + rotationDegForLabel;
    canvas.classList.add('spin-anim');
    canvas.style.transform = `rotate(${finalDeg}deg)`;
    // after animation, keep wheel visually landed and set category
    setTimeout(()=>{
      canvas.classList.remove('spin-anim');
      // keep transform so the wheel appears landed
      // set the category select to the landed key
      const key = WHEEL_KEYS[targetIndex] || 'animals';
      DOM.categorySelect.value = key;
      DOM.feedback.textContent = `Wheel landed on: ${WHEEL_CATEGORIES[targetIndex]} (${key})`;
      if(typeof callback === 'function') callback();
    }, 1200);
  }

  function generateQuestions(){
    // For brevity create a minimal set: 3 levels * 5 types * 2 sets = 30
    const categories = ['animals','food','home'];
    const out = [];
    // helpers
    // small map of Spanish prompt -> English translation to create bilingual prompts
    const promptMap = {
      '¿Qué es esto?':'What is this?',
      'Selecciona la palabra correcta':'Select the correct word',
      'Empareja la imagen con la palabra':'Match the image with the word',
      'Empareja la imagen':'Match the image',
      '"El perro tiene alas."':'"El perro tiene alas."',
      '"La vaca dice mu."':'"The cow says moo."',
      'Ordena las palabras para formar el nombre':'Order the words to form the name',
      'Ordena: la / manzana':'Order: la / manzana',
      'Spin & answer a quick noun question':'Spin & answer a quick noun question',
      'Rápido: nombre la imagen':'Quick: name the picture',
      'Escoge la frase correcta':'Choose the correct phrase',
      'Elige la frase':'Choose the phrase',
      'Relaciona la acción con la imagen':'Match the action with the image',
      'Empareja':'Match',
      '"Tengo sed" significa I am thirsty.':'"Tengo sed" means I am thirsty.',
      '"¿Dónde vives?" asks for age.':'"¿Dónde vives?" asks where you live.',
      'Ordena la frase':'Order the phrase',
      'Ordena':'Order',
      'Wheel phrase challenge':'Wheel phrase challenge',
      'Speed phrase':'Speed phrase',
      'Choose correct grammar':'Choose the correct grammar option',
      'Select correct sentence':'Select the correct sentence',
      'Match sentence to image':'Match the sentence to the image',
      'Empareja la oración':'Match the sentence',
      '"Nosotros vamos al parque" means We go to the park.':'"Nosotros vamos al parque" means We go to the park.',
      '"Él son estudiante" is grammatically correct.':'"Él son estudiante" is grammatically correct.' ,
      'Reorder to create a sentence':'Reorder to create a sentence',
      'Ordena':'Order',
      'Grammar wheel challenge':'Grammar wheel challenge',
      'Sentence speed round':'Sentence speed round'
    };

    function push(cat,level,type,obj){
      // build bilingual prompt if a Spanish prompt was provided
      if(obj && obj.prompt){
        const spanish = obj.prompt;
        const eng = obj.prompt_en || promptMap[spanish] || '';
        if(eng) obj.prompt = `${eng} / ${spanish}`;
        else obj.prompt = `${spanish}`;
      }
      out.push(Object.assign({category:cat,level:level,type:type},obj));
    }

    // Level 1 - basic nouns
    categories.forEach(cat=>{
      // multiple choice x2
      push(cat,1,'multiple-choice',{prompt:'¿Qué es esto?',choices:[{text:'El perro',correct:true},{text:'La casa'},{text:'Una silla'},{text:'El río'}],answer:'El perro',explain:'"El perro" es un animal.',points:40,stars:1,time:30});
      push(cat,1,'multiple-choice',{prompt:'Selecciona la palabra correcta',choices:[{text:'La manzana',correct:true},{text:'El coche'},{text:'La mesa'},{text:'El gato'}],explain:'"La manzana" es una fruta.',points:40,stars:1,time:30});

      // image-match x2
      push(cat,1,'image-match',{prompt:'Empareja la imagen con la palabra',items:[{img:'axolotl.svg',word:'axolote',word_es:'Axolote'},{img:'jaguar.svg',word:'jaguar',word_es:'Jaguar'}],explain:'Match the picture with the Spanish noun.',points:50,stars:1,time:35});
      push(cat,1,'image-match',{prompt:'Empareja la imagen',items:[{img:'quetzal.svg',word:'quetzal',word_es:'Quetzal'},{img:'armadillo.svg',word:'armadillo',word_es:'Armadillo'}],explain:'Observe the animal name.',points:50,stars:1,time:35});

      // true-false x2
      push(cat,1,'true-false',{prompt:'"El perro tiene alas."',answer:false,explain:'Los perros no tienen alas.',points:20,stars:0,time:20});
      push(cat,1,'true-false',{prompt:'"La vaca dice mu."',answer:true,explain:'Sí, la vaca hace "mu".',points:20,stars:0,time:20});

      // reorder x2
      push(cat,1,'reorder',{prompt:'Ordena las palabras para formar el nombre',words_shuffled:['perro','el'],answer:['el','perro'],explain:'El artículo va antes del nombre.',points:40,stars:1,time:30});
      push(cat,1,'reorder',{prompt:'Ordena: la / manzana',words_shuffled:['manzana','la'],answer:['la','manzana'],explain:'"La manzana"',points:40,stars:1,time:30});

      // category wheel as question: simple challenge x2
      push(cat,1,'wheel-challenge',{prompt:'Spin & answer a quick noun question',explain:'Wheel chooses a category then shows a noun.',points:60,stars:1,time:25});
      push(cat,1,'wheel-challenge',{prompt:'Rápido: nombre la imagen',explain:'Answer quickly to get more points',points:60,stars:1,time:25});
    });

    // Level 2 - phrases
    categories.forEach(cat=>{
      push(cat,2,'multiple-choice',{prompt:'Escoge la frase correcta',choices:[{text:'¿Cómo te llamas?',correct:true},{text:'Yo comer'}, {text:'Casa grande'},{text:'El azul'}],explain:'Use for asking a name.',points:60,stars:1,time:40});
      push(cat,2,'multiple-choice',{prompt:'Elige la frase',choices:[{text:'Tengo hambre',correct:true},{text:'Tengo grande'},{text:'Yo es'}, {text:'Está mesa'}],explain:'"Tengo hambre" means I am hungry.',points:60,stars:1,time:40});

      push(cat,2,'image-match',{prompt:'Relaciona la acción con la imagen',items:[{img:'iguana.svg',word:'la iguana',word_es:'La iguana'},{img:'coyote.svg',word:'el coyote',word_es:'El coyote'}],explain:'Match names with pictures.',points:60,stars:1,time:40});
      push(cat,2,'image-match',{prompt:'Empareja',items:[{img:'axolotl.svg',word:'el axolote',word_es:'El axolote'},{img:'jaguar.svg',word:'el jaguar',word_es:'El jaguar'}],explain:'Match the animal phrases.',points:60,stars:1,time:40});

      push(cat,2,'true-false',{prompt:'"Tengo sed" significa I am thirsty.',answer:true,explain:'Correct meaning.',points:30,stars:0,time:25});
      push(cat,2,'true-false',{prompt:'"¿Dónde vives?" asks for age.',answer:false,explain:'It asks where you live.',points:30,stars:0,time:25});

      push(cat,2,'reorder',{prompt:'Ordena la frase',words_shuffled:['tengo','hambre'],answer:['tengo','hambre'],explain:'Phrase: Tengo hambre.',points:60,stars:1,time:40});
      push(cat,2,'reorder',{prompt:'Ordena',words_shuffled:['me','llamo'],answer:['me','llamo'],explain:'Me llamo...',points:60,stars:1,time:40});

      push(cat,2,'wheel-challenge',{prompt:'Wheel phrase challenge',explain:'Form a phrase after wheel picks',points:80,stars:1,time:30});
      push(cat,2,'wheel-challenge',{prompt:'Speed phrase',explain:'Answer quickly to earn bonuses',points:80,stars:1,time:30});
    });

    // Level 3 - simple sentences and grammar MCQs
    categories.forEach(cat=>{
      push(cat,3,'multiple-choice',{prompt:'Choose correct grammar',choices:[{text:'Yo estoy cansado',correct:true},{text:'Yo es cansado'},{text:'Estoy yo cansado'},{text:'Cansado soy yo'}],explain:'Correct conjugation of estar.',points:120,stars:2,time:50});
      push(cat,3,'multiple-choice',{prompt:'Select correct sentence',choices:[{text:'Ella come una manzana',correct:true},{text:'Ella comen una manzana'},{text:'Comer ella una manzana'},{text:'Manzana ella come'}],explain:'Subject-verb agreement.',points:120,stars:2,time:50});

      push(cat,3,'image-match',{prompt:'Match sentence to image',items:[{img:'jaguar.svg',word:'El jaguar corre',word_es:'El jaguar corre'},{img:'coyote.svg',word:'El coyote duerme',word_es:'El coyote duerme'}],explain:'Match actions in the sentence with the picture.',points:120,stars:2,time:50});
      push(cat,3,'image-match',{prompt:'Empareja la oración',items:[{img:'iguana.svg',word:'La iguana come',word_es:'La iguana come'},{img:'armadillo.svg',word:'El armadillo busca comida',word_es:'El armadillo busca comida'}],explain:'Observe verbs and subjects.',points:120,stars:2,time:50});

      push(cat,3,'true-false',{prompt:'"Nosotros vamos al parque" means We go to the park.',answer:true,explain:'Correct translation.',points:50,stars:1,time:35});
      push(cat,3,'true-false',{prompt:'"Él son estudiante" is grammatically correct.',answer:false,explain:'Should be "Él es estudiante".',points:50,stars:1,time:35});

      push(cat,3,'reorder',{prompt:'Reorder to create a sentence',words_shuffled:['come','la','iguana'],answer:['la','iguana','come'],explain:'La iguana come.',points:100,stars:2,time:50});
      push(cat,3,'reorder',{prompt:'Ordena',words_shuffled:['vamos','nosotros','al','parque'],answer:['nosotros','vamos','al','parque'],explain:'Nosotros vamos al parque.',points:100,stars:2,time:50});

      push(cat,3,'wheel-challenge',{prompt:'Grammar wheel challenge',explain:'Spin the wheel then answer a grammar question',points:150,stars:2,time:45});
      push(cat,3,'wheel-challenge',{prompt:'Sentence speed round',explain:'Correct sentence under time pressure',points:150,stars:2,time:45});
    });

    return out;
  }

})();

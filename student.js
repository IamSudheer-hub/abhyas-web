const Student = {
    currentStudent: null,  // { name, rollNumber }
    currentQuiz: null,
    currentQuizData: null,  // the quiz document
    answers: {},           // { questionId: answer }
    timerInterval: null,
    timeRemaining: 0,
    timeSpent: 0,
    tabSwitches: 0,
    quizStartTime: null,
    _visibilityHandler: null,

    // ── INITIALIZATION ──
    init() {
        this.checkSession();
        this.setupEventListeners();
    },

    // ── AUTH (Firestore-based, not Firebase Auth) ──
    checkSession() {
        const session = sessionStorage.getItem('abhyas_student');
        if (session) {
            this.currentStudent = JSON.parse(session);
            document.getElementById('studentName').textContent = this.currentStudent.name;
            document.getElementById('login-view').classList.remove('active');
            document.getElementById('app-shell').style.display = '';
            this.showView('dashboard-view');
        }
    },

    async login() {
        const roll = document.getElementById('loginRoll').value.trim();
        const pass = document.getElementById('loginPass').value;
        const errEl = document.getElementById('loginError');

        if (!roll || !pass) {
            errEl.textContent = 'Please fill all fields';
            return;
        }

        Utils.showLoader();
        errEl.textContent = '';
        try {
            const doc = await db.collection('students').doc(roll).get();
            if (!doc.exists) {
                errEl.textContent = 'Roll number not found. Please register first.';
                Utils.hideLoader();
                return;
            }

            const student = doc.data();
            const hash = await Utils.hashPassword(pass);
            if (hash !== student.passwordHash) {
                errEl.textContent = 'Incorrect password';
                Utils.hideLoader();
                return;
            }

            this.currentStudent = { name: student.name, rollNumber: student.rollNumber };
            sessionStorage.setItem('abhyas_student', JSON.stringify(this.currentStudent));
            document.getElementById('studentName').textContent = student.name;
            
            // clear forms
            document.getElementById('loginRoll').value = '';
            document.getElementById('loginPass').value = '';
            
            document.getElementById('login-view').classList.remove('active');
            document.getElementById('app-shell').style.display = '';
            this.showView('dashboard-view');
        } catch(err) {
            console.error(err);
            errEl.textContent = 'Login failed. Please try again.';
        }
        Utils.hideLoader();
    },

    async register() {
        const name = document.getElementById('regName').value.trim();
        const roll = document.getElementById('regRoll').value.trim();
        const pass = document.getElementById('regPass').value;
        const passConfirm = document.getElementById('regPassConfirm').value;
        const errEl = document.getElementById('regError');

        if (!name || !roll || !pass) {
            errEl.textContent = 'Please fill all fields';
            return;
        }
        if (pass !== passConfirm) {
            errEl.textContent = 'Passwords do not match';
            return;
        }
        if (pass.length < 4) {
            errEl.textContent = 'Password must be at least 4 characters';
            return;
        }

        Utils.showLoader();
        errEl.textContent = '';
        try {
            // Check if roll number already exists
            const existing = await db.collection('students').doc(roll).get();
            if (existing.exists) {
                errEl.textContent = 'This roll number is already registered';
                Utils.hideLoader();
                return;
            }

            const hash = await Utils.hashPassword(pass);
            await db.collection('students').doc(roll).set({
                name: name,
                rollNumber: roll,
                passwordHash: hash,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            Utils.showToast('Registration successful! Please login.', 'success');
            
            // Clear register form
            document.getElementById('regName').value = '';
            document.getElementById('regRoll').value = '';
            document.getElementById('regPass').value = '';
            document.getElementById('regPassConfirm').value = '';
            
            // Switch to login tab
            document.querySelector('.tab-btn[data-tab="loginTab"]').click();
        } catch(err) {
            console.error(err);
            errEl.textContent = 'Registration failed. Please try again.';
        }
        Utils.hideLoader();
    },

    logout() {
        sessionStorage.removeItem('abhyas_student');
        this.currentStudent = null;
        document.getElementById('app-shell').style.display = 'none';
        document.getElementById('login-view').classList.add('active');
        // Clear forms
        document.getElementById('loginRoll').value = '';
        document.getElementById('loginPass').value = '';
    },

    // ── NAVIGATION ──
    showView(viewId) {
        document.querySelectorAll('#app-shell .view').forEach(v => v.classList.remove('active'));
        const view = document.getElementById(viewId);
        if (view) view.classList.add('active');
        
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.dataset.view === viewId);
        });
        window.scrollTo({top: 0, behavior: 'smooth'});
        
        if (viewId === 'dashboard-view') this.loadDashboard();
        if (viewId === 'results-view') this.loadResults();
    },

    // ── DASHBOARD ──
    async loadDashboard() {
        Utils.showLoader();
        try {
            // Load all live quizzes
            const quizSnap = await db.collection('quizzes').where('status', '==', 'live').get();
            const quizzes = quizSnap.docs.map(d => ({id: d.id, ...d.data()}));

            // Load student's submissions
            const subSnap = await db.collection('submissions')
                .where('rollNumber', '==', this.currentStudent.rollNumber).get();
            const submissions = subSnap.docs.map(d => ({id: d.id, ...d.data()}));
            const submittedQuizIds = new Set(submissions.map(s => s.quizId));

            // AVAILABLE QUIZZES: live quizzes not yet attempted
            const available = quizzes.filter(q => !submittedQuizIds.has(q.id));

            if (available.length === 0) {
                document.getElementById('availableQuizzes').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <p class="empty-title">No quizzes available</p>
                        <p class="empty-desc">Check back later for new quizzes</p>
                    </div>`;
            } else {
                let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px">';
                available.forEach(q => {
                    html += `<div class="card">
                        <h3>${Utils.escapeHtml(q.title)}</h3>
                        <p class="text-muted text-sm mb-2">${Utils.escapeHtml(q.subject || '')}</p>
                        ${q.description ? `<p class="text-sm mb-2 text-muted">${Utils.escapeHtml(q.description)}</p>` : ''}
                        <div class="flex gap-3 mb-3 text-sm text-muted">
                            <span>📝 ${q.questionsCount} questions</span>
                            <span>📊 ${q.totalMarks} marks</span>
                            <span>⏱ ${q.timeLimit > 0 ? q.timeLimit + ' min' : 'No limit'}</span>
                        </div>
                        <button class="btn btn-primary w-full" onclick="Student.startQuiz('${q.id}')">Start Quiz</button>
                    </div>`;
                });
                html += '</div>';
                document.getElementById('availableQuizzes').innerHTML = html;
            }

            // MY ATTEMPTS
            if (submissions.length === 0) {
                document.getElementById('myAttempts').innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">📋</div>
                        <p class="empty-title">No attempts yet</p>
                        <p class="empty-desc">Start a quiz above!</p>
                    </div>`;
            } else {
                let html = '<div class="table-container"><table class="table"><thead><tr><th>Quiz</th><th>Subject</th><th>Status</th><th>Marks</th><th>Date</th></tr></thead><tbody>';
                submissions.forEach(s => {
                    const pct = Utils.percentage(s.obtainedMarks || 0, s.totalMarks);
                    const g = Utils.getGrade(pct);
                    const marksDisplay = s.status === 'released' ? `${s.obtainedMarks}/${s.totalMarks} (${g.grade})` : '—';
                    const displayStatus = s.status === 'auto-graded' ? 'Submitted' : (s.status === 'evaluated' ? 'Evaluated' : s.status);
                    
                    html += `<tr>
                        <td>${Utils.escapeHtml(s.quizTitle)}</td>
                        <td>${Utils.escapeHtml(s.subject || '')}</td>
                        <td><span class="badge ${Utils.statusBadge(s.status)}">${displayStatus}</span></td>
                        <td>${marksDisplay}</td>
                        <td>${Utils.formatDateShort(s.submittedAt)}</td>
                    </tr>`;
                });
                html += '</tbody></table></div>';
                document.getElementById('myAttempts').innerHTML = html;
            }
        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to load dashboard', 'error');
        }
        Utils.hideLoader();
    },

    // ── QUIZ TAKING ──
    async startQuiz(quizId) {
        const confirmed = await Utils.confirmAction('Ready to start the quiz? Make sure you have enough time.');
        if (!confirmed) return;

        Utils.showLoader();
        try {
            const doc = await db.collection('quizzes').doc(quizId).get();
            if (!doc.exists) {
                Utils.showToast('Quiz not found', 'error');
                Utils.hideLoader();
                return;
            }

            this.currentQuizData = { id: doc.id, ...doc.data() };

            // Check if already submitted
            const subId = `${quizId}_${this.currentStudent.rollNumber}`;
            const existingSub = await db.collection('submissions').doc(subId).get();
            if (existingSub.exists) {
                Utils.showToast('You have already attempted this quiz', 'error');
                Utils.hideLoader();
                return;
            }

            // Prepare quiz
            let questions = [...this.currentQuizData.questions];
            if (this.currentQuizData.shuffleQuestions) {
                questions = Utils.shuffleArray(questions);
            }
            this.currentQuizData.questions = questions;

            // Reset state
            this.answers = {};
            this.tabSwitches = 0;
            this.quizStartTime = Date.now();

            // Setup timer
            const timerEl = document.getElementById('quizTimer');
            if (this.currentQuizData.timeLimit > 0) {
                this.timeRemaining = this.currentQuizData.timeLimit * 60;
                timerEl.style.display = 'block';
                this.startTimer();
            } else {
                timerEl.style.display = 'none';
            }

            // Setup tab switch detection
            this.setupTabDetection();

            // Switch to quiz view
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('quiz-view').classList.add('active');

            // Hide navbar links during quiz
            document.getElementById('mainNav').style.display = 'none';

            // Render quiz
            this.renderQuiz();
        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to start quiz', 'error');
        }
        Utils.hideLoader();
    },

    renderQuiz() {
        const quiz = this.currentQuizData;
        document.getElementById('quizViewTitle').textContent = quiz.title;
        document.getElementById('quizViewMeta').textContent = `${quiz.subject || ''} • ${quiz.questionsCount} questions • ${quiz.totalMarks} marks`;

        let html = '';
        quiz.questions.forEach((q, i) => {
            html += `<div class="question-card" id="question-${i}">`;
            html += `<div class="question-header">
                <div class="question-number">${i + 1}</div>
                <div class="question-content">
                    <div class="question-text">${Utils.escapeHtml(q.text)}</div>
                    <div class="question-meta">
                        <span class="badge badge-${q.type}">${Utils.typeLabel(q.type)}</span>
                        <span class="question-marks">${q.marks} marks</span>
                    </div>
                </div>
            </div>`;

            if (q.type === 'mcq') {
                html += '<div class="options-list">';
                ['a', 'b', 'c', 'd'].forEach(key => {
                    if (q.options && q.options[key]) {
                        html += `<label class="option-label" data-question="${q.id}" data-option="${key}" onclick="Student.selectOption('${q.id}', '${key}', this)">
                            <input type="radio" name="q_${q.id}" value="${key}">
                            <span class="option-radio"></span>
                            <span class="option-key">${key.toUpperCase()}.</span>
                            <span class="option-text">${Utils.escapeHtml(q.options[key])}</span>
                        </label>`;
                    }
                });
                html += '</div>';
            } else if (q.type === 'oneword') {
                html += `<input class="answer-input" type="text" data-question="${q.id}" 
                         placeholder="Type your answer" 
                         oninput="Student.saveTextAnswer('${q.id}', this.value)">`;
            } else if (q.type === 'short') {
                html += `<textarea class="answer-textarea" rows="4" data-question="${q.id}" 
                         placeholder="Write your answer here..." 
                         oninput="Student.saveTextAnswer('${q.id}', this.value)"></textarea>`;
            } else if (q.type === 'long') {
                html += `<textarea class="answer-textarea" rows="8" data-question="${q.id}" 
                         placeholder="Write your detailed answer here..." 
                         oninput="Student.saveTextAnswer('${q.id}', this.value)"></textarea>`;
            }

            html += '</div>';
        });

        document.getElementById('quizBody').innerHTML = html;

        // Render question navigator dots
        let navHtml = '';
        quiz.questions.forEach((q, i) => {
            navHtml += `<div class="q-nav-dot" data-index="${i}" onclick="Student.scrollToQuestion(${i})">${i + 1}</div>`;
        });
        document.getElementById('questionNav').innerHTML = navHtml;

        // Update progress
        this.updateProgress();
    },

    selectOption(questionId, optionKey, element) {
        // Remove selected class from siblings
        const parent = element.closest('.options-list');
        parent.querySelectorAll('.option-label').forEach(l => l.classList.remove('selected'));
        element.classList.add('selected');
        
        const radio = element.querySelector('input[type="radio"]');
        if(radio) radio.checked = true;
        
        this.answers[questionId] = optionKey;
        this.updateProgress();
    },

    saveTextAnswer(questionId, value) {
        this.answers[questionId] = value;
        this.updateProgress();
    },

    scrollToQuestion(index) {
        const el = document.getElementById(`question-${index}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    updateProgress() {
        const total = this.currentQuizData.questions.length;
        const answered = Object.keys(this.answers).filter(k => {
            const val = this.answers[k];
            return val !== undefined && val !== null && val.toString().trim() !== '';
        }).length;
        
        const pct = total > 0 ? (answered / total) * 100 : 0;
        document.getElementById('quizProgressBar').style.width = pct + '%';

        // Update nav dots
        const dots = document.querySelectorAll('.q-nav-dot');
        this.currentQuizData.questions.forEach((q, i) => {
            if (dots[i]) {
                const hasAnswer = !!(this.answers[q.id] && this.answers[q.id].toString().trim() !== '');
                dots[i].classList.toggle('answered', hasAnswer);
            }
        });
    },

    // ── TIMER ──
    startTimer() {
        if(this.timerInterval) clearInterval(this.timerInterval);
        
        const timerEl = document.getElementById('quizTimer');
        timerEl.classList.remove('warning');
        
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            timerEl.textContent = Utils.formatTimer(this.timeRemaining);

            if (this.timeRemaining <= 60 && this.timeRemaining > 0) {
                timerEl.classList.add('warning');
            }

            if (this.timeRemaining <= 0) {
                clearInterval(this.timerInterval);
                Utils.showToast('Time is up! Auto-submitting...', 'warning');
                this.submitQuiz(true); // auto-submit
            }
        }, 1000);
        timerEl.textContent = Utils.formatTimer(this.timeRemaining);
    },

    // ── TAB SWITCH DETECTION ──
    setupTabDetection() {
        const warning = document.getElementById('tabWarning');
        warning.classList.add('hidden');
        warning.style.display = 'none';
        
        this._visibilityHandler = () => {
            if (document.hidden) {
                this.tabSwitches++;
            } else if (this.tabSwitches > 0) {
                warning.classList.remove('hidden');
                warning.style.display = 'block';
                warning.textContent = `⚠ Tab switch detected (${this.tabSwitches} time${this.tabSwitches > 1 ? 's' : ''})! Your activity is being monitored.`;
                Utils.showToast(`Tab switch #${this.tabSwitches} detected!`, 'warning');
            }
        };
        document.addEventListener('visibilitychange', this._visibilityHandler);
    },

    // ── SUBMIT QUIZ ──
    async submitQuiz(autoSubmit = false) {
        if (!autoSubmit) {
            const unanswered = this.currentQuizData.questions.filter(q => {
                const ans = this.answers[q.id];
                return !ans || ans.toString().trim() === '';
            }).length;

            let msg = 'Submit your quiz?';
            if (unanswered > 0) {
                msg = `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`;
            }
            const confirmed = await Utils.confirmAction(msg);
            if (!confirmed) return;
        }

        // Stop timer
        if (this.timerInterval) clearInterval(this.timerInterval);
        
        // Remove tab detection
        if (this._visibilityHandler) {
            document.removeEventListener('visibilitychange', this._visibilityHandler);
            this._visibilityHandler = null;
        }

        Utils.showLoader();
        try {
            const quiz = this.currentQuizData;
            const timeSpent = Math.round((Date.now() - this.quizStartTime) / 1000);

            let autoGradedMarks = 0;
            let hasSubjective = false;

            const answersArray = quiz.questions.map(q => {
                const studentAnswer = this.answers[q.id] || '';
                let isCorrect = null;
                let marksAwarded = 0;

                if (q.type === 'mcq') {
                    isCorrect = studentAnswer.toLowerCase() === (q.correctAnswer || '').toLowerCase();
                    marksAwarded = isCorrect ? q.marks : 0;
                    autoGradedMarks += marksAwarded;
                } else if (q.type === 'oneword') {
                    isCorrect = studentAnswer.toString().trim().toLowerCase() === (q.correctAnswer || '').toString().trim().toLowerCase();
                    marksAwarded = isCorrect ? q.marks : 0;
                    autoGradedMarks += marksAwarded;
                } else {
                    // short or long — needs manual grading
                    hasSubjective = true;
                    isCorrect = null;
                    marksAwarded = 0;
                }

                return {
                    questionId: q.id,
                    questionText: q.text,
                    type: q.type,
                    studentAnswer: studentAnswer.toString(),
                    correctAnswer: q.correctAnswer || '',
                    referenceAnswer: q.referenceAnswer || '',
                    options: q.options || null,
                    isCorrect: isCorrect,
                    marksAwarded: marksAwarded,
                    maxMarks: q.marks,
                    feedback: ''
                };
            });

            const status = 'auto-graded';

            const submissionId = `${quiz.id}_${this.currentStudent.rollNumber}`;
            const submissionData = {
                quizId: quiz.id,
                quizTitle: quiz.title,
                subject: quiz.subject || '',
                studentName: this.currentStudent.name,
                rollNumber: this.currentStudent.rollNumber,
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                timeSpent: timeSpent,
                tabSwitches: this.tabSwitches,
                status: status,
                totalMarks: quiz.totalMarks,
                obtainedMarks: autoGradedMarks, // Starts with autoGraded, updated later if subjective
                autoGradedMarks: autoGradedMarks,
                manualGradedMarks: 0,
                hasSubjective: hasSubjective,
                answers: answersArray
            };

            await db.collection('submissions').doc(submissionId).set(submissionData);

            Utils.showToast('Quiz submitted successfully!', 'success');

            // Restore navbar
            document.getElementById('mainNav').style.display = 'flex';
            
            // Clean up and go back to dashboard
            this.currentQuizData = null;
            this.answers = {};
            this.showView('dashboard-view');
        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to submit quiz. Please try again.', 'error');
            // If failed auto-submit, maybe restart timer? Or just stay loading. We just hide loader and let them retry.
        }
        Utils.hideLoader();
    },

    // ── RESULTS ──
    async loadResults() {
        Utils.showLoader();
        try {
            const snap = await db.collection('submissions')
                .where('rollNumber', '==', this.currentStudent.rollNumber)
                .get();
            const submissions = snap.docs.map(d => ({id: d.id, ...d.data()}));

            const released = submissions.filter(s => s.status === 'released');
            const pending = submissions.filter(s => s.status !== 'released');

            let html = '';

            if (released.length === 0 && pending.length === 0) {
                html = '<div class="empty-state"><div class="empty-icon">📋</div><p class="empty-title">No results yet</p><p class="empty-desc">Attempt a quiz first!</p></div>';
            } else {
                if (released.length > 0) {
                    html += '<h3 class="mb-2" style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">Released Results</h3>';
                    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:32px">';
                    released.forEach(s => {
                        const pct = Utils.percentage(s.obtainedMarks || 0, s.totalMarks);
                        const g = Utils.getGrade(pct);
                        html += `<div class="card" style="cursor:pointer;border-left:4px solid ${g.color}; padding: 20px; transition: transform 0.2s;" onclick="Student.viewResultDetail('${s.id}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                            <h4 style="margin-bottom: 4px; font-size: 1.1rem;">${Utils.escapeHtml(s.quizTitle)}</h4>
                            <p class="text-sm text-muted mb-2">${Utils.escapeHtml(s.subject || '')}</p>
                            <div style="font-size:2rem;font-weight:700;color:${g.color}; margin: 8px 0;">${g.grade}</div>
                            <div class="text-sm" style="font-weight: 500;">${s.obtainedMarks}/${s.totalMarks} (${pct}%)</div>
                            <div class="text-sm text-muted mt-1">Submitted: ${Utils.formatDateShort(s.submittedAt)}</div>
                        </div>`;
                    });
                    html += '</div>';
                }

                if (pending.length > 0) {
                    html += '<h3 class="mb-2" style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">Pending Results</h3>';
                    html += '<div class="alert alert-info" style="margin-bottom: 16px;">These quizzes are awaiting evaluation or result release by your teacher.</div>';
                    html += '<div class="table-container"><table class="table"><thead><tr><th>Quiz</th><th>Subject</th><th>Status</th><th>Date</th></tr></thead><tbody>';
                    pending.forEach(s => {
                        html += `<tr>
                            <td>${Utils.escapeHtml(s.quizTitle)}</td>
                            <td>${Utils.escapeHtml(s.subject || '')}</td>
                            <td><span class="badge ${Utils.statusBadge(s.status)}">${s.status === 'auto-graded' ? 'Awaiting Evaluation' : s.status === 'evaluated' ? 'Evaluated (not released)' : s.status}</span></td>
                            <td>${Utils.formatDateShort(s.submittedAt)}</td>
                        </tr>`;
                    });
                    html += '</tbody></table></div>';
                }
            }

            document.getElementById('resultsContent').innerHTML = html;
        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to load results', 'error');
        }
        Utils.hideLoader();
    },

    async viewResultDetail(submissionId) {
        Utils.showLoader();
        try {
            const doc = await db.collection('submissions').doc(submissionId).get();
            const sub = { id: doc.id, ...doc.data() };

            if (sub.status !== 'released') {
                Utils.showToast('Results not yet released', 'error');
                Utils.hideLoader();
                return;
            }

            const pct = Utils.percentage(sub.obtainedMarks || 0, sub.totalMarks);
            const g = Utils.getGrade(pct);

            let html = '';
            // Summary card
            html += `<div class="card mb-4">
                <h2 style="margin-bottom: 8px;">${Utils.escapeHtml(sub.quizTitle)}</h2>
                <p class="text-muted mb-4">${Utils.escapeHtml(sub.subject || '')}</p>
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-info"><div class="stat-number">${sub.obtainedMarks}/${sub.totalMarks}</div><div class="stat-label">Marks</div></div></div>
                    <div class="stat-card stat-success"><div class="stat-icon">📈</div><div class="stat-info"><div class="stat-number">${pct}%</div><div class="stat-label">Percentage</div></div></div>
                    <div class="stat-card" style="border-left-color:${g.color}"><div class="stat-icon">🏆</div><div class="stat-info"><div class="stat-number" style="color:${g.color}">${g.grade}</div><div class="stat-label">${g.label}</div></div></div>
                    <div class="stat-card stat-info"><div class="stat-icon">⏱</div><div class="stat-info"><div class="stat-number">${Utils.formatTime(sub.timeSpent)}</div><div class="stat-label">Time Spent</div></div></div>
                </div>
            </div>`;

            // Questions with answers
            html += '<h3 class="mb-4" style="font-size: 1.25rem; font-weight: 600;">Detailed Answers</h3>';
            html += '<div style="display: flex; flex-direction: column; gap: 24px;">';
            sub.answers.forEach((ans, i) => {
                html += '<div class="question-card">';
                let numColor = ans.isCorrect === true ? 'var(--success)' : (ans.isCorrect === false ? 'var(--error)' : 'var(--warning)');
                
                html += `<div class="question-header">
                    <div class="question-number" style="background:${numColor}; color: white;">${i + 1}</div>
                    <div class="question-content">
                        <div class="question-text">${Utils.escapeHtml(ans.questionText)}</div>
                        <div class="question-meta">
                            <span class="badge badge-${ans.type}">${Utils.typeLabel(ans.type)}</span>
                            <span class="question-marks">${ans.marksAwarded}/${ans.maxMarks} marks</span>
                        </div>
                    </div>
                </div>`;

                if (ans.type === 'mcq') {
                    html += '<div class="options-list">';
                    if (ans.options) {
                        ['a','b','c','d'].forEach(key => {
                            if (!ans.options[key]) return;
                            const isStudentAnswer = ans.studentAnswer === key;
                            const isCorrectOption = ans.correctAnswer === key;
                            let cls = '';
                            if (isCorrectOption) cls = 'correct';
                            else if (isStudentAnswer && !ans.isCorrect) cls = 'incorrect';
                            
                            html += `<div class="option-label ${cls}" style="cursor:default">
                                <span class="option-key">${key.toUpperCase()}.</span>
                                <span class="option-text">${Utils.escapeHtml(ans.options[key])}</span>
                                ${isCorrectOption ? '<span class="badge badge-success" style="margin-left:auto">✓ Correct</span>' : ''}
                                ${isStudentAnswer && !isCorrectOption ? '<span class="badge badge-error" style="margin-left:auto">Your answer</span>' : ''}
                            </div>`;
                        });
                    }
                    html += '</div>';
                } else if (ans.type === 'oneword') {
                    html += `<div class="eval-student-answer"><strong>Your Answer:</strong> ${Utils.escapeHtml(ans.studentAnswer || 'No answer')}</div>`;
                    html += `<div class="eval-auto-result ${ans.isCorrect ? 'correct' : 'incorrect'}"><span>${ans.isCorrect ? '✓ Correct' : '✕ Incorrect'}</span><span>Correct Answer: <strong>${Utils.escapeHtml(ans.correctAnswer)}</strong></span></div>`;
                } else {
                    // Short/Long answer
                    html += `<div class="eval-student-answer"><strong>Your Answer:</strong><br>${Utils.escapeHtml(ans.studentAnswer || 'No answer')}</div>`;
                    if (ans.feedback) {
                        html += `<div class="alert alert-info" style="margin-top: 12px; margin-bottom: 0;"><strong>Teacher's Feedback:</strong> ${Utils.escapeHtml(ans.feedback)}</div>`;
                    }
                }

                html += '</div>';
            });
            html += '</div>';

            document.getElementById('resultDetailContent').innerHTML = html;

            // Switch to detail view
            document.querySelectorAll('#app-shell .view').forEach(v => v.classList.remove('active'));
            document.getElementById('result-detail-view').classList.add('active');
            window.scrollTo({top: 0, behavior: 'smooth'});
        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to load result details', 'error');
        }
        Utils.hideLoader();
    },

    // ── EVENT LISTENERS ──
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.dataset.tab;
                
                // Update buttons
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update content
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(target).classList.add('active');
            });
        });

        // Auth
        document.getElementById('loginBtn')?.addEventListener('click', () => this.login());
        document.getElementById('registerBtn')?.addEventListener('click', () => this.register());
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // Nav Links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showView(e.target.dataset.view);
            });
        });

        // Submissions & Quizzes
        document.getElementById('submitQuizBtn')?.addEventListener('click', () => this.submitQuiz(false));
        document.getElementById('resultBackBtn')?.addEventListener('click', () => this.showView('results-view'));

        // Enter key for login/register
        const triggerClickOnEnter = (inputId, btnId) => {
            document.getElementById(inputId)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') document.getElementById(btnId).click();
            });
        };
        
        triggerClickOnEnter('loginRoll', 'loginBtn');
        triggerClickOnEnter('loginPass', 'loginBtn');
        
        triggerClickOnEnter('regName', 'registerBtn');
        triggerClickOnEnter('regRoll', 'registerBtn');
        triggerClickOnEnter('regPass', 'registerBtn');
        triggerClickOnEnter('regPassConfirm', 'registerBtn');
    }
};

document.addEventListener('DOMContentLoaded', () => Student.init());

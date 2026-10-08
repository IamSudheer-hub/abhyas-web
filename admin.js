const Admin = {
    currentUser: null,
    quizzes: [],
    questions: [],       
    allSubmissions: [],
    currentFilter: 'all',
    editingQuizId: null,

    // ── INITIALIZATION ──
    init() {
        this.setupAuth();
        this.setupEventListeners();
    },

    // ── AUTH ──
    setupAuth() {
        auth.onAuthStateChanged(user => {
            Utils.hideLoader();
            if (user) {
                this.currentUser = user;
                document.getElementById('userEmail').textContent = user.email;
                document.getElementById('login-view').classList.remove('active');
                document.getElementById('app-shell').style.display = '';
                this.loadDashboard();
            } else {
                this.currentUser = null;
                document.getElementById('app-shell').style.display = 'none';
                document.getElementById('login-view').classList.add('active');
            }
        });
    },

    async login(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const pass = document.getElementById('loginPassword').value;
        const errDiv = document.getElementById('loginError');
        errDiv.textContent = '';
        Utils.showLoader();
        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } catch (err) {
            errDiv.textContent = err.message;
        }
        Utils.hideLoader();
    },

    async logout() {
        await auth.signOut();
    },

    // ── NAVIGATION ──
    showView(viewId) {
        document.querySelectorAll('#app-shell .view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId)?.classList.add('active');
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.dataset.view === viewId);
        });
        window.scrollTo({top: 0, behavior: 'smooth'});
        
        if (viewId === 'dashboard-view') this.loadDashboard();
        if (viewId === 'quizzes-view') this.loadQuizzes();
        if (viewId === 'evaluate-view') this.loadEvaluate();
        if (viewId === 'analytics-view') this.loadAnalytics();
        if (viewId === 'create-view') this.resetCreateForm();
    },

    // ── EVENT LISTENERS ──
    setupEventListeners() {
        document.getElementById('loginForm').addEventListener('submit', (e) => this.login(e));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        document.querySelectorAll('.nav-link').forEach(l => {
            l.addEventListener('click', (e) => {
                this.showView(e.target.dataset.view);
            });
        });

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
                e.target.classList.add('active');
                document.getElementById(e.target.dataset.tab).style.display = 'block';
            });
        });
        document.getElementById('manual-tab').style.display = 'none';

        // Manual Question Type Change
        document.getElementById('manualType').addEventListener('change', (e) => {
            const type = e.target.value;
            const mcqOpts = document.getElementById('mcqOptions');
            const corrGrp = document.getElementById('correctAnswerGroup');
            const hint = document.getElementById('correctHint');
            
            if (type === 'mcq') {
                mcqOpts.style.display = 'block';
                corrGrp.style.display = 'block';
                hint.textContent = 'Enter A, B, C, or D';
            } else if (type === 'oneword') {
                mcqOpts.style.display = 'none';
                corrGrp.style.display = 'block';
                hint.textContent = 'Enter the correct word/phrase';
            } else {
                mcqOpts.style.display = 'none';
                corrGrp.style.display = 'none';
            }
        });

        // File upload
        const uploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('excelFile');
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--primary)';
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.style.borderColor = 'var(--border)';
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--border)';
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                this.parseExcel(e.dataTransfer.files[0]);
            }
        });
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length) this.parseExcel(e.target.files[0]);
        });

        document.getElementById('downloadTemplateBtn').addEventListener('click', () => this.downloadTemplate());
        document.getElementById('addQuestionBtn').addEventListener('click', () => this.addManualQuestion());

        document.getElementById('saveDraftBtn').addEventListener('click', () => this.saveQuiz('draft'));
        document.getElementById('saveLiveBtn').addEventListener('click', () => this.saveQuiz('live'));

        document.querySelectorAll('.filter-pill').forEach(pill => {
            pill.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderQuizzes();
            });
        });

        document.getElementById('evalQuizSelect').addEventListener('change', (e) => this.loadSubmissionsForQuiz(e.target.value));
        document.getElementById('evalBackBtn').addEventListener('click', () => {
            document.getElementById('evalStep2').style.display = 'none';
            document.getElementById('evalStep1').style.display = 'block';
        });

        document.getElementById('analyticsQuizSelect').addEventListener('change', (e) => this.showAnalytics(e.target.value));
    },

    // ── DASHBOARD ──
    async loadDashboard() {
        Utils.showLoader();
        try {
            const quizSnap = await db.collection('quizzes').orderBy('createdAt', 'desc').get();
            this.quizzes = quizSnap.docs.map(d => ({id: d.id, ...d.data()}));

            const subSnap = await db.collection('submissions').get();
            this.allSubmissions = subSnap.docs.map(d => ({id: d.id, ...d.data()}));

            const totalQuizzes = this.quizzes.length;
            const liveQuizzes = this.quizzes.filter(q => q.status === 'live').length;
            const pendingEvals = this.allSubmissions.filter(s => s.hasSubjective && s.status === 'auto-graded').length;
            const uniqueStudents = new Set(this.allSubmissions.map(s => s.rollNumber)).size;

            document.getElementById('dashboardStats').innerHTML = `
                <div class="stat-card stat-info"><div class="stat-icon">📝</div><div class="stat-info"><div class="stat-number">${totalQuizzes}</div><div class="stat-label">Total Quizzes</div></div></div>
                <div class="stat-card stat-success"><div class="stat-icon">🟢</div><div class="stat-info"><div class="stat-number">${liveQuizzes}</div><div class="stat-label">Live Quizzes</div></div></div>
                <div class="stat-card stat-warning"><div class="stat-icon">⏳</div><div class="stat-info"><div class="stat-number">${pendingEvals}</div><div class="stat-label">Pending Evaluations</div></div></div>
                <div class="stat-card stat-error"><div class="stat-icon">🎓</div><div class="stat-info"><div class="stat-number">${uniqueStudents}</div><div class="stat-label">Total Students</div></div></div>
            `;

            const recent = this.quizzes.slice(0, 5);
            let recentHtml = '<div class="table-container"><table class="table"><thead><tr><th>Title</th><th>Subject</th><th>Questions</th><th>Status</th></tr></thead><tbody>';
            if(recent.length === 0) {
                recentHtml += '<tr><td colspan="4" style="text-align:center">No quizzes found</td></tr>';
            } else {
                recent.forEach(q => {
                    recentHtml += `<tr>
                        <td>${Utils.escapeHtml(q.title)}</td>
                        <td>${Utils.escapeHtml(q.subject)}</td>
                        <td>${q.questionsCount}</td>
                        <td><span class="badge ${Utils.statusBadge(q.status)}">${q.status}</span></td>
                    </tr>`;
                });
            }
            recentHtml += '</tbody></table></div>';
            document.getElementById('recentQuizzes').innerHTML = recentHtml;
        } catch (err) {
            console.error(err);
            Utils.showToast('Failed to load dashboard', 'error');
        }
        Utils.hideLoader();
    },

    // ── CREATE QUIZ ──
    resetCreateForm() {
        this.editingQuizId = null;
        this.questions = [];
        document.getElementById('quizForm').reset();
        this.renderQuestionsPreview();
        const header = document.querySelector('#create-view h2');
        if (header) header.textContent = 'Create New Quiz';
    },

    editQuiz(quizId) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        if (!quiz) return;
        
        this.editingQuizId = quizId;
        this.questions = [...quiz.questions];
        
        document.getElementById('quizTitle').value = quiz.title || '';
        document.getElementById('quizSubject').value = quiz.subject || '';
        document.getElementById('quizDesc').value = quiz.description || '';
        document.getElementById('quizTime').value = quiz.timeLimit || 0;
        document.getElementById('quizShuffle').checked = !!quiz.shuffleQuestions;
        
        this.renderQuestionsPreview();
        
        // Change view title
        const header = document.querySelector('#create-view h2');
        if (header) header.textContent = 'Edit Quiz';
        
        // Show create view without calling resetCreateForm
        document.querySelectorAll('#app-shell .view').forEach(v => v.classList.remove('active'));
        document.getElementById('create-view').classList.add('active');
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.toggle('active', l.dataset.view === 'create-view');
        });
        window.scrollTo({top: 0, behavior: 'smooth'});
    },

    parseExcel(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, {type: 'binary'});
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
                
                rows.forEach((row, i) => {
                    const getCol = (names) => {
                        for(let name of names) {
                            if(row[name] !== undefined) return row[name];
                        }
                        return "";
                    };
                    const text = getCol(['Question', 'question', 'QUESTION', 'Question Text']).toString().trim();
                    let type = getCol(['Type', 'type', 'TYPE']).toString().toLowerCase().trim();
                    if(type === 'one word') type = 'oneword';
                    if(type === 'short answer') type = 'short';
                    if(type === 'long answer') type = 'long';
                    if(!['mcq', 'oneword', 'short', 'long'].includes(type)) return; // skip invalid type
                    
                    if(!text) return;

                    const marks = parseInt(getCol(['Marks', 'marks', 'MARKS'])) || 5;
                    
                    let qObj = {
                        id: Utils.generateId(),
                        text: text,
                        type: type,
                        marks: marks
                    };

                    if (type === 'mcq') {
                        qObj.options = {
                            a: getCol(['Option A', 'option a']).toString().trim(),
                            b: getCol(['Option B', 'option b']).toString().trim(),
                            c: getCol(['Option C', 'option c']).toString().trim(),
                            d: getCol(['Option D', 'option d']).toString().trim()
                        };
                        qObj.correctAnswer = getCol(['Correct Answer', 'correct answer', 'Correct']).toString().toLowerCase().trim();
                    } else if (type === 'oneword') {
                        qObj.correctAnswer = getCol(['Correct Answer', 'correct answer', 'Correct']).toString().trim();
                    }

                    if (type === 'short' || type === 'long') {
                        qObj.referenceAnswer = getCol(['Reference Answer', 'reference answer', 'Reference']).toString().trim();
                    }

                    this.questions.push(qObj);
                });
                Utils.showToast(`Imported ${this.questions.length} questions`, 'success');
                this.renderQuestionsPreview();
            } catch(err) {
                Utils.showToast('Failed to parse Excel file: ' + err.message, 'error');
            }
        };
        reader.readAsBinaryString(file);
    },

    downloadTemplate() {
        const data = [
            { 'Question': 'What is the capital of India?', 'Type': 'MCQ', 'Option A': 'Mumbai', 'Option B': 'New Delhi', 'Option C': 'Kolkata', 'Option D': 'Chennai', 'Correct Answer': 'B', 'Reference Answer': '', 'Marks': 5 },
            { 'Question': 'What is the chemical symbol for water?', 'Type': 'OneWord', 'Option A': '', 'Option B': '', 'Option C': '', 'Option D': '', 'Correct Answer': 'H2O', 'Reference Answer': '', 'Marks': 5 },
            { 'Question': 'Explain the process of photosynthesis', 'Type': 'Short', 'Option A': '', 'Option B': '', 'Option C': '', 'Option D': '', 'Correct Answer': '', 'Reference Answer': 'Photosynthesis is the process by which green plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar.', 'Marks': 10 },
            { 'Question': 'Discuss the causes and effects of World War II', 'Type': 'Long', 'Option A': '', 'Option B': '', 'Option C': '', 'Option D': '', 'Correct Answer': '', 'Reference Answer': 'World War II was caused by multiple factors including the Treaty of Versailles, rise of fascism, economic depression...', 'Marks': 20 }
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Questions');
        XLSX.writeFile(wb, 'abhyas_quiz_template.xlsx');
    },

    addManualQuestion() {
        const text = document.getElementById('manualQuestion').value.trim();
        const type = document.getElementById('manualType').value;
        const marks = parseInt(document.getElementById('manualMarks').value) || 5;
        
        if (!text) {
            Utils.showToast('Question text is required', 'error');
            return;
        }

        let qObj = {
            id: Utils.generateId(),
            text: text,
            type: type,
            marks: marks
        };

        if (type === 'mcq') {
            const optA = document.getElementById('optA').value.trim();
            const optB = document.getElementById('optB').value.trim();
            const optC = document.getElementById('optC').value.trim();
            const optD = document.getElementById('optD').value.trim();
            const corr = document.getElementById('manualCorrect').value.trim().toLowerCase();
            if (!optA || !optB || !optC || !optD) {
                Utils.showToast('All 4 options are required for MCQ', 'error');
                return;
            }
            if (!['a', 'b', 'c', 'd'].includes(corr)) {
                Utils.showToast('Correct answer must be A, B, C, or D', 'error');
                return;
            }
            qObj.options = { a: optA, b: optB, c: optC, d: optD };
            qObj.correctAnswer = corr;
        } else if (type === 'oneword') {
            const corr = document.getElementById('manualCorrect').value.trim();
            if (!corr) {
                Utils.showToast('Correct answer is required for One Word', 'error');
                return;
            }
            qObj.correctAnswer = corr;
        }

        if (type === 'short' || type === 'long') {
            qObj.referenceAnswer = document.getElementById('manualReference').value.trim();
        }

        this.questions.push(qObj);
        this.renderQuestionsPreview();
        
        // Clear manual form fields
        document.getElementById('manualQuestion').value = '';
        document.getElementById('optA').value = '';
        document.getElementById('optB').value = '';
        document.getElementById('optC').value = '';
        document.getElementById('optD').value = '';
        document.getElementById('manualCorrect').value = '';
        document.getElementById('manualReference').value = '';
    },

    removeQuestion(index) {
        this.questions.splice(index, 1);
        this.renderQuestionsPreview();
    },

    renderQuestionsPreview() {
        const container = document.getElementById('questionsPreview');
        if (this.questions.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No questions added yet.</div>';
            return;
        }
        
        let html = '<div class="table-container"><table class="table"><thead><tr><th>#</th><th>Question</th><th>Type</th><th>Marks</th><th>Action</th></tr></thead><tbody>';
        let totalMarks = 0;
        this.questions.forEach((q, i) => {
            totalMarks += q.marks;
            html += `<tr>
                <td>${i + 1}</td>
                <td>${Utils.truncate(Utils.escapeHtml(q.text), 60)}</td>
                <td><span class="badge badge-${q.type}">${Utils.typeLabel(q.type)}</span></td>
                <td>${q.marks}</td>
                <td><button type="button" class="btn btn-ghost btn-sm" onclick="Admin.removeQuestion(${i})">🗑️</button></td>
            </tr>`;
        });
        html += `<tr><td colspan="3" style="text-align:right"><strong>Total Marks:</strong></td><td colspan="2"><strong>${totalMarks}</strong></td></tr>`;
        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    async saveQuiz(status) {
        if (this.questions.length === 0) {
            Utils.showToast('Add at least one question', 'error');
            return;
        }
        const title = document.getElementById('quizTitle').value.trim();
        const subject = document.getElementById('quizSubject').value.trim();
        if(!title || !subject) {
            Utils.showToast('Title and subject are required', 'error');
            return;
        }
        
        Utils.showLoader();
        try {
            const quizData = {
                title: title,
                subject: subject,
                description: document.getElementById('quizDesc').value.trim(),
                timeLimit: parseInt(document.getElementById('quizTime').value) || 0,
                shuffleQuestions: document.getElementById('quizShuffle').checked,
                totalMarks: this.questions.reduce((sum, q) => sum + q.marks, 0),
                questionsCount: this.questions.length,
                questions: this.questions,
                status: status,
                createdBy: this.currentUser.uid,
                teacherEmail: this.currentUser.email
            };
            
            if (this.editingQuizId) {
                // Update existing
                await db.collection('quizzes').doc(this.editingQuizId).update({
                    ...quizData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                Utils.showToast(`Quiz updated as ${status}!`, 'success');
            } else {
                // Create new
                await db.collection('quizzes').add({
                    ...quizData,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                Utils.showToast(`Quiz saved as ${status}!`, 'success');
            }
            
            this.showView('quizzes-view');
        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to save quiz', 'error');
        }
        Utils.hideLoader();
    },

    // ── QUIZZES MANAGEMENT ──
    async loadQuizzes() {
        Utils.showLoader();
        try {
            const snap = await db.collection('quizzes').orderBy('createdAt', 'desc').get();
            this.quizzes = snap.docs.map(d => ({id: d.id, ...d.data()}));
            this.renderQuizzes();
        } catch(err) {
            Utils.showToast('Failed to load quizzes', 'error');
        }
        Utils.hideLoader();
    },

    renderQuizzes() {
        const filtered = this.currentFilter === 'all'
            ? this.quizzes
            : this.quizzes.filter(q => q.status === this.currentFilter);

        const container = document.getElementById('quizzesTable');
        if (filtered.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No quizzes found.</div>';
            return;
        }

        let html = '<div class="table-container"><table class="table"><thead><tr><th>Title</th><th>Subject</th><th>Questions</th><th>Total Marks</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
        filtered.forEach(q => {
            html += `<tr>
                <td>${Utils.escapeHtml(q.title)}</td>
                <td>${Utils.escapeHtml(q.subject)}</td>
                <td>${q.questionsCount}</td>
                <td>${q.totalMarks}</td>
                <td><span class="badge ${Utils.statusBadge(q.status)}">${q.status}</span></td>
                <td>${Utils.formatDateShort(q.createdAt)}</td>
                <td class="actions-cell">
                    <button class="btn btn-ghost btn-sm" onclick="Admin.viewQuiz('${q.id}')">👁️ View</button>
            `;
            if (q.status === 'draft') {
                html += `<button class="btn btn-ghost btn-sm" onclick="Admin.editQuiz('${q.id}')">✏️ Edit</button>`;
                html += `<button class="btn btn-ghost btn-sm" onclick="Admin.changeQuizStatus('${q.id}', 'live')">🚀 Go Live</button>`;
                html += `<button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="Admin.deleteQuiz('${q.id}')">🗑️</button>`;
            } else if (q.status === 'live') {
                html += `<button class="btn btn-ghost btn-sm" onclick="Admin.editQuiz('${q.id}')">✏️ Edit</button>`;
                html += `<button class="btn btn-ghost btn-sm" onclick="Admin.changeQuizStatus('${q.id}', 'completed')">🏁 Complete</button>`;
                html += `<button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="Admin.deleteQuiz('${q.id}')">🗑️</button>`;
            } else if (q.status === 'completed') {
                html += `<button class="btn btn-ghost btn-sm" style="color:var(--error)" onclick="Admin.deleteQuiz('${q.id}')">🗑️</button>`;
            }
            html += `</td></tr>`;
        });
        html += '</tbody></table></div>';
        container.innerHTML = html;
    },

    async changeQuizStatus(quizId, newStatus) {
        const confirmed = await Utils.confirmAction(`Change quiz status to ${newStatus}?`);
        if (!confirmed) return;
        Utils.showLoader();
        try {
            await db.collection('quizzes').doc(quizId).update({ status: newStatus });
            Utils.showToast(`Quiz is now ${newStatus}`, 'success');
            this.loadQuizzes();
        } catch(err) {
            Utils.showToast('Failed to update status', 'error');
        }
        Utils.hideLoader();
    },

    async deleteQuiz(quizId) {
        const confirmed = await Utils.confirmAction('Delete this quiz? This will also delete all submissions.');
        if (!confirmed) return;
        Utils.showLoader();
        try {
            const subs = await db.collection('submissions').where('quizId', '==', quizId).get();
            const batch = db.batch();
            subs.forEach(doc => batch.delete(doc.ref));
            batch.delete(db.collection('quizzes').doc(quizId));
            await batch.commit();
            Utils.showToast('Quiz deleted', 'success');
            this.loadQuizzes();
        } catch(err) {
            Utils.showToast('Failed to delete quiz', 'error');
        }
        Utils.hideLoader();
    },

    viewQuiz(quizId) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        if (!quiz) return;
        document.getElementById('viewQuizTitle').textContent = quiz.title;
        let html = '';
        quiz.questions.forEach((q, i) => {
            html += `<div style="margin-bottom:16px; padding:12px; border:1px solid var(--border); border-radius:var(--radius)">
                <div style="font-weight:600; margin-bottom:8px;">${i+1}. ${Utils.escapeHtml(q.text)} <span class="badge badge-${q.type}" style="margin-left:8px">${Utils.typeLabel(q.type)}</span> (${q.marks} marks)</div>
            `;
            if (q.type === 'mcq' && q.options) {
                html += `<div style="margin-bottom:8px">`;
                for (let k in q.options) {
                    const isCorrect = q.correctAnswer === k;
                    html += `<div style="${isCorrect ? 'color:var(--success-dark);font-weight:600;' : ''}">${k.toUpperCase()}: ${Utils.escapeHtml(q.options[k])} ${isCorrect ? '✓' : ''}</div>`;
                }
                html += `</div>`;
            } else if (q.type === 'oneword') {
                html += `<div style="margin-bottom:8px">Correct Answer: <strong>${Utils.escapeHtml(q.correctAnswer)}</strong></div>`;
            }
            if (q.referenceAnswer) {
                html += `<div style="color:var(--text-muted); font-size:13px">Reference: ${Utils.escapeHtml(q.referenceAnswer)}</div>`;
            }
            html += `</div>`;
        });
        document.getElementById('viewQuizBody').innerHTML = html;
        document.getElementById('viewQuizModal').classList.add('active');
    },

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    },

    // ── EVALUATE ──
    async loadEvaluate() {
        try {
            const snap = await db.collection('quizzes').orderBy('createdAt', 'desc').get();
            this.quizzes = snap.docs.map(d => ({id: d.id, ...d.data()}));
            const select = document.getElementById('evalQuizSelect');
            select.innerHTML = '<option value="">— Choose a quiz —</option>';
            this.quizzes.forEach(q => {
                select.innerHTML += `<option value="${q.id}">${q.title} (${q.subject})</option>`;
            });
        } catch(err) {
            Utils.showToast('Failed to load quizzes', 'error');
        }
        document.getElementById('evalStep1').style.display = 'block';
        document.getElementById('evalStep2').style.display = 'none';
        document.getElementById('evalSubmissionsList').innerHTML = '';
    },

    async loadSubmissionsForQuiz(quizId) {
        if (!quizId) {
            document.getElementById('evalSubmissionsList').innerHTML = '';
            return;
        }
        Utils.showLoader();
        try {
            const snap = await db.collection('submissions').where('quizId', '==', quizId).get();
            const submissions = snap.docs.map(d => ({id: d.id, ...d.data()}));

            if (submissions.length === 0) {
                document.getElementById('evalSubmissionsList').innerHTML = '<div class="alert alert-info">No submissions yet</div>';
                Utils.hideLoader();
                return;
            }

            const evaluatedCount = submissions.filter(s => s.status === 'evaluated').length;
            let html = '';
            
            if (evaluatedCount > 0) {
                html += `<div style="margin-bottom:16px"><button class="btn btn-success" onclick="Admin.releaseAllEvaluated('${quizId}')">Release All ${evaluatedCount} Evaluated Results</button></div>`;
            }

            html += '<div class="table-container"><table class="table"><thead><tr><th>Roll No.</th><th>Student Name</th><th>Status</th><th>Auto Marks</th><th>Manual Marks</th><th>Total</th><th>Actions</th></tr></thead><tbody>';
            submissions.forEach(s => {
                html += `<tr>
                    <td>${Utils.escapeHtml(s.rollNumber)}</td>
                    <td>${Utils.escapeHtml(s.studentName)}</td>
                    <td><span class="badge ${Utils.statusBadge(s.status)}">${s.status}</span></td>
                    <td>${s.autoGradedMarks || 0}</td>
                    <td>${s.manualGradedMarks || 0}</td>
                    <td>${s.obtainedMarks || 0} / ${s.totalMarks}</td>
                    <td>`;
                
                if (s.status === 'auto-graded' && s.hasSubjective) {
                    html += `<button class="btn btn-primary btn-sm" onclick="Admin.openEvaluation('${s.id}')">Evaluate</button>`;
                } else if (s.status === 'auto-graded' && !s.hasSubjective) {
                    html += `<button class="btn btn-success btn-sm" onclick="Admin.releaseSubmission('${s.id}')">Release</button>`;
                } else if (s.status === 'evaluated') {
                    html += `<button class="btn btn-secondary btn-sm" onclick="Admin.openEvaluation('${s.id}')">Re-evaluate</button> `;
                    html += `<button class="btn btn-success btn-sm" onclick="Admin.releaseSubmission('${s.id}')">Release</button>`;
                } else if (s.status === 'released') {
                    html += `<button class="btn btn-ghost btn-sm" onclick="Admin.openEvaluation('${s.id}')">View</button>`;
                }
                html += `</td></tr>`;
            });
            html += '</tbody></table></div>';
            document.getElementById('evalSubmissionsList').innerHTML = html;
        } catch(err) {
            Utils.showToast('Failed to load submissions', 'error');
        }
        Utils.hideLoader();
    },

    async openEvaluation(submissionId) {
        Utils.showLoader();
        try {
            const subDoc = await db.collection('submissions').doc(submissionId).get();
            const submission = { id: subDoc.id, ...subDoc.data() };

            document.getElementById('evalStep1').style.display = 'none';
            document.getElementById('evalStep2').style.display = 'block';

            let html = `<div style="margin-bottom:20px; font-size:16px;"><strong>${Utils.escapeHtml(submission.studentName)}</strong> (${Utils.escapeHtml(submission.rollNumber)})</div>`;
            
            submission.answers.forEach((ans, i) => {
                html += `<div style="border:1px solid var(--border); border-radius:var(--radius); padding:16px; margin-bottom:16px; background:var(--surface)">`;
                html += `<div style="display:flex; justify-content:space-between; margin-bottom:12px; font-weight:600">
                    <div>${i+1}. ${Utils.escapeHtml(ans.questionText)} <span class="badge badge-${ans.type}">${Utils.typeLabel(ans.type)}</span></div>
                    <div style="color:var(--text-muted)">${ans.maxMarks} marks</div>
                </div>`;

                if (ans.type === 'mcq' || ans.type === 'oneword') {
                    const icon = ans.isCorrect ? '✓' : '✕';
                    const cssClass = ans.isCorrect ? 'var(--success-dark)' : 'var(--error-dark)';
                    html += `<div style="background:var(--bg); padding:10px; border-radius:var(--radius); color:${cssClass}">
                        <span>${icon}</span>
                        <span style="margin-left:8px">Student: <strong>${Utils.escapeHtml(ans.studentAnswer || 'No answer')}</strong></span>
                        <span style="margin:0 8px">|</span>
                        <span>Correct: <strong>${Utils.escapeHtml(ans.correctAnswer)}</strong></span>
                        <span style="margin:0 8px">|</span>
                        <span><strong>${ans.marksAwarded}/${ans.maxMarks}</strong></span>
                    </div>`;
                    if (ans.type === 'mcq' && ans.options) {
                        html += '<div style="margin-top:8px; font-size:13px; color:var(--text-muted)">';
                        Object.entries(ans.options).forEach(([key, val]) => {
                            const marker = key === ans.correctAnswer ? ' ✓' : '';
                            html += `<span style="margin-right:16px">${key.toUpperCase()}: ${Utils.escapeHtml(val)}${marker}</span>`;
                        });
                        html += '</div>';
                    }
                } else {
                    if (ans.referenceAnswer) {
                        html += `<div style="background:var(--info-bg); padding:10px; border-radius:var(--radius); margin-bottom:12px; font-size:14px">
                            <strong>📖 Reference Answer:</strong><br>
                            ${Utils.escapeHtml(ans.referenceAnswer)}
                        </div>`;
                    }
                    html += `<div style="background:var(--bg); padding:10px; border-radius:var(--radius); margin-bottom:12px; font-size:14px">
                        <strong>Student's Answer:</strong><br>
                        ${Utils.escapeHtml(ans.studentAnswer || 'No answer provided')}
                    </div>`;
                    html += `<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px">
                        <label style="font-weight:600">Marks:</label>
                        <input type="number" class="form-input eval-marks-input" data-index="${i}" 
                               min="0" max="${ans.maxMarks}" value="${ans.marksAwarded || 0}" style="width:80px">
                        <span style="color:var(--text-muted)">/ ${ans.maxMarks}</span>
                    </div>`;
                    html += `<div>
                        <label class="form-label">Feedback (optional)</label>
                        <textarea class="form-textarea" data-feedback-index="${i}" rows="2"
                                  placeholder="Add feedback for the student">${ans.feedback || ''}</textarea>
                    </div>`;
                }
                html += '</div>';
            });

            const autoMarks = submission.autoGradedMarks || 0;
            html += `<div style="display:flex; gap:24px; padding:16px; background:var(--bg); border:1px solid var(--border); border-radius:var(--radius); margin-bottom:20px; font-size:16px; font-weight:600">
                <div>Auto-Graded: ${autoMarks}</div>
                <div>Manual: <span id="evalManualMarks">${submission.manualGradedMarks || 0}</span></div>
                <div>Total: <span id="evalTotalMarks">${submission.obtainedMarks || 0}</span> / ${submission.totalMarks}</div>
            </div>`;
            
            html += `<div class="btn-group">
                <button class="btn btn-primary" onclick="Admin.saveEvaluation('${submissionId}')">💾 Save Evaluation</button>
                <button class="btn btn-success" onclick="Admin.saveAndRelease('${submissionId}')">✅ Save & Release</button>
            </div>`;

            document.getElementById('evalContent').innerHTML = html;

            const updateTotals = () => {
                let m = 0;
                document.querySelectorAll('.eval-marks-input').forEach(input => {
                    m += parseInt(input.value) || 0;
                });
                document.getElementById('evalManualMarks').textContent = m;
                document.getElementById('evalTotalMarks').textContent = m + autoMarks;
            };

            document.querySelectorAll('.eval-marks-input').forEach(input => {
                input.addEventListener('input', updateTotals);
            });

        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to load submission', 'error');
        }
        Utils.hideLoader();
    },

    async saveEvaluation(submissionId, release = false) {
        Utils.showLoader();
        try {
            const subDoc = await db.collection('submissions').doc(submissionId).get();
            const submission = subDoc.data();

            const marksInputs = document.querySelectorAll('.eval-marks-input');
            const feedbackInputs = document.querySelectorAll('[data-feedback-index]');

            let manualMarks = 0;
            marksInputs.forEach(input => {
                const idx = parseInt(input.dataset.index);
                const marks = Math.min(parseInt(input.value) || 0, submission.answers[idx].maxMarks);
                submission.answers[idx].marksAwarded = marks;
                submission.answers[idx].isCorrect = marks > 0;
                manualMarks += marks;
            });

            feedbackInputs.forEach(textarea => {
                const idx = parseInt(textarea.dataset.feedbackIndex);
                submission.answers[idx].feedback = textarea.value.trim();
            });

            const obtainedMarks = (submission.autoGradedMarks || 0) + manualMarks;

            await db.collection('submissions').doc(submissionId).update({
                answers: submission.answers,
                manualGradedMarks: manualMarks,
                obtainedMarks: obtainedMarks,
                status: release ? 'released' : 'evaluated'
            });

            Utils.showToast(release ? 'Saved & released!' : 'Evaluation saved!', 'success');
            document.getElementById('evalStep2').style.display = 'none';
            document.getElementById('evalStep1').style.display = 'block';
            const quizId = document.getElementById('evalQuizSelect').value;
            if (quizId) this.loadSubmissionsForQuiz(quizId);
        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to save evaluation', 'error');
        }
        Utils.hideLoader();
    },

    async saveAndRelease(submissionId) {
        this.saveEvaluation(submissionId, true);
    },

    async releaseAllEvaluated(quizId) {
        const confirmed = await Utils.confirmAction('Release all evaluated results for this quiz?');
        if (!confirmed) return;
        Utils.showLoader();
        try {
            const snap = await db.collection('submissions')
                .where('quizId', '==', quizId)
                .where('status', '==', 'evaluated')
                .get();
            const batch = db.batch();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, { status: 'released' });
            });
            await batch.commit();
            Utils.showToast(`Released ${snap.size} results!`, 'success');
            this.loadSubmissionsForQuiz(quizId);
        } catch(err) {
            Utils.showToast('Failed to release results', 'error');
        }
        Utils.hideLoader();
    },

    async releaseSubmission(submissionId) {
        Utils.showLoader();
        try {
            await db.collection('submissions').doc(submissionId).update({ status: 'released' });
            Utils.showToast('Result released!', 'success');
            const quizId = document.getElementById('evalQuizSelect').value;
            if (quizId) this.loadSubmissionsForQuiz(quizId);
        } catch(err) {
            Utils.showToast('Failed to release', 'error');
        }
        Utils.hideLoader();
    },

    // ── ANALYTICS ──
    async loadAnalytics() {
        try {
            const snap = await db.collection('quizzes').orderBy('createdAt', 'desc').get();
            this.quizzes = snap.docs.map(d => ({id: d.id, ...d.data()}));
            const select = document.getElementById('analyticsQuizSelect');
            select.innerHTML = '<option value="">— Choose a quiz —</option>';
            this.quizzes.forEach(q => {
                select.innerHTML += `<option value="${q.id}">${q.title} (${q.subject})</option>`;
            });
        } catch(err) {
            Utils.showToast('Failed to load quizzes', 'error');
        }
    },

    async showAnalytics(quizId) {
        if (!quizId) {
            document.getElementById('analyticsContent').innerHTML = '';
            return;
        }
        Utils.showLoader();
        try {
            const quiz = this.quizzes.find(q => q.id === quizId);
            const snap = await db.collection('submissions').where('quizId', '==', quizId).get();
            const submissions = snap.docs.map(d => ({id: d.id, ...d.data()}));

            if (submissions.length === 0) {
                document.getElementById('analyticsContent').innerHTML = '<div class="alert alert-info">No submissions yet</div>';
                Utils.hideLoader();
                return;
            }

            const totalSubs = submissions.length;
            const scores = submissions.map(s => s.obtainedMarks || 0);
            const avg = Math.round(scores.reduce((a,b) => a+b, 0) / totalSubs);
            const highest = Math.max(...scores);
            const passCount = submissions.filter(s => Utils.percentage(s.obtainedMarks || 0, s.totalMarks) >= 40).length;
            const passRate = Utils.percentage(passCount, totalSubs);

            const grades = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
            submissions.forEach(s => {
                const pct = Utils.percentage(s.obtainedMarks || 0, s.totalMarks);
                const g = Utils.getGrade(pct);
                grades[g.grade]++;
            });
            const maxGradeCount = Math.max(...Object.values(grades), 1);

            let html = '';
            html += `<div class="stats-grid">
                <div class="stat-card stat-info"><div class="stat-icon">📊</div><div class="stat-info"><div class="stat-number">${totalSubs}</div><div class="stat-label">Total Submissions</div></div></div>
                <div class="stat-card stat-success"><div class="stat-icon">📈</div><div class="stat-info"><div class="stat-number">${avg}/${quiz.totalMarks}</div><div class="stat-label">Average Score</div></div></div>
                <div class="stat-card stat-warning"><div class="stat-icon">✅</div><div class="stat-info"><div class="stat-number">${passRate}%</div><div class="stat-label">Pass Rate (≥40%)</div></div></div>
                <div class="stat-card stat-error"><div class="stat-icon">🏆</div><div class="stat-info"><div class="stat-number">${highest}</div><div class="stat-label">Highest Score</div></div></div>
            </div>`;

            html += '<div class="card" style="margin-bottom:24px"><div class="card-header"><h3 class="card-title">Grade Distribution</h3></div>';
            const gradeColors = { 'A+': '#16a34a', 'A': '#22c55e', 'B+': '#65a30d', 'B': '#ca8a04', 'C': '#ea580c', 'D': '#dc2626', 'F': '#991b1b' };
            html += '<div style="display:flex; height:200px; gap:8px; align-items:flex-end">';
            Object.entries(grades).forEach(([grade, count]) => {
                const heightPct = (count / maxGradeCount) * 100;
                html += `<div style="flex:1; display:flex; flex-direction:column; align-items:center;">
                    <div style="font-size:12px; margin-bottom:4px">${count}</div>
                    <div style="width:100%; height:${Math.max(heightPct, 3)}%; background:${gradeColors[grade]}; border-radius:4px 4px 0 0"></div>
                    <div style="font-size:12px; font-weight:600; margin-top:4px">${grade}</div>
                </div>`;
            });
            html += '</div></div>';

            html += `<div class="card mt-3"><div class="card-header">
                <h3 class="card-title">All Results</h3>
                <button class="btn btn-secondary btn-sm" onclick="Admin.exportResults('${quizId}')">📥 Export to Excel</button>
            </div>`;
            html += '<div class="table-container"><table class="table"><thead><tr><th>Roll No.</th><th>Name</th><th>Marks</th><th>Percentage</th><th>Grade</th><th>Time</th><th>Tab Switches</th><th>Status</th></tr></thead><tbody>';
            submissions.sort((a,b) => (b.obtainedMarks||0) - (a.obtainedMarks||0));
            submissions.forEach(s => {
                const pct = Utils.percentage(s.obtainedMarks || 0, s.totalMarks);
                const g = Utils.getGrade(pct);
                html += `<tr>
                    <td>${Utils.escapeHtml(s.rollNumber)}</td>
                    <td>${Utils.escapeHtml(s.studentName)}</td>
                    <td><strong>${s.obtainedMarks || 0}</strong> / ${s.totalMarks}</td>
                    <td>${pct}%</td>
                    <td><span style="color:${g.color};font-weight:700">${g.grade}</span></td>
                    <td>${Utils.formatTime(s.timeSpent)}</td>
                    <td>${s.tabSwitches || 0}</td>
                    <td><span class="badge ${Utils.statusBadge(s.status)}">${s.status}</span></td>
                </tr>`;
            });
            html += '</tbody></table></div></div>';

            document.getElementById('analyticsContent').innerHTML = html;
        } catch(err) {
            console.error(err);
            Utils.showToast('Failed to load analytics', 'error');
        }
        Utils.hideLoader();
    },

    exportResults(quizId) {
        const quiz = this.quizzes.find(q => q.id === quizId);
        db.collection('submissions').where('quizId', '==', quizId).get().then(snap => {
            const data = snap.docs.map(d => {
                const s = d.data();
                const pct = Utils.percentage(s.obtainedMarks || 0, s.totalMarks);
                return {
                    'Roll Number': s.rollNumber,
                    'Student Name': s.studentName,
                    'Total Marks': s.totalMarks,
                    'Obtained Marks': s.obtainedMarks || 0,
                    'Auto-Graded': s.autoGradedMarks || 0,
                    'Manual-Graded': s.manualGradedMarks || 0,
                    'Percentage': pct + '%',
                    'Grade': Utils.getGrade(pct).grade,
                    'Time Spent': Utils.formatTime(s.timeSpent),
                    'Tab Switches': s.tabSwitches || 0,
                    'Status': s.status
                };
            });
            Utils.exportToExcel(data, `${quiz?.title || 'quiz'}_results`);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => Admin.init());

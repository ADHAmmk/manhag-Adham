const form = document.getElementById('questionForm');
const textArea = document.getElementById('lessonText');
const fileInput = document.getElementById('fileInput');
const charCount = document.getElementById('charCount');
const results = document.getElementById('results');

textArea.addEventListener('input', () => {
    charCount.textContent = `${textArea.value.length} حرف`;
});

// قراءة ملف TXT

fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt')) {
        alert('يرجى اختيار ملف TXT.');
        fileInput.value = '';
        return;
    }

    try {
        textArea.value = await file.text();
        charCount.textContent = `${textArea.value.length} حرف`;
    } catch {
        alert('تعذرت قراءة الملف.');
    }
});

// تقسيم النص إلى جمل

function splitSentences(text) {
    return text
        .replace(/\r/g, '')
        .split(/[.!؟?؛\n]+/)
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length >= 12);
}

// تجهيز الأسئلة التجريبية

function makeQuestions(sentences, count, type) {
    const pool = [...sentences];
    const questions = [];

    for (let i = 0; i < count; i++) {
        const sentence = pool[i % pool.length];

        let currentType = type;

        if (type === 'mixed') {
            currentType = ['mcq', 'tf', 'essay'][i % 3];
        }

        if (currentType === 'essay') {
            questions.push({
                type: 'essay',
                text: `اشرح الفكرة الأساسية الواردة في العبارة التالية: "${sentence}"`,
                answer: null
            });

            continue;
        }

        if (currentType === 'tf') {
            const isTrue = Math.random() >= 0.5;

            questions.push({
                type: 'tf',
                text: isTrue
                    ? `صح أم خطأ: ${sentence}`
                    : `صح أم خطأ: ${alterSentence(sentence)}`,
                options: ['صح', 'خطأ'],
                answer: isTrue ? 0 : 1
            });

            continue;
        }

        const words = sentence.split(/\s+/)
            .filter(word => word.length >= 4);

        const key = words[Math.floor(Math.random() * words.length)];

        if (!key) {
            questions.push({
                type: 'essay',
                text: `اشرح الفكرة الأساسية في العبارة: "${sentence}"`,
                answer: null
            });

            continue;
        }

        const blanked = sentence.replace(key, '........');

        const options = shuffle([
            key,
            'المفهوم الآخر',
            'العبارة غير الصحيحة',
            'لا شيء مما سبق'
        ]);

        questions.push({
            type: 'mcq',
            text: `أكمل العبارة باختيار الإجابة الأنسب: ${blanked}`,
            options,
            answer: options.indexOf(key)
        });
    }

    return questions;
}

// إنشاء عبارة مختلفة لأسئلة الصح والخطأ.
// التغيير هنا تجريبي وقد لا ينتج دائمًا عبارة خاطئة علميًا.

function alterSentence(sentence) {
    const replacements = [
        ['يزيد', 'يقل'],
        ['يتكون', 'لا يتكون'],
        ['يسبب', 'لا يسبب'],
        ['تتكون', 'لا تتكون'],
        ['يحدث', 'لا يحدث'],
        ['يرتفع', 'ينخفض'],
        ['الماء', 'الهواء']
    ];

    for (const [original, replacement] of replacements) {
        if (sentence.includes(original)) {
            return sentence.replace(original, replacement);
        }
    }

    return `ليس صحيحًا أن ${sentence}`;
}

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

// إنشاء الاختبار وعرضه

form.addEventListener('submit', event => {
    event.preventDefault();

    const text = textArea.value.trim();
    const subject = document.getElementById('subject').value;
    const lesson = document.getElementById('lesson').value.trim();
    const count = Number(document.getElementById('count').value);
    const type = document.getElementById('questionType').value;

    if (!subject || !lesson) {
        alert('اختر المادة واكتب اسم الدرس.');
        return;
    }

    if (text.length < 30) {
        alert('اكتب 30 حرفًا على الأقل من نص الدرس.');
        textArea.focus();
        return;
    }

    const sentences = splitSentences(text);

    if (!sentences.length) {
        alert('اكتب جملًا واضحة، وافصل بينها بنقطة أو سطر جديد.');
        return;
    }

    const questions = makeQuestions(sentences, count, type);

    results.classList.remove('hidden');

    results.innerHTML = `
        <div class="results-header">
            <h2>اختبار ${escapeHtml(lesson)}</h2>
            <p>
                المادة: ${escapeHtml(subject)}
                — عدد الأسئلة: ${questions.length}
            </p>
        </div>

        <p class="warning">
            تنبيه: الأسئلة مولدة بقواعد بسيطة وليست ناتجة عن ذكاء اصطناعي.
            راجع صحتها قبل الاعتماد عليها.
        </p>

        <div id="questionList"></div>

        <div id="scoreBox" class="score-box hidden"></div>
    `;

    const list = document.getElementById('questionList');

    let answered = 0;
    let score = 0;
    let objectiveCount = questions.filter(q => q.type !== 'essay').length;

    questions.forEach((question, index) => {
        const card = document.createElement('article');
        card.className = 'question-card';

        const typeLabel = {
            mcq: 'اختيار من متعدد',
            tf: 'صح أو خطأ',
            essay: 'سؤال مقالي'
        }[question.type];

        card.innerHTML = `
            <div class="question-meta">
                <span class="question-number">
                    السؤال ${index + 1}
                </span>
                <span class="question-type">
                    ${typeLabel}
                </span>
            </div>

            <p class="question-text">
                ${escapeHtml(question.text)}
            </p>

            <div class="question-content"></div>
            <div class="feedback" aria-live="polite"></div>
        `;

        const content = card.querySelector('.question-content');
        const feedback = card.querySelector('.feedback');

        // السؤال المقالي

        if (question.type === 'essay') {
            content.innerHTML = `
                <textarea class="essay-answer"
                    placeholder="اكتب إجابتك المقالية هنا..."></textarea>

                <p class="essay-note">
                    ✎ سؤال مقالي: اكتب إجابتك ثم راجعها مع الكتاب أو المعلم.
                    لا يمكن تصحيح المقال تلقائيًا في هذه النسخة.
                </p>
            `;
        }

        // الأسئلة الموضوعية

        else {
            const options = document.createElement('div');
            options.className = 'options';

            question.options.forEach((option, optionIndex) => {
                const button = document.createElement('button');

                button.type = 'button';
                button.className = 'answer-btn';
                button.textContent =
                    `${String.fromCharCode(65 + optionIndex)}. ${option}`;

                button.addEventListener('click', () => {
                    if (card.dataset.answered) return;

                    card.dataset.answered = 'true';
                    answered++;

                    const isCorrect = optionIndex === question.answer;

                    if (isCorrect) score++;

                    [...options.children].forEach((btn, i) => {
                        btn.disabled = true;

                        if (i === question.answer) {
                            btn.classList.add('correct');
                        }
                    });

                    if (!isCorrect) {
                        button.classList.add('wrong');
                    }

                    feedback.textContent = isCorrect
                        ? 'إجابة صحيحة ✓'
                        : `الإجابة المقترحة: ${question.options[question.answer]}`;

                    if (answered === objectiveCount) {
                        showScore();
                    }
                });

                options.appendChild(button);
            });

            content.appendChild(options);
        }

        list.appendChild(card);
    });

    function showScore() {
        const box = document.getElementById('scoreBox');

        box.classList.remove('hidden');

        const percentage = objectiveCount
            ? Math.round(score / objectiveCount * 100)
            : 0;

        box.innerHTML = `
            <h3>${score} / ${objectiveCount}</h3>
            <p>نتيجتك في الأسئلة الموضوعية: ${percentage}%</p>
            <p>
                الأسئلة المقالية لا تدخل في الدرجة؛
                لأنها تحتاج إلى مراجعة يدوية.
            </p>
            <button class="main-btn" id="retryBtn">
                إعادة الاختبار
            </button>
        `;

        document.getElementById('retryBtn').addEventListener('click', () => {
            form.requestSubmit();
            document.getElementById('generator');
        });
    }

    // إذا كان الاختبار مقاليًا بالكامل

    if (objectiveCount === 0) {
        const box = document.getElementById('scoreBox');
        box.classList.remove('hidden');

        box.innerHTML = `
            <h3>اختبار مقالي جاهز</h3>
            <p>أجب عن الأسئلة وراجع إجاباتك مع الكتاب أو المعلم.</p>
        `;
    }

    results.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
});
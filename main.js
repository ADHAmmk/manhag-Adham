const form = document.getElementById('questionForm');
const textArea = document.getElementById('lessonText');
const fileInput = document.getElementById('fileInput');
const charCount = document.getElementById('charCount');
const results = document.getElementById('results');
const driveUrlInput = document.getElementById('driveUrl');
const driveImportBtn = document.getElementById('driveImportBtn');
const importStatus = document.getElementById('importStatus');

textArea.addEventListener('input', () => {
    charCount.textContent = `${textArea.value.length} حرف`;
});

function setLessonText(text) {
    const trimmedText = text.trim();

    if (!trimmedText) {
        throw new Error('لم يتم العثور على نص قابل للقراءة في الملف.');
    }

    textArea.value = trimmedText;
    charCount.textContent = `${trimmedText.length} حرف`;
}

function setImportStatus(message, isError = false) {
    importStatus.textContent = message;
    importStatus.classList.toggle('error', isError);
}

async function extractPdfText(data) {
    if (!window.pdfjsLib) {
        throw new Error('تعذر تحميل أداة قراءة PDF. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map(item => item.str).join(' '));
    }

    const text = pages.join('\n');

    if (!text.trim()) {
        throw new Error('لم يُعثر على نص داخل PDF؛ قد يحتاج الملف الممسوح ضوئيًا إلى OCR.');
    }

    return text;
}

async function readFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'txt' || file.type === 'text/plain') {
        setLessonText(await file.text());
        return;
    }

    if (extension === 'pdf' || file.type === 'application/pdf') {
        setLessonText(await extractPdfText(new Uint8Array(await file.arrayBuffer())));
        return;
    }

    throw new Error('نوع الملف غير مدعوم. اختر ملف TXT أو PDF.');
}

function getDriveFileId(url) {
    const match = url.pathname.match(/\/(?:file|document)\/d\/([^/]+)/);
    return url.searchParams.get('id') || (match && match[1]);
}

async function importFromDrive() {
    const sharedUrl = driveUrlInput.value.trim();

    if (!sharedUrl) {
        setImportStatus('الصق رابط مشاركة Google Drive أولًا.', true);
        driveUrlInput.focus();
        return;
    }

    let url;

    try {
        url = new URL(sharedUrl);
    } catch {
        setImportStatus('الرابط غير صالح. الصق رابط Google Drive كاملًا.', true);
        return;
    }

    if (!['drive.google.com', 'docs.google.com'].includes(url.hostname)) {
        setImportStatus('استخدم رابطًا من drive.google.com أو docs.google.com.', true);
        return;
    }

    const fileId = getDriveFileId(url);

    if (!fileId) {
        setImportStatus('لم أتمكن من تحديد الملف. استخدم رابط مشاركة لملف أو مستند.', true);
        return;
    }

    driveImportBtn.disabled = true;
    setImportStatus('جارٍ استيراد الملف...');

    try {
        const isGoogleDoc = url.hostname === 'docs.google.com' &&
            url.pathname.includes('/document/');
        const downloadUrl = isGoogleDoc
            ? `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/export?format=txt`
            : `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
        const response = await fetch(downloadUrl);

        if (!response.ok) {
            throw new Error(`تعذر تنزيل الملف (HTTP ${response.status}).`);
        }

        if (isGoogleDoc) {
            const text = await response.text();

            if (response.headers.get('content-type')?.includes('text/html') ||
                /^\s*<!doctype html|^\s*<html\b/i.test(text)) {
                throw new Error('لم يمكن قراءة المستند. تأكد من إتاحته لأي شخص لديه الرابط.');
            }

            setLessonText(text);
        } else {
            const data = new Uint8Array(await response.arrayBuffer());
            const isPdf = new TextDecoder().decode(data.subarray(0, 5)) === '%PDF-';

            if (isPdf) {
                setLessonText(await extractPdfText(data));
            } else if (response.headers.get('content-type')?.includes('text/plain')) {
                setLessonText(await new TextDecoder().decode(data));
            } else {
                throw new Error('رابط Drive يجب أن يشير إلى ملف PDF أو TXT أو مستند Google Docs.');
            }
        }

        setImportStatus('تم استيراد الملف بنجاح.');
    } catch (error) {
        console.error('تعذر استيراد الملف من Google Drive:', error);
        const message = error instanceof TypeError
            ? 'تعذر الوصول إلى الملف من المتصفح. اجعل المشاركة متاحة لأي شخص لديه الرابط، أو نزّل الملف وارفعه من جهازك.'
            : error.message || 'تعذر استيراد الملف. نزّله وارفعه من جهازك.';
        setImportStatus(message, true);
    } finally {
        driveImportBtn.disabled = false;
    }
}

// قراءة ملفات TXT وPDF

fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];

    if (!file) return;

    try {
        await readFile(file);
        setImportStatus('تم تحميل الملف بنجاح.');
    } catch (error) {
        console.error('تعذرت قراءة الملف:', error);
        setImportStatus(error.message || 'تعذرت قراءة الملف.', true);
        fileInput.value = '';
    }
});

driveImportBtn.addEventListener('click', importFromDrive);

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
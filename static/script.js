document.addEventListener('DOMContentLoaded', () => {

    // ── Element refs ──────────────────────────────────────
    const tabNavBtns     = document.querySelectorAll('.nav-btn');
    const tabContents    = document.querySelectorAll('.tab-content');
    const summarizeBtn   = document.getElementById('summarize-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const resultsSection = document.getElementById('results-section');
    const summaryOutput  = document.getElementById('summary-output');
    const keywordsList   = document.getElementById('keywords-list');
    const copyBtn        = document.getElementById('copy-btn');
    const inputText      = document.getElementById('input-text');
    const wordCountEl    = document.getElementById('word-count');
    const wordHintEl     = document.getElementById('word-hint');
    const wcBar          = document.getElementById('wc-bar');
    const bulletOption   = document.getElementById('bullet-option');
    const statusBadge    = document.getElementById('status-badge');
    const statusText     = document.getElementById('status-text');
    const processSteps   = document.getElementById('process-steps');
    const textareaWrapper = document.getElementById('textarea-wrapper');

    const dropArea  = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    let uploadedFile = null;

    // ── Toast system ───────────────────────────────────────
    let toastTimer = null;
    function showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-msg');
        const icons = { success: 'fa-check-circle', error: 'fa-circle-xmark', info: 'fa-circle-info' };
        toast.className = `toast ${type}`;
        toast.querySelector('.toast-icon i').className = `fas ${icons[type] || icons.success}`;
        toastMsg.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ── Status badge ───────────────────────────────────────
    function setStatus(state, text) {
        statusBadge.className = `status-badge ${state}`;
        statusText.textContent = text;
    }

    // ── Tab navigation ─────────────────────────────────────
    tabNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabNavBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
            updateRunBtn();
        });
    });

    // ── Method toggle ──────────────────────────────────────
    document.querySelectorAll('#method-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#method-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('summary-type').value = btn.dataset.value;
            updateMethodInfo(btn.dataset.value);
            bulletOption.style.display = btn.dataset.value === 'extractive' ? 'block' : 'none';
            if (btn.dataset.value !== 'extractive') {
                document.getElementById('output-format').value = 'paragraph';
                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('fmt-para').classList.add('active');
            }
        });
    });

    // ── Format toggle ──────────────────────────────────────
    document.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('output-format').value = btn.dataset.value;
        });
    });

    // ── Length toggle ──────────────────────────────────────
    document.querySelectorAll('#length-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#length-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('summary-length').value = btn.dataset.value;
        });
    });

    // ── Domain selector ────────────────────────────────────
    document.querySelectorAll('.domain-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.domain-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('domain').value = btn.dataset.value;
        });
    });

    function updateMethodInfo(method) {
        const info = document.getElementById('method-info');
        const texts = {
            extractive:  '<strong>Extractive</strong>: Selects key sentences from the original text using TF-based frequency scoring.',
            abstractive: '<strong>Abstractive</strong>: Uses DistilBART transformer to generate new sentences — paraphrasing the core ideas.'
        };
        info.querySelector('p').innerHTML = texts[method] || '';
    }

    // ── Word counter with progress bar ─────────────────────
    inputText.addEventListener('input', () => {
        const words = inputText.value.trim().split(/\s+/).filter(Boolean).length;
        wordCountEl.textContent = words;
        const ok = words >= 50;

        // Progress bar — fills to 100% at 50 words
        const pct = Math.min((words / 50) * 100, 100);
        wcBar.style.width = `${pct}%`;
        wcBar.classList.toggle('full', ok);

        wordHintEl.textContent = ok ? '✓ Ready to summarize' : `${50 - words} more words needed`;
        wordHintEl.classList.toggle('ok', ok);
        textareaWrapper.classList.toggle('has-content', words > 0);

        if (ok) setStatus('ready', 'Ready');
        else     setStatus('', 'Waiting');

        updateRunBtn();
    });

    function updateRunBtn() {
        const activeTab = document.querySelector('.nav-btn.active')?.dataset.tab;
        const words = inputText.value.trim().split(/\s+/).filter(Boolean).length;
        summarizeBtn.disabled = activeTab === 'text-input' ? words < 50 : !uploadedFile;
    }

    // ── File upload ────────────────────────────────────────
    ['dragenter','dragover','dragleave','drop'].forEach(e => {
        dropArea.addEventListener(e, ev => { ev.preventDefault(); ev.stopPropagation(); });
    });
    ['dragenter','dragover'].forEach(e => dropArea.addEventListener(e, () => dropArea.classList.add('dragover')));
    ['dragleave','drop'].forEach(e => dropArea.addEventListener(e, () => dropArea.classList.remove('dragover')));
    dropArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
    fileInput.addEventListener('change', e => handleFiles(e.target.files));

    function handleFiles(files) {
        if (files.length > 0) {
            uploadedFile = files[0];
            const fileStatus = document.getElementById('file-status');
            const fileInfo   = document.getElementById('file-info');
            fileInfo.textContent = uploadedFile.name;
            fileStatus.style.display = 'flex';
            setStatus('ready', 'Ready');
            updateRunBtn();
            showToast(`File loaded: ${uploadedFile.name}`, 'success');
        }
    }

    // ── Process steps animation ────────────────────────────
    const stepIds = ['ps1','ps2','ps3','ps4'];
    let stepTimers = [];

    function startProcessSteps() {
        processSteps.style.display = 'flex';
        stepIds.forEach(id => {
            const el = document.getElementById(id);
            el.className = 'ps-step';
        });
        document.querySelectorAll('.ps-connector').forEach(c => c.classList.remove('done'));

        let delay = 0;
        stepIds.forEach((id, i) => {
            const t1 = setTimeout(() => {
                document.getElementById(id).classList.add('active');
                // Update loading overlay steps too
                const ls = document.getElementById(`ls${i+1}`);
                if (ls) {
                    ls.classList.remove('dim');
                    ls.querySelector('i').className = 'fas fa-circle-notch fa-spin';
                }
            }, delay);

            const t2 = setTimeout(() => {
                const el = document.getElementById(id);
                el.classList.remove('active');
                el.classList.add('done');
                // Mark connector as done
                const connectors = document.querySelectorAll('.ps-connector');
                if (connectors[i]) connectors[i].classList.add('done');
                // Update loading overlay
                const ls = document.getElementById(`ls${i+1}`);
                if (ls) ls.querySelector('i').className = 'fas fa-check-circle';
            }, delay + 600);

            stepTimers.push(t1, t2);
            delay += 700;
        });
    }

    function clearProcessSteps() {
        stepTimers.forEach(t => clearTimeout(t));
        stepTimers = [];
        processSteps.style.display = 'none';
    }

    // ── Summarize ──────────────────────────────────────────
    summarizeBtn.addEventListener('click', async () => {
        const activeTab = document.querySelector('.nav-btn.active')?.dataset.tab;
        if (activeTab === 'text-input') {
            const text = inputText.value.trim();
            if (!text) return;
            await processSummarization(text);
        } else {
            if (!uploadedFile) return;
            showLoading();
            const formData = new FormData();
            formData.append('file', uploadedFile);
            try {
                const res = await fetch('/upload', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                await processSummarization(data.text);
            } catch (err) {
                hideLoading();
                setStatus('error', 'Error');
                showToast(err.message, 'error');
            }
        }
    });

    async function processSummarization(text) {
        showLoading();
        setStatus('working', 'Processing…');
        startProcessSteps();

        const type         = document.getElementById('summary-type').value;
        const length       = document.getElementById('summary-length').value;
        const domain       = document.getElementById('domain').value;
        const outputFormat = document.getElementById('output-format').value;

        try {
            const res = await fetch('/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, type, length, domain, output_format: outputFormat })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            displayResults(data, type, outputFormat);
            setStatus('done', 'Complete');
            showToast('Summary generated successfully!', 'success');
        } catch (err) {
            setStatus('error', 'Failed');
            showToast(err.message, 'error');
        } finally {
            hideLoading();
            setTimeout(clearProcessSteps, 1000);
        }
    }

    // ── Keyword highlight helper ───────────────────────────
    function highlightKeywords(plainText, keywords) {
        let html = escHtml(plainText);
        (keywords || []).forEach(kw => {
            const safe = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`\\b(${safe})\\b`, 'gi');
            html = html.replace(re, '<span class="kw-highlight">$1</span>');
        });
        return html;
    }

    // ── Display results ────────────────────────────────────
    function displayResults(data, method, outputFormat) {
        const { summary, keywords, bullet_points, scores, preprocessing, stats } = data;

        // Stats
        document.getElementById('stat-orig').textContent     = stats.original_words.toLocaleString();
        document.getElementById('stat-summ').textContent     = stats.summary_words.toLocaleString();
        document.getElementById('stat-compress').textContent = `${stats.compression_ratio}%`;
        document.getElementById('stat-method').textContent   = method === 'extractive' ? 'Extractive' : 'Abstractive';

        // Reading time + sentence count
        const wordsPerMin = 200;
        const readMins = Math.max(1, Math.ceil(stats.summary_words / wordsPerMin));
        document.getElementById('read-time').innerHTML  = `<i class="fas fa-clock"></i> ${readMins} min read`;
        const sentCount = outputFormat === 'bullets' && bullet_points ? bullet_points.length : (summary.match(/[.!?]+/g) || []).length;
        document.getElementById('sent-count').innerHTML = `<i class="fas fa-list"></i> ${sentCount} sentence${sentCount !== 1 ? 's' : ''}`;

        // Summary output
        summaryOutput.innerHTML = '';
        if (outputFormat === 'bullets' && bullet_points && bullet_points.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'bullet-summary';
            bullet_points.forEach(point => {
                const li = document.createElement('li');
                // Use textContent first to set plain text safely, then apply highlights
                // This prevents any span injection from breaking text flow
                const highlighted = highlightKeywords(point, keywords);
                li.innerHTML = highlighted;
                // Force block display after setting content
                li.style.display = 'block';
                ul.appendChild(li);
            });
            summaryOutput.appendChild(ul);
        } else {
            summaryOutput.innerHTML = highlightKeywords(summary, keywords);
        }

        // Keywords
        keywordsList.innerHTML = '';
        (keywords || []).forEach(kw => {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = kw;
            keywordsList.appendChild(tag);
        });

        // Pipeline steps
        const stepsEl = document.getElementById('pipeline-steps');
        stepsEl.innerHTML = '';
        if (preprocessing && preprocessing.steps) {
            preprocessing.steps.forEach((s, i) => {
                const el = document.createElement('div');
                el.className = 'pipeline-step';
                el.style.animationDelay = `${i * 0.06}s`;
                el.innerHTML = `
                    <span class="step-num">Step ${i + 1}</span>
                    <div class="step-body">
                        <div class="step-name">${escHtml(s.step.replace(/^\d+\.\s*/, ''))}</div>
                        <div class="step-desc">${escHtml(s.description)}</div>
                        <div class="step-detail">${escHtml(s.detail)}</div>
                    </div>`;
                stepsEl.appendChild(el);
            });
        }

        // ROUGE bars
        const rougePanel = document.getElementById('rouge-panel');
        rougePanel.innerHTML = '';
        const barClasses = { 'ROUGE-1 (Content)':'r1', 'ROUGE-2 (Fluency)':'r2', 'ROUGE-L (Structure)':'rl' };
        if (scores && Object.keys(scores).length > 0) {
            Object.entries(scores).forEach(([key, val]) => {
                const pct = Math.round(val * 100);
                const cls = barClasses[key] || 'r1';
                const item = document.createElement('div');
                item.className = 'rouge-item';
                item.innerHTML = `
                    <div class="rouge-row">
                        <span class="rouge-name">${key}</span>
                        <span class="rouge-score">${val.toFixed(4)}</span>
                    </div>
                    <div class="rouge-bar-bg">
                        <div class="rouge-bar-fill ${cls}" style="width:0%" data-target="${pct}%"></div>
                    </div>`;
                rougePanel.appendChild(item);
            });
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    rougePanel.querySelectorAll('.rouge-bar-fill').forEach(bar => {
                        bar.style.width = bar.dataset.target;
                    });
                });
            });
        }

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ── Pipeline toggle ────────────────────────────────────
    document.getElementById('toggle-pipeline')?.addEventListener('click', function () {
        const steps = document.getElementById('pipeline-steps');
        const hidden = steps.style.display === 'none';
        steps.style.display = hidden ? '' : 'none';
        this.classList.toggle('collapsed', !hidden);
    });

    // ── Copy with feedback ─────────────────────────────────
    copyBtn.addEventListener('click', () => {
        const text = summaryOutput.innerText;
        navigator.clipboard.writeText(text).then(() => {
            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
            copyBtn.classList.add('success');
            showToast('Copied to clipboard!', 'success');
            setTimeout(() => {
                copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                copyBtn.classList.remove('success');
            }, 2000);
        }).catch(() => showToast('Copy failed', 'error'));
    });

    // ── Download with feedback ─────────────────────────────
    async function handleDownload(format) {
        const summary = summaryOutput.innerText;
        if (!summary) return;
        try {
            showToast(`Preparing ${format.toUpperCase()} download…`, 'info');
            const res = await fetch('/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary, format })
            });
            const data = await res.json();
            if (data.download_url) {
                const a = document.createElement('a');
                a.href = data.download_url; a.download = '';
                document.body.appendChild(a); a.click();
                document.body.removeChild(a);
                showToast(`${format.toUpperCase()} downloaded!`, 'success');
            }
        } catch (err) { showToast('Download failed: ' + err.message, 'error'); }
    }

    document.getElementById('download-pdf-btn')?.addEventListener('click', () => handleDownload('pdf'));
    document.getElementById('download-txt-btn')?.addEventListener('click', () => handleDownload('txt'));

    // ── Loading ────────────────────────────────────────────
    function showLoading()  { loadingOverlay.style.display = 'flex'; }
    function hideLoading()  { loadingOverlay.style.display = 'none'; }

    function escHtml(str) {
        return String(str)
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
});
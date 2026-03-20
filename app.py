from flask import Flask, render_template, request, jsonify
import os
from utils.text_processing import process_file, clean_text, get_preprocessing_steps
from utils.summarizer import generate_summary, calculate_rouge_scores

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/summarize', methods=['POST'])
def summarize():
    try:
        data          = request.json
        text          = data.get('text')
        summary_type  = data.get('type', 'extractive')
        length        = data.get('length', 'medium')
        domain        = data.get('domain', 'general')
        output_format = data.get('output_format', 'paragraph')

        if not text:
            return jsonify({'error': 'No text provided'}), 400

        word_count = len(text.split())
        if word_count < 50:
            return jsonify({'error': f'Text too short ({word_count} words). Please provide at least 50 words.'}), 400

        preprocessing_info = get_preprocessing_steps(text)

        summary, keywords, bullet_points = generate_summary(
            text, summary_type, length, domain, output_format
        )

        scores = calculate_rouge_scores(text, summary)

        original_words = len(text.split())
        summary_words  = len(summary.split())
        compression    = round((1 - summary_words / original_words) * 100, 1) if original_words > 0 else 0

        return jsonify({
            'summary':       summary,
            'keywords':      keywords,
            'bullet_points': bullet_points,   # clean list sent to frontend
            'scores':        scores,
            'preprocessing': preprocessing_info,
            'stats': {
                'original_words':    original_words,
                'summary_words':     summary_words,
                'compression_ratio': compression,
                'sentences_in_original': preprocessing_info.get('sentence_count', 0)
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/download', methods=['POST'])
def download_summary():
    try:
        data        = request.json
        summary     = data.get('summary')
        file_format = data.get('format', 'txt')

        if not summary:
            return jsonify({'error': 'No summary provided'}), 400

        if file_format == 'txt':
            filename = 'summary.txt'
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(summary)
            return jsonify({'download_url': f'/download_file/{filename}'})

        elif file_format == 'pdf':
            from fpdf import FPDF

            class PDF(FPDF):
                def header(self):
                    self.set_font('Arial', 'B', 15)
                    self.cell(0, 10, 'Summary Report', 0, 1, 'C')
                    self.ln(5)

            pdf = PDF()
            pdf.add_page()
            pdf.set_font("Arial", size=12)
            safe_summary = summary.encode('latin-1', 'replace').decode('latin-1')
            pdf.multi_cell(0, 10, safe_summary)
            filename = 'summary.pdf'
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            pdf.output(filepath)
            return jsonify({'download_url': f'/download_file/{filename}'})

        return jsonify({'error': 'Invalid format'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/download_file/<filename>')
def return_files(filename):
    from flask import send_from_directory
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)


@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)
        try:
            text = process_file(filepath)
            os.remove(filepath)
            return jsonify({'text': text})
        except Exception as e:
            return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)
import os
import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize


def ensure_nltk_data():
    resources = [
        ('tokenizers/punkt', 'punkt'),
        ('corpora/stopwords', 'stopwords'),
        ('tokenizers/punkt_tab', 'punkt_tab'),
    ]
    for finder_path, download_name in resources:
        try:
            nltk.data.find(finder_path)
        except LookupError:
            print(f"Downloading NLTK resource: {download_name}")
            nltk.download(download_name, quiet=True)


def read_pdf(filepath):
    text = ""
    try:
        import PyPDF2
        with open(filepath, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        raise ValueError(f"Could not read PDF: {e}")
    return text


def read_docx(filepath):
    try:
        from docx import Document
        doc = Document(filepath)
        text = "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
    except Exception as e:
        raise ValueError(f"Could not read DOCX: {e}")
    return text


def read_txt(filepath):
    with open(filepath, 'r', encoding='utf-8') as file:
        return file.read()


def process_file(filepath):
    ensure_nltk_data()
    ext = os.path.splitext(filepath)[1].lower()
    if ext == '.pdf':
        return read_pdf(filepath)
    elif ext == '.docx':
        return read_docx(filepath)
    elif ext == '.txt':
        return read_txt(filepath)
    else:
        raise ValueError(f"Unsupported file format: {ext}")


def clean_text(text):
    """Basic text cleaning: normalize whitespace and strip."""
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text


def get_preprocessing_steps(text):
    """
    Returns a structured log of preprocessing steps applied to the text.
    This makes the pipeline transparent to the user, fulfilling the requirement
    of showcasing tokenization and cleaning steps.
    """
    ensure_nltk_data()
    steps = []

    # Step 1: Raw input stats
    raw_char_count = len(text)
    raw_word_count = len(text.split())
    steps.append({
        "step": "1. Raw Input",
        "description": "Original text received from user",
        "detail": f"{raw_char_count} characters, {raw_word_count} words"
    })

    # Step 2: Whitespace & noise cleaning
    cleaned = re.sub(r'\s+', ' ', text).strip()
    cleaned = re.sub(r'[^\x00-\x7F]+', ' ', cleaned)  # remove non-ASCII noise
    steps.append({
        "step": "2. Text Cleaning",
        "description": "Removed extra whitespace and non-ASCII characters",
        "detail": f"{len(cleaned)} characters after cleaning"
    })

    # Step 3: Sentence tokenization
    sentences = sent_tokenize(cleaned)
    steps.append({
        "step": "3. Sentence Tokenization",
        "description": "Split text into individual sentences using NLTK punkt tokenizer",
        "detail": f"{len(sentences)} sentences detected"
    })

    # Step 4: Word tokenization
    words = word_tokenize(cleaned.lower())
    steps.append({
        "step": "4. Word Tokenization",
        "description": "Tokenized text into individual words (lowercased)",
        "detail": f"{len(words)} tokens generated"
    })

    # Step 5: Stop-word removal
    stop_words = set(stopwords.words('english'))
    filtered = [w for w in words if w.isalnum() and w not in stop_words]
    steps.append({
        "step": "5. Stop-word Removal",
        "description": "Filtered out common English stop-words and punctuation",
        "detail": f"{len(words) - len(filtered)} tokens removed → {len(filtered)} meaningful tokens remain"
    })

    # Step 6: Unique vocabulary
    vocab = set(filtered)
    steps.append({
        "step": "6. Vocabulary Analysis",
        "description": "Identified unique content words for frequency scoring",
        "detail": f"{len(vocab)} unique content words in vocabulary"
    })

    return {
        "steps": steps,
        "sentence_count": len(sentences),
        "token_count": len(words),
        "content_token_count": len(filtered),
        "vocab_size": len(vocab)
    }


def get_sentences(text):
    ensure_nltk_data()
    return sent_tokenize(text)
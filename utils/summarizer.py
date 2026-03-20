from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords
from collections import Counter
import heapq
import re

tokenizer = None
model = None
abstractive_model_loaded = False

DOMAIN_STOPWORDS = {
    'news':     {'said', 'says', 'according', 'told', 'reported', 'also', 'would', 'could'},
    'meeting':  {'meeting', 'discussed', 'agenda', 'attendees', 'action', 'item', 'noted', 'minutes'},
    'document': {'page', 'section', 'figure', 'table', 'refer', 'see', 'above', 'below', 'chapter'},
    'general':  set()
}


def load_abstractive_model():
    global tokenizer, model, abstractive_model_loaded
    if abstractive_model_loaded:
        return
    try:
        model_name = "sshleifer/distilbart-cnn-12-6"
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        abstractive_model_loaded = True
        print("Abstractive model loaded successfully.")
    except Exception as e:
        print(f"Warning: Could not load transformer model: {e}")
        abstractive_model_loaded = False


def clean_sentence(sentence):
    """
    Cleans a single sentence:
    - Strip leading/trailing whitespace
    - Remove stray quotes at start/end
    - Fix multiple spaces
    - Ensure sentence ends with proper punctuation
    - Remove very short fragments (less than 4 words)
    """
    s = sentence.strip()
    # Remove leading/trailing quotes
    s = s.strip('"\'')
    # Fix multiple spaces
    s = re.sub(r'\s+', ' ', s).strip()
    # Skip if too short (fragment)
    if len(s.split()) < 4:
        return None
    # Ensure ends with punctuation
    if s and s[-1] not in '.!?':
        s += '.'
    # Capitalize first letter
    if s:
        s = s[0].upper() + s[1:]
    return s


def extractive_summary(text, length='medium', domain='general'):
    """
    Returns selected sentences as a list (for bullet mode) and joined string (for paragraph mode).
    """
    sentences = sent_tokenize(text)
    if not sentences:
        return [], "", []

    words = word_tokenize(text.lower())
    stop_words = set(stopwords.words('english'))
    stop_words.update(DOMAIN_STOPWORDS.get(domain, set()))
    filtered_words = [w for w in words if w.isalnum() and w not in stop_words]

    if not filtered_words:
        return sentences[:1], sentences[0] if sentences else "", []

    word_freq = Counter(filtered_words)
    max_freq = max(word_freq.values())
    for word in word_freq:
        word_freq[word] /= max_freq

    sentence_scores = {}
    for sent in sentences:
        for word in word_tokenize(sent.lower()):
            if word in word_freq:
                sentence_scores[sent] = sentence_scores.get(sent, 0) + word_freq[word]

    num_sentences = len(sentences)
    if length == 'short':
        target_len = max(1, int(num_sentences * 0.2))
    elif length == 'medium':
        target_len = max(2, int(num_sentences * 0.5))
    else:
        target_len = max(3, int(num_sentences * 0.8))

    top_sentences = heapq.nlargest(target_len, sentence_scores, key=sentence_scores.get)
    # Restore original order
    top_sentences.sort(key=sentences.index)

    keywords = [word for word, freq in word_freq.most_common(7)]

    return top_sentences, ' '.join(top_sentences), keywords


def abstractive_summary_func(text, length='medium'):
    if not abstractive_model_loaded:
        load_abstractive_model()
    if not abstractive_model_loaded:
        return "Error: Abstractive model not loaded.", []

    max_input_length = 1024
    try:
        inputs = tokenizer([text], max_length=max_input_length, return_tensors="pt", truncation=True)
    except Exception as e:
        return f"Error tokenizing text: {e}", []

    length_params = {
        'short':    {'min_length': 20,  'max_length': 80},
        'medium':   {'min_length': 60,  'max_length': 150},
        'detailed': {'min_length': 100, 'max_length': 300},
    }
    params = length_params.get(length, length_params['medium'])
    min_l, max_l = params['min_length'], params['max_length']
    input_len = inputs["input_ids"].shape[1]
    if input_len < max_l:
        max_l = max(min_l + 10, input_len)

    try:
        summary_ids = model.generate(
            inputs["input_ids"], max_length=max_l, min_length=min_l,
            do_sample=False, num_beams=4, early_stopping=True
        )
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary, []
    except Exception as e:
        return f"Error in summarization: {str(e)}", []


def generate_summary(text, summary_type, length, domain='general', output_format='paragraph'):
    """
    Main entry. Returns:
      - summary: str (joined paragraph)
      - keywords: list
      - bullet_points: list of clean strings (only filled when output_format == 'bullets')
    """
    from utils.text_processing import ensure_nltk_data
    ensure_nltk_data()

    bullet_points = []

    if summary_type == 'extractive':
        sentences, summary, keywords = extractive_summary(text, length, domain)

        if output_format == 'bullets':
            # Clean each sentence individually for bullet display
            cleaned = []
            for s in sentences:
                c = clean_sentence(s)
                if c:
                    cleaned.append(c)
            bullet_points = cleaned
            summary = ' '.join(cleaned)
        else:
            summary = ' '.join([clean_sentence(s) or s for s in sentences])

    else:
        # Abstractive
        summary, _ = abstractive_summary_func(text, length)
        _, _, keywords = extractive_summary(text, length, domain)

        if output_format == 'bullets':
            # Split abstractive output into clean sentences for bullets
            raw_sentences = sent_tokenize(summary)
            cleaned = []
            for s in raw_sentences:
                c = clean_sentence(s)
                if c:
                    cleaned.append(c)
            bullet_points = cleaned if cleaned else [summary]

    return summary, keywords, bullet_points


def calculate_rouge_scores(reference, hypothesis):
    try:
        from rouge_score import rouge_scorer
        scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=True)
        scores = scorer.score(reference, hypothesis)
        return {
            'ROUGE-1 (Content)':   round(scores['rouge1'].fmeasure, 4),
            'ROUGE-2 (Fluency)':   round(scores['rouge2'].fmeasure, 4),
            'ROUGE-L (Structure)': round(scores['rougeL'].fmeasure, 4),
        }
    except Exception:
        return {}
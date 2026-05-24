import re


def infer_sentiment(message: str) -> dict:
    text = (message or '').lower()
    if re.search(r'furious|angry|rage|outrage|scam|fraud', text):
        return {'label': 'angry', 'emoji': '😡'}
    if re.search(r'frustrat|irritat|annoy|upset|fed up|tired of|sick of', text):
        return {'label': 'frustrated', 'emoji': '😤'}
    if re.search(r'sad|disappointed|unhappy|let down', text):
        return {'label': 'sad', 'emoji': '😞'}
    if re.search(r'thank|great|awesome|love|happy|excellent', text):
        return {'label': 'happy', 'emoji': '😊'}
    return {'label': 'neutral', 'emoji': '😐'}

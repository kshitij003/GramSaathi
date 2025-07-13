from django.shortcuts import render
import json
import os
import tempfile
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
import speech_recognition as sr
from pydub import AudioSegment
import logging
import mimetypes

logger = logging.getLogger(__name__)

# Create your views here.

def get_official_letter_from_gemini(extracted_text):
    """
    Send the extracted text to Gemini AI API with a prompt to generate an official letter.
    """
    gemini_api_key = "AIzaSyB_hWdavwneAnUdufOaeOrzP6cqQsn8xmU"
    prompt = (
        "You are a needy Indian fellow and want to send this to the destined authority.In the letter give destined authority name by identifying the query and the letter should always be in english. "
        "Give me the official letter to be sent to the government.If some part is not clear then generate it according to you but dont keep anything to be edited by user.\n"
        f"Extracted text: {extracted_text}"
    )
    url = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent"
    headers = {"Content-Type": "application/json"}
    data = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ]
    }
    params = {"key": gemini_api_key}
    response = requests.post(url, headers=headers, params=params, json=data)
    print("Gemini API raw response:", response.text)
    if response.status_code == 200:
        result = response.json()
        try:
            return result["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            return str(result)
    else:
        return f"Error from Gemini API: {response.text.candidates[0].content.parts[0].text}"

def send_complaint_to_node(letter):
    url = "http://localhost:3000/voiceComplaint"  # Change to your deployed Node.js URL if needed
    data = {"letter": letter}
    try:
        response = requests.post(url, json=data)
        print("Complaint system response:", response.text)
    except Exception as e:
        print("Error sending complaint to Node.js:", e)

@csrf_exempt
@require_http_methods(["POST"])
def transcribe_audio(request):
    """
    Accepts only raw binary audio in request.body with Content-Type: audio/ogg.
    Transcribes the audio to text and returns the result, and generates an official letter using Gemini AI.
    """
    try:
        if request.body and request.content_type == 'audio/ogg':
            ext = '.ogg'
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_audio:
                temp_audio.write(request.body)
                temp_audio_path = temp_audio.name
            transcribed_text = convert_audio_to_text(temp_audio_path)
            os.unlink(temp_audio_path)
            if transcribed_text is None:
                return JsonResponse({'success': False, 'error': 'Failed to transcribe audio'}, status=500)
            # Get official letter from Gemini
            official_letter = get_official_letter_from_gemini(transcribed_text)
            send_complaint_to_node(official_letter)
            return JsonResponse({
                'success': True,
                'text': transcribed_text,
                'official_letter': official_letter
            })
        return JsonResponse({'success': False, 'error': 'Only audio/ogg raw binary is supported.'}, status=400)
    except Exception as e:
        logger.error(f"Error in transcribe_audio: {str(e)}")
        return JsonResponse({'success': False, 'error': f'Internal server error: {str(e)}'}, status=500)

def download_audio(url, temp_dir, headers=None):
    """
    Download audio file from URL and return the local file path.
    
    Args:
        url (str): URL of the audio file
        temp_dir (str): Temporary directory to save the file
        headers (dict): Optional headers for authenticated requests
        
    Returns:
        str: Path to the downloaded audio file, or None if failed
    """
    try:
        # Download the file with optional headers
        response = requests.get(url, stream=True, timeout=30, headers=headers)
        response.raise_for_status()
        
        # Determine file extension from content type or URL
        content_type = response.headers.get('content-type', '')
        if 'audio/mpeg' in content_type or url.endswith('.mp3'):
            extension = '.mp3'
        elif 'audio/wav' in content_type or url.endswith('.wav'):
            extension = '.wav'
        elif 'audio/mp4' in content_type or url.endswith('.m4a'):
            extension = '.m4a'
        elif 'audio/ogg' in content_type or url.endswith('.ogg'):
            extension = '.ogg'
        else:
            extension = '.mp3'  # Default to mp3
        
        # Save the file
        audio_path = os.path.join(temp_dir, f'audio{extension}')
        with open(audio_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return audio_path
        
    except requests.RequestException as e:
        logger.error(f"Failed to download audio from {url}: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error downloading audio: {str(e)}")
        return None

def convert_audio_to_text(audio_path):
    """
    Convert audio file to text using speech recognition.
    
    Args:
        audio_path (str): Path to the audio file
        
    Returns:
        str: Transcribed text, or None if failed
    """
    try:
        # Initialize recognizer
        recognizer = sr.Recognizer()
        
        # Convert audio to WAV format if needed (speech_recognition works best with WAV)
        audio_format = audio_path.split('.')[-1].lower()
        
        if audio_format != 'wav':
            # Convert to WAV using pydub
            audio = AudioSegment.from_file(audio_path)
            wav_path = audio_path.replace(f'.{audio_format}', '.wav')
            audio.export(wav_path, format='wav')
            audio_path = wav_path
        
        # Load the audio file
        with sr.AudioFile(audio_path) as source:
            # Read the audio data
            audio_data = recognizer.record(source)
            
            # Recognize speech using Google Speech Recognition
            text = recognizer.recognize_google(audio_data)
            print(text)
            
            return text
            
    except sr.UnknownValueError:
        logger.error("Speech recognition could not understand the audio")
        return None
    except sr.RequestError as e:
        logger.error(f"Could not request results from speech recognition service: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error converting audio to text: {str(e)}")
        return None

def generate_official_letter(extracted_text):
    """
    Generate an official letter to the government using the extracted text.
    """
    # You can further enhance this template as needed
    return (
        "To,\n"
        "The Concerned Authority,\n"
        "Government of India\n\n"
        "Subject: Request for Assistance\n\n"
        "Respected Sir/Madam,\n\n"
        "I am a needy Indian citizen and I am writing to bring to your kind attention the following matter:\n\n"
        f"{extracted_text}\n\n"
        "I humbly request you to kindly look into this matter and provide the necessary assistance at the earliest.\n\n"
        "Thank you for your time and consideration.\n\n"
        "Yours faithfully,\n"
        "[Your Name]"
    )

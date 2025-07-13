import requests
import json

def test_public_audio():
    """Test with a public audio URL"""
    url = "http://localhost:8000/audio/transcribe/"
    
    # Public audio URLs that should work
    public_audio_urls = [
        "https://www.soundjay.com/misc/sounds/bell-ringing-05.wav",
        "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav",
        "https://www2.cs.uic.edu/~i101/SoundFiles/ImperialMarch60.wav"
    ]
    
    for audio_url in public_audio_urls:
        print(f"\nTesting with: {audio_url}")
        print("-" * 50)
        
        payload = {"url": audio_url}
        headers = {"Content-Type": "application/json"}
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    print("✅ Success!")
                    print(f"📝 Text: {result.get('text')}")
                    break
                else:
                    print(f"❌ Failed: {result.get('error')}")
            else:
                print(f"❌ HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_public_audio() 
#!/usr/bin/env python3
"""
Backend API Testing for Nuo App
Tests the audio library endpoint and other core APIs
"""

import requests
import json
import sys
from urllib.parse import urljoin

# Get backend URL from frontend environment
BACKEND_URL = "https://nuo-vocal-biometrics.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

def test_health_check():
    """Test GET /api/ health check endpoint"""
    print("🔍 Testing health check endpoint...")
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            if data.get("message") == "Nuo API running":
                print("✅ Health check passed")
                return True
            else:
                print("❌ Health check failed - unexpected message")
                return False
        else:
            print(f"❌ Health check failed - status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check failed - error: {e}")
        return False

def test_session_status():
    """Test GET /api/session/status endpoint"""
    print("\n🔍 Testing session status endpoint...")
    try:
        response = requests.get(f"{API_BASE}/session/status?email=atuljha2402@gmail.com", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check required fields
            required_fields = ["allowed", "reason", "sessions_used", "sessions_limit"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                print(f"❌ Session status failed - missing fields: {missing_fields}")
                return False
            else:
                print("✅ Session status passed")
                return True
        else:
            print(f"❌ Session status failed - status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Session status failed - error: {e}")
        return False

def test_payment_plans():
    """Test GET /api/payment/plans endpoint"""
    print("\n🔍 Testing payment plans endpoint...")
    try:
        response = requests.get(f"{API_BASE}/payment/plans", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
            
            # Check required fields
            if "razorpay_key" not in data or "plans" not in data:
                print("❌ Payment plans failed - missing required fields")
                return False
            
            # Check plans structure
            plans = data["plans"]
            if not isinstance(plans, list) or len(plans) == 0:
                print("❌ Payment plans failed - plans should be non-empty list")
                return False
            
            # Check each plan has required fields
            plan_fields = ["id", "label", "price", "amount_paise", "days"]
            for plan in plans:
                missing = [field for field in plan_fields if field not in plan]
                if missing:
                    print(f"❌ Payment plans failed - plan missing fields: {missing}")
                    return False
            
            print("✅ Payment plans passed")
            return True
        else:
            print(f"❌ Payment plans failed - status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Payment plans failed - error: {e}")
        return False

def test_audio_library():
    """Test GET /api/audio/library endpoint - main focus"""
    print("\n🔍 Testing audio library endpoint...")
    try:
        response = requests.get(f"{API_BASE}/audio/library", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ Audio library failed - status {response.status_code}")
            if response.text:
                print(f"Error response: {response.text}")
            return False
        
        data = response.json()
        print(f"Response structure: {list(data.keys())}")
        
        # Check response structure
        if "tracks" not in data or "count" not in data:
            print("❌ Audio library failed - missing 'tracks' or 'count' field")
            return False
        
        tracks = data["tracks"]
        count = data["count"]
        
        print(f"Found {count} tracks")
        
        # Check count matches tracks length
        if count != len(tracks):
            print(f"❌ Audio library failed - count ({count}) doesn't match tracks length ({len(tracks)})")
            return False
        
        # Should have 3 seed tracks if collection was empty
        if count < 3:
            print(f"❌ Audio library failed - expected at least 3 tracks, got {count}")
            return False
        
        # Check each track structure
        required_track_fields = ["audio_id", "title", "label", "desc", "duration", "duration_sec", "file_url"]
        expected_titles = ["40Hz Binaural Focus", "Alpha Wave Concentration", "Flow State Ambient"]
        found_titles = []
        
        for i, track in enumerate(tracks):
            print(f"\nTrack {i+1}: {track.get('title', 'NO TITLE')}")
            
            # Check required fields
            missing_fields = [field for field in required_track_fields if field not in track]
            if missing_fields:
                print(f"❌ Track {i+1} missing fields: {missing_fields}")
                return False
            
            # Check file_url is valid HTTPS URL
            file_url = track.get("file_url", "")
            if not file_url.startswith("https://"):
                print(f"❌ Track {i+1} file_url should start with https://, got: {file_url}")
                return False
            
            # Collect titles
            title = track.get("title", "")
            found_titles.append(title)
            
            # Print track details
            print(f"  - ID: {track.get('audio_id')}")
            print(f"  - Label: {track.get('label')}")
            print(f"  - Duration: {track.get('duration')} ({track.get('duration_sec')}s)")
            print(f"  - URL: {file_url[:50]}...")
        
        # Check expected titles are present
        missing_titles = [title for title in expected_titles if title not in found_titles]
        if missing_titles:
            print(f"❌ Audio library failed - missing expected titles: {missing_titles}")
            print(f"Found titles: {found_titles}")
            return False
        
        print(f"\n✅ Audio library passed - all {count} tracks valid")
        print(f"✅ All expected titles found: {expected_titles}")
        return True
        
    except Exception as e:
        print(f"❌ Audio library failed - error: {e}")
        return False

def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting Backend API Tests for Nuo App")
    print(f"Backend URL: {BACKEND_URL}")
    print("=" * 60)
    
    results = {}
    
    # Test all endpoints
    results["health_check"] = test_health_check()
    results["session_status"] = test_session_status()
    results["payment_plans"] = test_payment_plans()
    results["audio_library"] = test_audio_library()
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️  Some tests failed!")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
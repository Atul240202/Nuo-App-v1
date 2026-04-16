"""
Backend API tests for Nuo app
Tests: Health check, Auth endpoints, Personalization, Voice upload
"""
import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

# Read BASE_URL from frontend .env file
def get_backend_url():
    env_path = '/app/frontend/.env'
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    return 'https://learning-scorecard.preview.emergentagent.com'

BASE_URL = get_backend_url()

class TestHealthCheck:
    """Health check endpoint"""
    
    def test_api_health(self):
        """Test GET /api/ returns healthy response"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Nuo API running"


class TestAuthEndpoints:
    """Authentication flow tests"""
    
    def test_auth_session_missing_session_id(self):
        """Test POST /api/auth/session without session_id returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "session_id required" in data["detail"]
    
    def test_auth_session_invalid_session_id(self):
        """Test POST /api/auth/session with invalid session_id returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/session",
            json={"session_id": "invalid_session_12345"}
        )
        # This will fail because Emergent Auth will reject invalid session
        assert response.status_code == 401
    
    def test_auth_me_without_token(self):
        """Test GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "Not authenticated" in data["detail"]
    
    def test_auth_me_with_invalid_token(self):
        """Test GET /api/auth/me with invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": "invalid_token_12345"}
        )
        assert response.status_code == 401
    
    def test_auth_logout(self):
        """Test POST /api/auth/logout returns success"""
        response = requests.post(f"{BASE_URL}/api/auth/logout")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert data["message"] == "Logged out"


class TestPersonalizationEndpoint:
    """Personalization endpoint tests"""
    
    def test_personalization_without_auth(self):
        """Test POST /api/user/personalization without auth returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/user/personalization",
            json={
                "name": "Test User",
                "age": "30",
                "gender": "Male",
                "profession": "Technology",
                "role": "Engineer",
                "calendar_synced": False
            }
        )
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "Not authenticated" in data["detail"]


class TestVoiceEndpoint:
    """Voice upload endpoint tests"""
    
    def test_voice_upload_without_auth(self):
        """Test POST /api/voice/upload without auth still works (optional auth)"""
        response = requests.post(
            f"{BASE_URL}/api/voice/upload",
            json={"duration": 5000}
        )
        # Voice endpoint doesn't require auth (optional)
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "received"
        assert "duration" in data
        assert data["duration"] == 5000
    
    def test_voice_upload_with_duration(self):
        """Test POST /api/voice/upload with duration data"""
        response = requests.post(
            f"{BASE_URL}/api/voice/upload",
            json={"duration": 12500}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "received"
        assert data["duration"] == 12500
        assert "message" in data


# Test with mock session (requires MongoDB setup)
class TestAuthenticatedFlow:
    """Test authenticated endpoints with mock session"""
    
    @pytest.fixture
    def mock_session(self):
        """Create a mock session in MongoDB for testing"""
        import pymongo
        from datetime import datetime, timezone, timedelta
        import uuid
        
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'test_database')
        
        client = pymongo.MongoClient(mongo_url)
        db = client[db_name]
        
        # Create test user and session
        user_id = f"test_user_{uuid.uuid4().hex[:8]}"
        session_token = f"test_session_{uuid.uuid4().hex}"
        
        db.users.insert_one({
            "user_id": user_id,
            "email": "test@example.com",
            "name": "Test User",
            "picture": None,
            "personalization": None,
            "calendar_synced": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc)
        })
        
        yield {"user_id": user_id, "session_token": session_token}
        
        # Cleanup
        db.users.delete_one({"user_id": user_id})
        db.user_sessions.delete_one({"session_token": session_token})
        client.close()
    
    def test_auth_me_with_valid_session(self, mock_session):
        """Test GET /api/auth/me with valid session returns user data"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": mock_session["session_token"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["user_id"] == mock_session["user_id"]
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"
    
    def test_personalization_with_valid_session(self, mock_session):
        """Test POST /api/user/personalization with valid session saves data"""
        personalization_data = {
            "name": "John Doe",
            "age": "35",
            "gender": "Male",
            "profession": "Technology",
            "role": "Founder / CEO",
            "calendar_synced": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/user/personalization",
            json=personalization_data,
            cookies={"session_token": mock_session["session_token"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert "personalization" in data
        assert data["personalization"]["name"] == "John Doe"
        assert data["personalization"]["age"] == "35"
        assert data["personalization"]["profession"] == "Technology"
        
        # Verify data persisted by fetching user again
        verify_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            cookies={"session_token": mock_session["session_token"]}
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["personalization"]["name"] == "John Doe"

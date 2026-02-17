"""Flask routes for the Health Assistant application."""
import json
from functools import wraps
from flask import (
    Blueprint, render_template, request, redirect, url_for,
    session, jsonify, flash, Response, stream_with_context
)
from werkzeug.security import generate_password_hash, check_password_hash

from backend.database import (
    create_user, get_user_by_username, get_user_by_id,
    save_profile, get_profile
)
from backend.ai_service import analyze_symptoms, analyze_symptoms_stream, get_config_error
from backend.rate_limit import check_rate_limit


# Blueprints
auth_bp = Blueprint('auth', __name__)
main_bp = Blueprint('main', __name__)
api_bp = Blueprint('api', __name__)


def login_required(f):
    """Decorator to require login for protected routes."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function


# ============ Auth Routes ============

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    """Login page and handler."""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        if not username or not password:
            flash('Please enter both username and password.', 'danger')
            return render_template('auth/login.html')
        
        user = get_user_by_username(username)
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = username
            # Redirect to profile if not complete, else dashboard
            profile = get_profile(user['id'])
            if not profile or not profile.get('name'):
                return redirect(url_for('main.profile'))
            return redirect(url_for('main.dashboard'))
        
        flash('Invalid username or password.', 'danger')
    
    return render_template('auth/login.html')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    """Registration page and handler."""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        
        if not username or not password:
            flash('Please fill in all fields.', 'danger')
            return render_template('auth/register.html')
        
        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template('auth/register.html')
        
        if len(password) < 6:
            flash('Password must be at least 6 characters.', 'danger')
            return render_template('auth/register.html')
        
        if get_user_by_username(username):
            flash('Username already exists. Please choose another.', 'danger')
            return render_template('auth/register.html')
        
        try:
            create_user(username, generate_password_hash(password))
            flash('Registration successful! Please log in.', 'success')
            return redirect(url_for('auth.login'))
        except Exception:
            flash('Registration failed. Please try again.', 'danger')
    
    return render_template('auth/register.html')


@auth_bp.route('/logout')
def logout():
    """Logout and clear session."""
    session.clear()
    return redirect(url_for('main.index'))


# ============ Main Routes ============

@main_bp.route('/')
def index():
    """Landing page."""
    return render_template('index.html')


@main_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    """User profile collection/update page."""
    user_id = session['user_id']
    
    if request.method == 'POST':
        profile_data = {
            'name': request.form.get('name', '').strip(),
            'age': int(request.form.get('age', 0) or 0),
            'gender': request.form.get('gender', ''),
            'height_cm': float(request.form.get('height_cm', 0) or 0),
            'weight_kg': float(request.form.get('weight_kg', 0) or 0),
            'existing_conditions': request.form.get('existing_conditions', '').strip(),
            'allergies': request.form.get('allergies', '').strip(),
            'smoking_habit': request.form.get('smoking_habit', ''),
            'alcohol_habit': request.form.get('alcohol_habit', ''),
        }
        if profile_data['name']:
            save_profile(user_id, profile_data)
            flash('Profile saved successfully!', 'success')
            return redirect(url_for('main.dashboard'))
        flash('Please enter your name.', 'danger')
    
    existing_profile = get_profile(user_id)
    return render_template('profile.html', profile=existing_profile)


@main_bp.route('/dashboard')
@login_required
def dashboard():
    """Main chat dashboard."""
    user_id = session['user_id']
    profile_data = get_profile(user_id)
    return render_template('dashboard.html', profile=profile_data)


# ============ API Routes ============

def _is_emergency(response_text: str) -> bool:
    """Check if response contains high-risk/emergency indicators."""
    return any(term in response_text.lower() for term in [
        'emergency', 'urgent', 'seek immediate', 'call 911', 'call ambulance',
        'go to the emergency', 'high risk', 'life-threatening'
    ])


@api_bp.route('/analyze', methods=['POST'])
@login_required
def analyze():
    """API endpoint for symptom analysis (non-streaming fallback)."""
    data = request.get_json()
    symptoms = data.get('symptoms', '').strip()

    if not symptoms:
        return jsonify({'error': 'Please describe your symptoms.'}), 400

    user_id = session['user_id']
    allowed, retry_after = check_rate_limit(str(user_id))
    if not allowed:
        return jsonify({
            'error': f'Too many requests. Please wait {retry_after} seconds and try again.'
        }), 429, {'Retry-After': str(retry_after)}

    config_err = get_config_error()
    if config_err:
        return jsonify({'error': config_err}), 503

    profile_data = get_profile(user_id)
    profile_dict = dict(profile_data) if profile_data else None

    response_text = analyze_symptoms(symptoms, profile_dict)
    return jsonify({
        'response': response_text,
        'is_emergency': _is_emergency(response_text)
    })


@api_bp.route('/analyze/stream', methods=['POST'])
@login_required
def analyze_stream():
    """Streaming symptom analysis for faster time-to-first-token (~1-2s)."""
    data = request.get_json()
    symptoms = data.get('symptoms', '').strip()

    if not symptoms:
        return jsonify({'error': 'Please describe your symptoms.'}), 400

    user_id = session['user_id']
    allowed, retry_after = check_rate_limit(str(user_id))
    if not allowed:
        return jsonify({
            'error': f'Too many requests. Please wait {retry_after} seconds and try again.'
        }), 429, {'Retry-After': str(retry_after)}

    config_err = get_config_error()
    if config_err:
        return jsonify({'error': config_err}), 503

    profile_data = get_profile(user_id)
    profile_dict = dict(profile_data) if profile_data else None

    def generate():
        full_text = []
        try:
            for chunk in analyze_symptoms_stream(symptoms, profile_dict):
                full_text.append(chunk)
                for line in chunk.split('\n'):
                    yield f"data: {line}\n"
                yield "\n"
        finally:
            done = json.dumps({
                "done": True,
                "is_emergency": _is_emergency(''.join(full_text))
            })
            yield f"data: {done}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'}
    )


@api_bp.route('/bmi', methods=['POST'])
def calculate_bmi():
    """Calculate BMI from height and weight."""
    data = request.get_json()
    height_cm = float(data.get('height_cm', 0) or 0)
    weight_kg = float(data.get('weight_kg', 0) or 0)
    
    if height_cm <= 0 or weight_kg <= 0:
        return jsonify({'error': 'Invalid height or weight'}), 400
    
    height_m = height_cm / 100
    bmi = round(weight_kg / (height_m ** 2), 1)
    
    # Health category
    if bmi < 18.5:
        category = 'Underweight'
        category_color = 'info'
    elif bmi < 25:
        category = 'Normal'
        category_color = 'success'
    elif bmi < 30:
        category = 'Overweight'
        category_color = 'warning'
    else:
        category = 'Obese'
        category_color = 'danger'
    
    return jsonify({
        'bmi': bmi,
        'category': category,
        'category_color': category_color
    })

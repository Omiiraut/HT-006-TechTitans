"""Flask application entry point."""
import os
from flask import Flask
from dotenv import load_dotenv
import google.generativeai as genai
from backend.database import init_db

load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY', '').strip())


def create_app():
    """Application factory."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app = Flask(__name__,
                template_folder=os.path.join(base_dir, 'templates'),
                static_folder=os.path.join(base_dir, 'static'))
    app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max

    # Initialize database
    with app.app_context():
        init_db()

    # Register blueprints
    from backend.routes import auth_bp, main_bp, api_bp
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')

    return app


app = create_app()


if __name__ == '__main__':
    app.run(debug=True, port=5000)

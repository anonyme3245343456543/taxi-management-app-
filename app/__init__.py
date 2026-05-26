import os
from datetime import timedelta

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from .auth import auth_bp
from .booking import booking_bp
from .clients import clients_bp
from .appointments import appointments_bp
from .db import close_db, ensure_schema, get_db
from .stats import stats_bp


def _is_production():
    return bool(
        os.environ.get("FLASK_ENV") == "production"
        or os.environ.get("RAILWAY_ENVIRONMENT")
        or os.environ.get("RAILWAY_PROJECT_ID")
    )


def create_app():
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    production = _is_production()
    app.config.update(
        SECRET_KEY=os.environ.get("SECRET_KEY", os.urandom(32)),
        MAX_CONTENT_LENGTH=int(os.environ.get("MAX_CONTENT_LENGTH", "16384")),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=production,
        PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
        JSON_SORT_KEYS=False,
        PROPAGATE_EXCEPTIONS=False,
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(booking_bp)
    app.register_blueprint(clients_bp)
    app.register_blueprint(appointments_bp)
    app.register_blueprint(stats_bp)
    app.teardown_appcontext(close_db)

    app.config["SCHEMA_READY"] = False

    def prepare_schema():
        if app.config["SCHEMA_READY"]:
            return
        ensure_schema()
        app.config["SCHEMA_READY"] = True

    with app.app_context():
        try:
            prepare_schema()
        except Exception as exc:
            app.logger.warning("Database schema check skipped: %s", exc)

    @app.before_request
    def ensure_schema_before_data_routes():
        if request.path.startswith("/api/") and not request.path.startswith("/api/auth/"):
            prepare_schema()

    @app.after_request
    def set_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self'; "
            "img-src 'self' data: https://images.unsplash.com; "
            "connect-src 'self' https://photon.komoot.io https://router.project-osrm.org; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "frame-ancestors 'none'",
        )
        if production:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    @app.get("/")
    def index():
        return render_template("book.html")

    @app.get("/book")
    def book_page():
        return render_template("book.html")

    @app.get("/admin")
    def admin_page():
        return render_template("admin.html")

    @app.get("/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/debug-db")
    def debug_db():
        try:
            prepare_schema()
            db = get_db()
            with db.cursor() as cur:
                cur.execute("select current_database(), current_user, version()")
                database_info = cur.fetchone()
                cur.execute(
                    """
                    select table_name
                    from information_schema.tables
                    where table_schema = 'public'
                    order by table_name
                    """
                )
                tables = [row["table_name"] for row in cur.fetchall()]
            return jsonify(
                {
                    "status": "connected",
                    "database": database_info["current_database"],
                    "user": database_info["current_user"],
                    "postgres": database_info["version"],
                    "tables": tables,
                }
            )
        except Exception as exc:
            app.logger.warning("Debug database check failed: %s", exc)
            return jsonify({"status": "error", "message": "Database connection failed"}), 500

    @app.get("/favicon.ico")
    def favicon():
        return send_from_directory(app.static_folder, "favicon.svg", mimetype="image/svg+xml")

    @app.errorhandler(413)
    def request_too_large(_error):
        app.logger.warning("Request too large path=%s ip=%s", request.path, request.remote_addr)
        return jsonify({"error": "Request too large"}), 413

    @app.errorhandler(HTTPException)
    def handle_http_error(error):
        if request.path.startswith("/api/"):
            return jsonify({"error": error.description or error.name}), error.code
        return error

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        app.logger.exception("Unhandled request error path=%s", request.path)
        if request.path.startswith("/api/") or request.path in {"/health", "/debug-db"}:
            return jsonify({"error": "An unexpected error occurred"}), 500
        return "An unexpected error occurred", 500

    return app

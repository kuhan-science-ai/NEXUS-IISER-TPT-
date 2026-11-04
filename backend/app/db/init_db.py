from datetime import datetime, timezone
import json
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from backend.app.db.base import Base
from backend.app.db.session import sync_engine, SyncSessionLocal
from backend.app.models import (
    User,
    UserProfile,
    UserSettings,
    UserRole,
    Course,
    ForumPost,
    DailyQuestion,
)
from backend.app.core.security import get_password_hash

def init_db(db: Session) -> None:
    # Create all tables on sync engine
    Base.metadata.create_all(bind=sync_engine)
    # Additive migration for already-created local databases; create_all does not
    # add columns to an existing table.
    if "parent_id" not in {column["name"] for column in inspect(sync_engine).get_columns("ai_conversations")}:
        with sync_engine.begin() as connection:
            connection.execute(text(
                "ALTER TABLE ai_conversations ADD COLUMN parent_id VARCHAR(36) "
                "REFERENCES ai_conversations(id) ON DELETE CASCADE"
            ))
    if "points" not in {column["name"] for column in inspect(sync_engine).get_columns("daily_questions")}:
        with sync_engine.begin() as connection:
            connection.execute(text("ALTER TABLE daily_questions ADD COLUMN points INTEGER NOT NULL DEFAULT 10"))

    # 1. Seed Demo Accounts
    demo_users = [
        {
            "username": "student1",
            "email": "student1@iisertirupati.ac.in",
            "password": "NexusPass123!",
            "role": UserRole.STUDENT,
            "full_name": "Arjun Sharma",
            "bio": "3rd Year BS-MS Physics Major at IISER Tirupati. Researching quantum optics.",
            "program": "BS-MS",
            "academic_year": "3rd Year",
            "department": "Physics",
            "status_text": "Working on quantum harmonic oscillators 🔬",
        },
        {
            "username": "moderator1",
            "email": "moderator1@iisertirupati.ac.in",
            "password": "NexusPass123!",
            "role": UserRole.MODERATOR,
            "full_name": "Priya Raman",
            "bio": "4th Year BS-MS Biology. Academic Forum Moderator & Peer Mentor.",
            "program": "BS-MS",
            "academic_year": "4th Year",
            "department": "Biology",
            "status_text": "Available for peer review and genetics questions 🧬",
        },
        {
            "username": "admin",
            "email": "admin@iisertirupati.ac.in",
            "password": "NexusAdmin123!",
            "role": UserRole.ADMINISTRATOR,
            "full_name": "NEXUS Administrator",
            "bio": "IISER Tirupati System Administrator & Academic Affairs Coordinator.",
            "program": "Administration",
            "academic_year": "Staff",
            "department": "Academic Computing & Affairs",
            "status_text": "NEXUS Core Systems Operational ✅",
        },
    ]

    for u_data in demo_users:
        existing = db.query(User).filter(User.username == u_data["username"]).first()
        if not existing:
            user = User(
                username=u_data["username"],
                email=u_data["email"],
                hashed_password=get_password_hash(u_data["password"]),
                role=u_data["role"],
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.flush()

            profile = UserProfile(
                user_id=user.id,
                full_name=u_data["full_name"],
                display_name=u_data["full_name"],
                bio=u_data["bio"],
                program=u_data["program"],
                academic_year=u_data["academic_year"],
                department=u_data["department"],
                status_text=u_data["status_text"],
            )
            settings = UserSettings(
                user_id=user.id,
                email_notifications=True,
                sound_enabled=True,
                last_seen_privacy="everyone",
            )
            db.add(profile)
            db.add(settings)

    # 2. Seed Initial IISER Tirupati Courses
    sample_courses = [
        {
            "code": "BIO111",
            "name": "Cellular and Molecular Biology",
            "department": "Biology",
            "description": "Fundamental organization of cell structure, macromolecular synthesis, and cellular energetics.",
            "semester": "Monsoon",
            "academic_year": "2026-2027",
            "faculty_name": "Dr. Sucharita Roy",
            "credits": 3,
        },
        {
            "code": "CHM121",
            "name": "Physical Principles of Chemistry",
            "department": "Chemistry",
            "description": "Thermodynamics, chemical equilibria, reaction kinetics, and electrochemistry.",
            "semester": "Monsoon",
            "academic_year": "2026-2027",
            "faculty_name": "Prof. S. Narayanan",
            "credits": 3,
        },
        {
            "code": "PHY201",
            "name": "Quantum Mechanics I",
            "department": "Physics",
            "description": "Schrödinger equation, operators in Hilbert space, harmonic oscillator, and hydrogen atom.",
            "semester": "Monsoon",
            "academic_year": "2026-2027",
            "faculty_name": "Dr. V. Prasad",
            "credits": 4,
        },
        {
            "code": "MTH311",
            "name": "Real Analysis and Metric Spaces",
            "department": "Mathematics",
            "description": "Topology of Euclidean spaces, metric spaces, convergence of sequences, continuity, and compactness.",
            "semester": "Monsoon",
            "academic_year": "2026-2027",
            "faculty_name": "Dr. K. Ananth",
            "credits": 4,
        },
    ]

    for c_data in sample_courses:
        c_exist = db.query(Course).filter(Course.code == c_data["code"]).first()
        if not c_exist:
            course = Course(**c_data)
            db.add(course)

    # 3. Seed Initial Forum Post with LaTeX Math
    admin_user = db.query(User).filter(User.username == "admin").first()
    if admin_user:
        post_exist = db.query(ForumPost).first()
        if not post_exist:
            sample_post = ForumPost(
                title="Welcome to NEXUS: Scientific Discussion & Mathematical Proofs",
                content_latex="Welcome to the NEXUS academic forum! You can write standard LaTeX expressions inline such as $E = mc^2$ or $\\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0 \\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}$, as well as display mathematics:\n$$\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\nLet's test wave functions: $\\Psi(x, t) = A e^{i(kx - \\omega t)}$. Share your insights and academic queries here!",
                category="Physics",
                author_id=admin_user.id,
                upvotes=15,
                downvotes=0,
                is_pinned=True,
            )
            db.add(sample_post)

        # 4. Seed Daily Question (QOTD)
        qotd_exist = db.query(DailyQuestion).first()
        if not qotd_exist:
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            qotd = DailyQuestion(
                date=today_str,
                category="Physics",
                question_latex="Calculate the ground state energy eigenvalue $E_0$ of a one-dimensional quantum harmonic oscillator with Hamiltonian $\\hat{H} = \\frac{\\hat{p}^2}{2m} + \\frac{1}{2}m\\omega^2 \\hat{x}^2$.",
                explanation_latex="The energy eigenvalues are given by $E_n = \\hbar\\omega\\left(n + \\frac{1}{2}\\right)$. For the ground state $n = 0$, $E_0 = \\frac{1}{2}\\hbar\\omega$, representing zero-point energy due to the Heisenberg uncertainty principle.",
                options_json=json.dumps([
                    r"$E_0 = \frac{1}{2}\hbar\omega$",
                    r"$E_0 = \hbar\omega$",
                    r"$E_0 = 0$",
                    r"$E_0 = \frac{3}{2}\hbar\omega$",
                ]),
            )
            db.add(qotd)

    db.commit()

if __name__ == "__main__":
    db = SyncSessionLocal()
    try:
        init_db(db)
        print("NEXUS database successfully initialized and seeded with demo accounts.")
    finally:
        db.close()

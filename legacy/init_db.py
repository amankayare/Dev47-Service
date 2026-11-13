from app import app
from models import db, User, Project, Blog, About, Certification, Tag, Author, Experience, TechnicalSkill, BlogCategory
from datetime import datetime, date

def init_db():
    """Initialize database with tables and sample data"""
    with app.app_context():
        # Drop and recreate all tables
        db.drop_all()
        db.create_all()
        
        # Create default admin user
        admin_user = User(
            username='admin',
            email='admin@portfolio.com',
            is_admin=True
        )
        admin_user.set_password('admin123')  # Change this in production
        db.session.add(admin_user)

        # Add 20 test users for pagination
        for i in range(1, 21):
            user = User(
                username=f'testuser{i}',
                email=f'testuser{i}@example.com',
                is_admin=False
            )
            user.set_password('test123')
            db.session.add(user)
        
        # Create sample author
        author = Author(
            name='Aman Kayare',
            email='aman@example.com'
        )
        db.session.add(author)
        
        # Create sample tags
        tags = [
            Tag(name='React'),
            Tag(name='Python'),
            Tag(name='Flask'),
            Tag(name='Machine Learning'),
            Tag(name='Web Development'),
            Tag(name='API Design'),
            Tag(name='Database'),
            Tag(name='DevOps')
        ]
        for tag in tags:
            db.session.add(tag)
        
        db.session.flush()  # Get IDs for relationships
        
        # Create sample about information
        about = About(
            name='Aman Kayare',
            headline='Full Stack Developer & Tech Enthusiast',
            bio='I am a passionate full-stack developer with expertise in modern web technologies. I love building scalable applications and exploring new technologies.',
            location='India',
            email='aman@example.com',
            phone='+91-XXXXXXXXXX',
            social_links={
                'github': 'https://github.com/username',
                'linkedin': 'https://linkedin.com/in/username',
                'twitter': 'https://twitter.com/username'
            }
        )
        db.session.add(about)
        
        # Create sample projects
        projects = [
            Project(
                title='Personal Portfolio Website',
                description='A modern, responsive portfolio website built with React and Flask. Features include dark/light themes, admin panel, and content management system.',
                tech=['React', 'TypeScript', 'Flask', 'SQLAlchemy', 'Tailwind CSS'],
                links=[
                    {'name': 'Live Demo', 'url': 'https://portfolio.example.com'},
                    {'name': 'GitHub', 'url': 'https://github.com/username/portfolio'}
                ],
                project_type='Personal',
                start_date=date(2024, 1, 1),
                end_date=date(2024, 12, 31),
                role='Full Stack Developer',
                team_size=1,
                categories=['Web Development', 'Full Stack'],
                is_visible=True,
                order=1
            ),
            Project(
                title='E-Commerce API',
                description='RESTful API for an e-commerce platform with authentication, product management, and order processing.',
                tech=['Python', 'Flask', 'PostgreSQL', 'JWT', 'Swagger'],
                links=[
                    {'name': 'GitHub', 'url': 'https://github.com/username/ecommerce-api'},
                    {'name': 'API Docs', 'url': 'https://api.example.com/docs'}
                ],
                project_type='Professional',
                start_date=date(2023, 6, 1),
                end_date=date(2023, 12, 31),
                role='Backend Developer',
                team_size=3,
                categories=['API Development', 'Backend'],
                is_visible=True,
                order=2
            )
        ]
        for project in projects:
            db.session.add(project)

        # Create sample blog category
        category_web = BlogCategory(name='Tech')
        db.session.add(category_web)
        db.session.flush()  # Get category_web.id

        # Create sample blog category
        category_life = BlogCategory(name='Life')
        db.session.add(category_life)
        db.session.flush()  # Get category_life.id
        
        # Create sample blog posts
        blogs = [
            Blog(
                title='Building Modern Web Applications with React and Flask',
                excerpt='Learn how to create a full-stack application using React for the frontend and Flask for the backend. This comprehensive guide covers everything from setup to deployment.',
                content='''
                <div class="blog-content-container">
                    <style>
                        .blog-content-container {
                            --main-text: #222;
                            --heading: #1450a3;
                            --heading2: #1e62d0;
                            --link: #2779bd;
                            --code-bg: #f1f5f9;
                            --code-text: #334155;
                            --pre-bg: #222;
                            --pre-text: #d7ffd7;
                        --card-bg1: #e9f0fa;
                        --card-bg2: #e8f7f2;
                        --card-bg3: #fffbe8;
                        --card-bg4: #f2e8fa;
                        --blockquote-bg: #f8fafc;
                        --blockquote-border: #1e62d0;
                        --link: #2779bd;
                        --pre-bg1: #222;
                        --pre-txt1: #d7ffd7;
                        --pre-txt2: #ffe7ba;
                        --pre-txt3: #b7e3ff;
                        --code-bg: #f1f5f9;
                        --code-text: #334155;
                        
                        /* Base container styling */
                        color: var(--main-text);
                        padding: 2em 1.5em;
                        border-radius: 12px;
                        transition: all 0.3s ease;
                        max-width: 100%;
                        overflow: hidden;
                        isolation: isolate; /* Create new stacking context */
                        }

                        /* Dark theme - CSS custom properties approach */
                        @media (prefers-color-scheme: dark) {
                        .blog-content-container {
                            --main-text: #dee6ef;
                            --heading: #8bb0f9;
                            --heading2: #65aaff;
                            --react: #ffb3b3;
                            --flask: #a5eecf;
                            --card-bg1: #27364b;
                            --card-bg2: #193d37;
                            --card-bg3: #41402e;
                            --card-bg4: #3d3044;
                            --blockquote-bg: #222a33;
                            --blockquote-border: #65aaff;
                            --link: #7ec3ff;
                            --pre-bg1: #161b22;
                            --pre-txt1: #7fffbc;
                            --pre-txt2: #ffe7ba;
                            --pre-txt3: #67c4ff;
                            --code-bg: #1e293b;
                            --code-text: #cbd5e1;
                        }
                        }

                        /* Theme class-based approach for manual toggle */
                        .dark .blog-content-container {
                        --main-text: #dee6ef;
                        --heading: #8bb0f9;
                        --heading2: #65aaff;
                        --react: #ffb3b3;
                        --flask: #a5eecf;
                        --card-bg1: #27364b;
                        --card-bg2: #193d37;
                        --card-bg3: #41402e;
                        --card-bg4: #3d3044;
                        --blockquote-bg: #222a33;
                        --blockquote-border: #65aaff;
                        --link: #7ec3ff;
                        --pre-bg1: #161b22;
                        --pre-txt1: #7fffbc;
                        --pre-txt2: #ffe7ba;
                        --pre-txt3: #67c4ff;
                        --code-bg: #1e293b;
                        --code-text: #cbd5e1;
                        }

                        .blog-content-container h1, 
                        .blog-content-container h2, 
                        .blog-content-container h3 {
                        color: var(--heading);
                        margin-top: 0;
                        margin-bottom: 0.5em;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container h1 {
                        font-size: 2.6rem;
                        font-weight: bold;
                        color: var(--heading);
                        letter-spacing: -2px;
                        }
                        .blog-content-container h2 {
                        color: var(--heading2);
                        font-size: 2rem;
                        margin-bottom: 0.4em;
                        }
                        .blog-content-container h3 {
                        font-size: 1.2rem;
                        font-weight: 600;
                        }
                        
                        .blog-content-container a { 
                        color: var(--link); 
                        transition: all 0.2s ease;
                        }
                        .blog-content-container a:hover { 
                        text-decoration: underline; 
                        opacity: 0.8;
                        }
                        
                        .blog-content-container code {
                        background: var(--code-bg);
                        color: var(--code-text);
                        padding: 0.2em 0.4em;
                        border-radius: 4px;
                        font-size: 0.9em;
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                        transition: all 0.3s ease;
                        }
                        
                        .blog-content-container pre {
                        background: var(--pre-bg1);
                        color: var(--pre-txt1);
                        border-radius: 8px;
                        padding: 1.2em;
                        font-size: 0.95em;
                        overflow-x: auto;
                        margin: 1em 0;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        }
                        .blog-content-container pre code {
                        background: none;
                        color: inherit;
                        padding: 0;
                        font-size: inherit;
                        }
                        
                        .blog-content-container ul, 
                        .blog-content-container ol { 
                        margin-left: 1.5em;
                        line-height: 1.6;
                        }
                        .blog-content-container li {
                        margin-bottom: 0.3em;
                        }
                        
                        .blog-content-container blockquote {
                        background: var(--blockquote-bg);
                        border-left: 4px solid var(--blockquote-border);
                        padding: 1.2em 1.6em;
                        border-radius: 8px;
                        color: var(--main-text);
                        margin: 1.5em 0;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                        transition: all 0.3s ease;
                        }
                        
                        .blog-content-container .card-group {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 2em;
                        margin: 1.5em 0;
                        }
                        .blog-content-container .card {
                        flex: 1 1 270px;
                        border-radius: 12px;
                        padding: 1.5em;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        .blog-content-container .card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .card.react { background: var(--card-bg1); }
                        .blog-content-container .card.flask { background: var(--card-bg2); }
                        
                        .blog-content-container .partnership {
                        background: var(--card-bg3);
                        border-radius: 12px;
                        padding: 1.6em;
                        color: var(--main-text);
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .best-practices {
                        display: flex; 
                        flex-wrap: wrap; 
                        gap: 1.5em;
                        margin: 1.5em 0;
                        }
                        .blog-content-container .best-practices .practice {
                        flex: 1 1 240px; 
                        border-radius: 10px; 
                        padding: 1.2em;
                        box-shadow: 0 3px 5px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        .blog-content-container .best-practices .practice:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 5px 10px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .best-practices .api { background: var(--card-bg1); }
                        .blog-content-container .best-practices .security { background: var(--card-bg2); }
                        .blog-content-container .best-practices .testing { background: var(--card-bg3); }
                        .blog-content-container .best-practices .deploy { background: var(--card-bg4); }
                        
                        /* Responsive design */
                        @media (max-width: 700px) {
                        .blog-content-container { 
                            padding: 1.5em 1em; 
                            border-radius: 8px;
                        }
                        .blog-content-container .card-group, 
                        .blog-content-container .best-practices { 
                            flex-direction: column; 
                            gap: 1em;
                        }
                        .blog-content-container h1 {
                            font-size: 2.2rem;
                            letter-spacing: -1px;
                        }
                        .blog-content-container h2 {
                            font-size: 1.8rem;
                        }
                        }
                        
                        /* Theme-specific text colors */
                        .blog-content-container .react { 
                        color: var(--react);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .flask { 
                        color: var(--flask);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }

                        /* Smooth transitions for theme changes - scoped to container */
                        .blog-content-container * {
                        transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
                        }
                    </style>

                    <div style="text-align: center; margin-bottom: 2.5em;">
                        <h1>
                        🚀 Building Modern Web Applications with <span class="react">React</span> &amp; <span class="flask">Flask</span>
                        </h1>
                        <p style="font-size: 1.25rem; max-width: 650px; margin: 0 auto; color: var(--main-text);">
                        Discover how to combine the power of <strong>React</strong> for dynamic, responsive interfaces and <strong>Flask</strong> for a flexible, robust backend. 
                        Build web apps that are not just functional, but beautiful and scalable.
                        </p>
                    </div>

                    <section style="margin-bottom: 2.2em;">
                        <h2>✨ Why React and Flask?</h2>
                        <div class="card-group">
                        <div class="card react">
                            <h3 class="react">React: The Frontend Powerhouse</h3>
                            <ul>
                            <li><b>Component-based:</b> Modular, reusable UI pieces</li>
                            <li><b>Fast Rendering:</b> Virtual DOM for speed</li>
                            <li><b>Rich Ecosystem:</b> Tons of libraries &amp; tools</li>
                            </ul>
                        </div>
                        <div class="card flask">
                            <h3 class="flask">Flask: Lightweight, Yet Powerful</h3>
                            <ul>
                            <li><b>Minimal &amp; Flexible:</b> No unnecessary bloat</li>
                            <li><b>Extensible:</b> Add what you need, when you need it</li>
                            <li><b>Pythonic:</b> Clean, readable code</li>
                            </ul>
                        </div>
                        </div>
                    </section>

                    <section style="margin-bottom: 2.2em;">
                        <h2>🤝 Perfect Partnership</h2>
                        <div class="partnership">
                        <p>
                            By using <span class="react"><b>React</b></span> for the frontend and <span class="flask"><b>Flask</b></span> for the backend, you get the best of both worlds:
                        </p>
                        <ul>
                            <li>Build beautiful and interactive UIs separated from backend logic</li>
                            <li>Develop & deploy frontend and backend independently</li>
                            <li>Scale effortlessly as your project grows</li>
                        </ul>
                        </div>
                    </section>

                    <section style="margin-bottom:2.2em;">
                        <h2>🛠️ Quickstart: Your First React + Flask App</h2>
                        <div style="background:var(--card-bg1); border-radius:10px; padding:1.2em;">
                        <h3 style="color:var(--heading2); margin-bottom:0.5em;">1. Set Up Flask Backend</h3>
                        <p style="margin-bottom:0.2em;">Create a Python virtual environment and install Flask:</p>
                        <pre style="color:var(--pre-txt1);">
                    mkdir react-flask-app
                    cd react-flask-app
                    python3 -m venv venv
                    source venv/bin/activate
                    pip install flask flask-cors
                        </pre>
                        <p style="margin-bottom:0.2em;">Make a simple <b>app.py</b>:</p>
                        <pre style="color:var(--pre-txt2);">
                    from flask import Flask, jsonify
                    from flask_cors import CORS

                    app = Flask(__name__)
                    CORS(app)

                    @app.route('/api/greet')
                    def greet():
                        return jsonify({'message': 'Hello from Flask!'})

                    if __name__ == '__main__':
                        app.run(debug=True)
                        </pre>
                        <p>Run your Flask app with <code>python app.py</code></p>

                        <h3 style="color:var(--heading2); margin-top:1.3em; margin-bottom:0.5em;">2. Set Up React Frontend</h3>
                        <p>In a new terminal, start your React app:</p>
                        <pre style="color:var(--pre-txt1);">
                    npx create-react-app client
                    cd client
                    npm start
                        </pre>
                        <p>Replace <b>src/App.js</b> with:</p>
                        <pre style="color:var(--pre-txt3);">
                    import React, { useEffect, useState } from 'react';

                    function App() {
                    const [greeting, setGreeting] = useState('');

                    useEffect(() => {
                        fetch('http://localhost:5000/api/greet')
                        .then(res => res.json())
                        .then(data => setGreeting(data.message));
                    }, []);

                    return (
                        &lt;div style=&#123;{ textAlign: "center" }&#125;&gt;
                        &lt;h1&gt;React + Flask Demo&lt;/h1&gt;
                        &lt;p&gt;{greeting}&lt;/p&gt;
                        &lt;/div&gt;
                    );
                    }

                    export default App;
                        </pre>
                        <p>
                            <span class="flask" style="font-weight:500;">✨ Now, your React app shows a Flask-powered greeting!</span>
                        </p>
                        </div>
                    </section>

                    <section style="margin-bottom:2.2em;">
                        <h2 class="react">🌱 Best Practices for Modern Apps</h2>
                        <div class="best-practices">
                        <div class="practice api"><b>🔗 API Design:</b> Use REST or GraphQL, with clear error messages.</div>
                        <div class="practice security"><b>🔒 Security:</b> Use JWT/OAuth, never expose secrets in frontend.</div>
                        <div class="practice testing"><b>🧪 Testing:</b> Write tests for both Flask (<code>pytest</code>) and React (Jest).</div>
                        <div class="practice deploy"><b>🚢 Deployment:</b> Deploy separately (Vercel/Heroku) or serve React from Flask for smaller projects.</div>
                        </div>
                    </section>

                    <section style="margin-bottom:2.2em;">
                        <h2>🏗️ Advanced Tips</h2>
                        <ul style="font-size:1.07em;">
                        <li><b>State Management:</b> Use React Context or Redux for complex state.</li>
                        <li><b>Database Integration:</b> Try Flask-SQLAlchemy for robust DB support.</li>
                        <li><b>Async Tasks:</b> Use Celery for background jobs in Flask.</li>
                        <li><b>Real-time:</b> Add Flask-SocketIO + React for live features.</li>
                        </ul>
                    </section>

                    <section>
                        <h2>🎉 Conclusion</h2>
                        <blockquote>
                        <b>React &amp; Flask</b> let you build fast, resilient, and delightful web apps. 
                        <br/>Start simple, scale as you grow, and empower your users with seamless experiences!
                        </blockquote>
                        <div style="margin-top:2em;">
                        <b class="flask">Further Reading:</b>
                        <ul>
                            <li><a href="https://react.dev/" target="_blank">React Documentation</a></li>
                            <li><a href="https://flask.palletsprojects.com/" target="_blank">Flask Documentation</a></li>
                            <li><a href="https://create-react-app.dev/" target="_blank">Create React App</a></li>
                            <li><a href="https://testdriven.io/blog/deploying-react-with-flask/" target="_blank">Deploying Flask and React</a></li>
                        </ul>
                        </div>
                    </section>
                    </div>

                ''',
                date=datetime(2024, 11, 15),
                reading_time=8,
                featured=True,
                is_visible=True,
                author=author,
                category=category_web,
                tags=[tags[0], tags[2], tags[4]],  # React, Flask, Web Development
                cover_image='https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=400&fit=crop'
            ),
            Blog(
                title='Mastering Python for Data Science and Machine Learning',
                excerpt='A comprehensive guide to Python libraries and techniques for data science and machine learning. Perfect for beginners and intermediate developers looking to expand their skills.',
                content='''
                                    
                <div class="blog-content-container" style="padding: 20px; max-width: 900px; margin: 0 auto;">
                    <style>
                        .blog-content-container {
                        /* Light theme variables - scoped to this container only */
                        --main-text: #222;
                        --heading: #1450a3;
                        --heading2: #1e62d0;
                        --python: #3776ab;
                        --data-science: #ff6b35;
                        --ml: #4caf50;
                        --pandas: #150458;
                        --numpy: #013243;
                        --matplotlib: #11557c;
                        --card-bg1: #e3f2fd;
                        --card-bg2: #fff3e0;
                        --card-bg3: #e8f5e8;
                        --card-bg4: #f3e5f5;
                        --card-bg5: #fce4ec;
                        --card-bg6: #e0f2f1;
                        --blockquote-bg: #f8fafc;
                        --blockquote-border: #1e62d0;
                        --link: #2779bd;
                        --pre-bg1: #222;
                        --pre-txt1: #d7ffd7;
                        --pre-txt2: #ffe7ba;
                        --pre-txt3: #b7e3ff;
                        --code-bg: #f1f5f9;
                        --code-text: #334155;
                        --warning-bg: #fff8e1;
                        --warning-border: #ffb300;
                        --info-bg: #e3f2fd;
                        --info-border: #2196f3;
                        
                        /* Base container styling */
                        color: var(--main-text);
                        padding: 1em 0.75em;
                        border-radius: 8px;
                        transition: all 0.3s ease;
                        max-width: 100%;
                        overflow: hidden;
                        isolation: isolate;
                        }

                        /* Dark theme - CSS custom properties approach */
                        @media (prefers-color-scheme: dark) {
                        .blog-content-container {
                            --main-text: #dee6ef;
                            --heading: #8bb0f9;
                            --heading2: #65aaff;
                            --python: #4b9cd3;
                            --data-science: #ff8a50;
                            --ml: #81c784;
                            --pandas: #7986cb;
                            --numpy: #4dd0e1;
                            --matplotlib: #42a5f5;
                            --card-bg1: #1e3a5f;
                            --card-bg2: #3e2723;
                            --card-bg3: #2e5266;
                            --card-bg4: #4a148c;
                            --card-bg5: #880e4f;
                            --card-bg6: #00695c;
                            --blockquote-bg: #222a33;
                            --blockquote-border: #65aaff;
                            --link: #7ec3ff;
                            --pre-bg1: #161b22;
                            --pre-txt1: #7fffbc;
                            --pre-txt2: #ffe7ba;
                            --pre-txt3: #67c4ff;
                            --code-bg: #1e293b;
                            --code-text: #cbd5e1;
                            --warning-bg: #2d2006;
                            --warning-border: #ffb300;
                            --info-bg: #0d2744;
                            --info-border: #2196f3;
                        }
                        }

                        /* Theme class-based approach for manual toggle */
                        .dark .blog-content-container {
                        --main-text: #dee6ef;
                        --heading: #8bb0f9;
                        --heading2: #65aaff;
                        --python: #4b9cd3;
                        --data-science: #ff8a50;
                        --ml: #81c784;
                        --pandas: #7986cb;
                        --numpy: #4dd0e1;
                        --matplotlib: #42a5f5;
                        --card-bg1: #1e3a5f;
                        --card-bg2: #3e2723;
                        --card-bg3: #2e5266;
                        --card-bg4: #4a148c;
                        --card-bg5: #880e4f;
                        --card-bg6: #00695c;
                        --blockquote-bg: #222a33;
                        --blockquote-border: #65aaff;
                        --link: #7ec3ff;
                        --pre-bg1: #161b22;
                        --pre-txt1: #7fffbc;
                        --pre-txt2: #ffe7ba;
                        --pre-txt3: #67c4ff;
                        --code-bg: #1e293b;
                        --code-text: #cbd5e1;
                        --warning-bg: #2d2006;
                        --warning-border: #ffb300;
                        --info-bg: #0d2744;
                        --info-border: #2196f3;
                        }

                        .blog-content-container h1, 
                        .blog-content-container h2, 
                        .blog-content-container h3 {
                        color: var(--heading);
                        margin-top: 0;
                        margin-bottom: 0.5em;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container h1 {
                        font-size: 1.75rem;
                        font-weight: bold;
                        color: var(--heading);
                        letter-spacing: -0.5px;
                        }
                        .blog-content-container h2 {
                        color: var(--heading2);
                        font-size: 1.4rem;
                        margin-bottom: 0.3em;
                        }
                        .blog-content-container h3 {
                        font-size: 1.1rem;
                        font-weight: 600;
                        }
                        
                        .blog-content-container a { 
                        color: var(--link); 
                        transition: all 0.2s ease;
                        }
                        .blog-content-container a:hover { 
                        text-decoration: underline; 
                        opacity: 0.8;
                        }
                        
                        .blog-content-container code {
                        background: var(--code-bg);
                        color: var(--code-text);
                        padding: 0.2em 0.4em;
                        border-radius: 4px;
                        font-size: 0.9em;
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                        transition: all 0.3s ease;
                        }
                        
                        .blog-content-container pre {
                        background: var(--pre-bg1);
                        color: var(--pre-txt1);
                        border-radius: 6px;
                        padding: 0.75em;
                        font-size: 0.85em;
                        overflow-x: auto;
                        margin: 0.75em 0;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        }
                        .blog-content-container pre code {
                        background: none;
                        color: inherit;
                        padding: 0;
                        font-size: inherit;
                        }
                        
                        .blog-content-container ul, 
                        .blog-content-container ol { 
                        margin-left: 1.5em;
                        line-height: 1.6;
                        }
                        .blog-content-container li {
                        margin-bottom: 0.3em;
                        }
                        
                        .blog-content-container blockquote {
                        background: var(--blockquote-bg);
                        border-left: 3px solid var(--blockquote-border);
                        padding: 0.75em 1em;
                        border-radius: 6px;
                        color: var(--main-text);
                        margin: 1em 0;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                        transition: all 0.3s ease;
                        }
                        
                        .blog-content-container .hero-section {
                        text-align: center;
                        margin-bottom: 1.5em;
                        padding: 1em 0.5em;
                        border-radius: 10px;
                        position: relative;
                        }
                        
                        .blog-content-container .feature-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                        gap: 1em;
                        margin: 1em 0;
                        }
                        
                        .blog-content-container .feature-card {
                        background: var(--card-bg1);
                        border-radius: 10px;
                        padding: 1em;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        position: relative;
                        overflow: hidden;
                        }
                        
                        .blog-content-container .feature-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .feature-card.python { background: var(--card-bg1); }
                        .blog-content-container .feature-card.community { background: var(--card-bg2); }
                        .blog-content-container .feature-card.versatility { background: var(--card-bg3); }
                        .blog-content-container .feature-card.integration { background: var(--card-bg4); }
                        
                        .blog-content-container .library-showcase {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 1em;
                        margin: 1em 0;
                        }
                        
                        .blog-content-container .library-card {
                        border-radius: 8px;
                        padding: 1em;
                        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .library-card:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .library-card.numpy { background: var(--card-bg1); }
                        .blog-content-container .library-card.pandas { background: var(--card-bg2); }
                        .blog-content-container .library-card.visualization { background: var(--card-bg3); }
                        
                        .blog-content-container .ml-frameworks {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 0.75em;
                        margin: 1em 0;
                        }
                        
                        .blog-content-container .framework-badge {
                        flex: 1 1 180px;
                        background: var(--card-bg5);
                        border-radius: 8px;
                        padding: 0.75em;
                        text-align: center;
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .framework-badge:hover {
                        transform: scale(1.05);
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .best-practices-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                        gap: 1em;
                        margin: 1em 0;
                        }
                        
                        .blog-content-container .practice-card {
                        border-radius: 8px;
                        padding: 1em;
                        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .practice-card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .practice-card.structure { background: var(--card-bg1); }
                        .blog-content-container .practice-card.quality { background: var(--card-bg2); }
                        
                        .blog-content-container .roadmap {
                        background: var(--card-bg6);
                        border-radius: 10px;
                        padding: 1.25em;
                        margin: 1em 0;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .roadmap-steps {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 1em;
                        margin-top: 1.5em;
                        }
                        
                        .blog-content-container .step {
                        background: rgba(255, 255, 255, 0.7);
                        padding: 1em;
                        border-radius: 8px;
                        text-align: center;
                        font-weight: 600;
                        transition: all 0.3s ease;
                        }
                        
                        .blog-content-container .step:hover {
                        background: rgba(255, 255, 255, 0.9);
                        transform: translateY(-2px);
                        }
                        
                        .blog-content-container .info-box {
                        background: var(--info-bg);
                        border-left: 3px solid var(--info-border);
                        padding: 0.75em 1em;
                        border-radius: 6px;
                        margin: 0.75em 0;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        }
                        
                        .blog-content-container .warning-box {
                        background: var(--warning-bg);
                        border-left: 3px solid var(--warning-border);
                        padding: 0.75em 1em;
                        border-radius: 6px;
                        margin: 0.75em 0;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        }
                        
                        /* Responsive design */
                        @media (max-width: 700px) {
                        .blog-content-container { 
                            padding: 0.75em 0.5em; 
                            border-radius: 6px;
                        }
                        .blog-content-container .feature-grid,
                        .blog-content-container .library-showcase,
                        .blog-content-container .best-practices-grid { 
                            grid-template-columns: 1fr;
                            gap: 1em;
                        }
                        .blog-content-container .ml-frameworks {
                            flex-direction: column;
                        }
                        .blog-content-container h1 {
                            font-size: 1.5rem;
                            letter-spacing: -0.5px;
                        }
                        .blog-content-container h2 {
                            font-size: 1.25rem;
                        }
                        }
                        
                        /* Theme-specific text colors */
                        .blog-content-container .python { 
                        color: var(--python);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .data-science { 
                        color: var(--data-science);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .ml { 
                        color: var(--ml);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .pandas { 
                        color: var(--pandas);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .numpy { 
                        color: var(--numpy);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .matplotlib { 
                        color: var(--matplotlib);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }

                        /* Smooth transitions for theme changes - scoped to container */
                        .blog-content-container * {
                        transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
                        }
                    </style>

                    <h1>Mastering Python for Data Science & Machine Learning</h1>
                    
                    <p>Python has emerged as the leading programming language for data science and machine learning. Its clean syntax, extensive libraries, and vibrant community make it the ideal choice for data professionals.</p>

                    <h2>Why Python Dominates Data Science</h2>
                    
                    <p>Python's success in data science stems from several key factors. The language offers a perfect balance between simplicity and power, allowing developers to focus on solving problems rather than dealing with complex syntax. Its readable code structure makes collaboration seamless and reduces the learning curve for newcomers.</p>

                    <p>The Python ecosystem includes specialized libraries for every stage of the data science pipeline, from data collection and cleaning to advanced machine learning algorithms. This comprehensive toolkit, combined with cross-platform compatibility, makes Python versatile enough to handle projects of any scale.</p>

                    <h2>Essential Python Libraries</h2>

                    <h3>NumPy - Foundation of Numerical Computing</h3>
                    <p>NumPy provides powerful N-dimensional array operations essential for scientific computing. Its vectorized operations are optimized in C, delivering exceptional performance for large-scale numerical computations.</p>

                    <pre>import numpy as np

# Create and manipulate arrays
data = np.array([1, 2, 3, 4, 5])
result = np.sqrt(data) * 2
print(result)  # [2. 2.83 3.46 4. 4.47]</pre>

                    <h3>Pandas - Data Manipulation Made Easy</h3>
                    <p>Pandas transforms messy datasets into clean, analyzable data structures. Its DataFrame and Series objects provide intuitive interfaces for data manipulation, making complex operations simple and readable.</p>

                    <pre>import pandas as pd

# Load and analyze data
df = pd.read_csv('sales_data.csv')
summary = df.groupby('region')['sales'].agg(['mean', 'sum'])
print(summary)</pre>

                    <h3>Matplotlib & Seaborn - Data Visualization</h3>
                    <p>Creating compelling visualizations is crucial for communicating insights. Matplotlib provides fine-grained control over plot elements, while Seaborn offers beautiful statistical graphics with minimal code.</p>

                    <pre>import matplotlib.pyplot as plt
import seaborn as sns

# Create correlation heatmap
plt.figure(figsize=(10, 6))
sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm')
plt.title('Feature Correlation Analysis')
plt.show()</pre>

                    <h2>Machine Learning Frameworks</h2>

                    <p>Python offers several powerful frameworks for machine learning:</p>

                    <ul>
                        <li><strong>Scikit-learn</strong> - Perfect for beginners and classical ML algorithms with consistent API design</li>
                        <li><strong>PyTorch</strong> - Dynamic neural networks favored by researchers for flexibility</li>
                        <li><strong>TensorFlow</strong> - Google's production-ready framework for deep learning at scale</li>
                        <li><strong>XGBoost</strong> - Gradient boosting library that dominates Kaggle competitions</li>
                    </ul>

                    <h2>Building Your First Data Science Project</h2>

                    <h3>1. Data Collection & Exploration</h3>
                    <p>Begin by loading your dataset and understanding its structure. Check for missing values, data types, and basic statistics.</p>

                    <pre>import pandas as pd
import numpy as np

# Load the dataset
df = pd.read_csv('customer_data.csv')

# Explore the data
print(df.info())
print(df.describe())
print(df.isnull().sum())</pre>

                    <h3>2. Data Cleaning & Feature Engineering</h3>
                    <p>Handle missing values appropriately and create new features that might improve model performance.</p>

                    <pre># Handle missing values
df['age'].fillna(df['age'].median(), inplace=True)

# Create new features
df['tenure_years'] = df['tenure_months'] / 12

# Encode categorical variables
from sklearn.preprocessing import LabelEncoder
le = LabelEncoder()
df['gender_encoded'] = le.fit_transform(df['gender'])</pre>

                    <h3>3. Model Building & Evaluation</h3>
                    <p>Train your model and evaluate its performance using appropriate metrics.</p>

                    <pre>from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

# Prepare data
X = df.drop(['customer_id', 'churn'], axis=1)
y = df['churn']

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train model
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
print(classification_report(y_test, y_pred))</pre>

                    <h2>Best Practices</h2>

                    <p>Follow these guidelines for successful data science projects:</p>

                    <ul>
                        <li>Organize projects with clear folder structures</li>
                        <li>Use version control (Git) for all code</li>
                        <li>Document your process and decisions</li>
                        <li>Create reproducible environments with requirements.txt or conda</li>
                        <li>Always explore data before modeling</li>
                        <li>Validate assumptions and test for data leakage</li>
                        <li>Start simple and iterate towards complexity</li>
                    </ul>

                    <h2>Learning Roadmap</h2>

                    <p>Follow this progression to build data science expertise:</p>

                    <ol>
                        <li><strong>Python Fundamentals</strong> - Master basic syntax, data structures, and control flow</li>
                        <li><strong>NumPy & Pandas</strong> - Learn array operations and data manipulation</li>
                        <li><strong>Data Visualization</strong> - Create insightful plots with Matplotlib and Seaborn</li>
                        <li><strong>Statistics & Probability</strong> - Understand statistical foundations</li>
                        <li><strong>Machine Learning</strong> - Study algorithms and model evaluation</li>
                        <li><strong>Deep Learning</strong> - Explore neural networks and frameworks</li>
                        <li><strong>MLOps</strong> - Learn deployment and production practices</li>
                        <li><strong>Domain Expertise</strong> - Apply skills to specific industries</li>
                    </ol>

                    <h2>Conclusion</h2>

                    <p>Python provides a complete toolkit for transforming data into insights and building intelligent systems. Whether you're analyzing business metrics, predicting customer behavior, or developing AI applications, Python's combination of simplicity, power, and community support makes it the ideal choice.</p>

                    <blockquote>
                        "In God we trust. All others must bring data." - W. Edwards Deming
                    </blockquote>

                    <h2>Resources</h2>

                    <p><strong>Official Documentation:</strong></p>
                    <ul>
                        <li><a href="https://docs.python.org/" target="_blank">Python Documentation</a></li>
                        <li><a href="https://pandas.pydata.org/docs/" target="_blank">Pandas Documentation</a></li>
                        <li><a href="https://numpy.org/doc/" target="_blank">NumPy Documentation</a></li>
                        <li><a href="https://scikit-learn.org/" target="_blank">Scikit-learn Documentation</a></li>
                    </ul>

                    <p><strong>Learning Platforms:</strong></p>
                    <ul>
                        <li><a href="https://www.kaggle.com/learn" target="_blank">Kaggle Learn</a></li>
                        <li><a href="https://www.coursera.org/" target="_blank">Coursera</a></li>
                        <li><a href="https://www.datacamp.com/" target="_blank">DataCamp</a></li>
                    </ul>

                    <p><strong>Practice & Competition:</strong></p>
                    <ul>
                        <li><a href="https://www.kaggle.com/" target="_blank">Kaggle Competitions</a></li>
                        <li><a href="https://github.com/" target="_blank">GitHub Projects</a></li>
                        <li><a href="https://www.hackerrank.com/" target="_blank">HackerRank</a></li>
                    </ul>
                    </div>
                
                    <style>
                        .blog-content-container {
                        /* Light theme variables - scoped to this container only */
                        --main-text: #222;
                        --heading: #1450a3;
                        --heading2: #1e62d0;
                        --python: #3776ab;
                        --data-science: #ff6b35;
                        --ml: #4caf50;
                        --pandas: #150458;
                        --numpy: #013243;
                        --matplotlib: #11557c;
                        --card-bg1: #e3f2fd;
                        --card-bg2: #fff3e0;
                        --card-bg3: #e8f5e8;
                        --card-bg4: #f3e5f5;
                        --card-bg5: #fce4ec;
                        --card-bg6: #e0f2f1;
                        --blockquote-bg: #f8fafc;
                        --blockquote-border: #1e62d0;
                        --link: #2779bd;
                        --pre-bg1: #222;
                        --pre-txt1: #d7ffd7;
                        --pre-txt2: #ffe7ba;
                        --pre-txt3: #b7e3ff;
                        --code-bg: #f1f5f9;
                        --code-text: #334155;
                        --warning-bg: #fff8e1;
                        --warning-border: #ffb300;
                        --info-bg: #e3f2fd;
                        --info-border: #2196f3;
                        
                        /* Base container styling */
                        color: var(--main-text);
                        padding: 2em 1.5em;
                        border-radius: 12px;
                        transition: all 0.3s ease;
                        max-width: 100%;
                        overflow: hidden;
                        isolation: isolate;
                        }

                        /* Dark theme - CSS custom properties approach */
                        @media (prefers-color-scheme: dark) {
                        .blog-content-container {
                            --main-text: #dee6ef;
                            --heading: #8bb0f9;
                            --heading2: #65aaff;
                            --python: #4b9cd3;
                            --data-science: #ff8a50;
                            --ml: #81c784;
                            --pandas: #7986cb;
                            --numpy: #4dd0e1;
                            --matplotlib: #42a5f5;
                            --card-bg1: #1e3a5f;
                            --card-bg2: #3e2723;
                            --card-bg3: #2e5266;
                            --card-bg4: #4a148c;
                            --card-bg5: #880e4f;
                            --card-bg6: #00695c;
                            --blockquote-bg: #222a33;
                            --blockquote-border: #65aaff;
                            --link: #7ec3ff;
                            --pre-bg1: #161b22;
                            --pre-txt1: #7fffbc;
                            --pre-txt2: #ffe7ba;
                            --pre-txt3: #67c4ff;
                            --code-bg: #1e293b;
                            --code-text: #cbd5e1;
                            --warning-bg: #2d2006;
                            --warning-border: #ffb300;
                            --info-bg: #0d2744;
                            --info-border: #2196f3;
                        }
                        }

                        /* Theme class-based approach for manual toggle */
                        .dark .blog-content-container {
                        --main-text: #dee6ef;
                        --heading: #8bb0f9;
                        --heading2: #65aaff;
                        --python: #4b9cd3;
                        --data-science: #ff8a50;
                        --ml: #81c784;
                        --pandas: #7986cb;
                        --numpy: #4dd0e1;
                        --matplotlib: #42a5f5;
                        --card-bg1: #1e3a5f;
                        --card-bg2: #3e2723;
                        --card-bg3: #2e5266;
                        --card-bg4: #4a148c;
                        --card-bg5: #880e4f;
                        --card-bg6: #00695c;
                        --blockquote-bg: #222a33;
                        --blockquote-border: #65aaff;
                        --link: #7ec3ff;
                        --pre-bg1: #161b22;
                        --pre-txt1: #7fffbc;
                        --pre-txt2: #ffe7ba;
                        --pre-txt3: #67c4ff;
                        --code-bg: #1e293b;
                        --code-text: #cbd5e1;
                        --warning-bg: #2d2006;
                        --warning-border: #ffb300;
                        --info-bg: #0d2744;
                        --info-border: #2196f3;
                        }

                        .blog-content-container h1, 
                        .blog-content-container h2, 
                        .blog-content-container h3 {
                        color: var(--heading);
                        margin-top: 0;
                        margin-bottom: 0.5em;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container h1 {
                        font-size: 2.6rem;
                        font-weight: bold;
                        color: var(--heading);
                        letter-spacing: -2px;
                        }
                        .blog-content-container h2 {
                        color: var(--heading2);
                        font-size: 2rem;
                        margin-bottom: 0.4em;
                        }
                        .blog-content-container h3 {
                        font-size: 1.2rem;
                        font-weight: 600;
                        }
                        
                        .blog-content-container a { 
                        color: var(--link); 
                        transition: all 0.2s ease;
                        }
                        .blog-content-container a:hover { 
                        text-decoration: underline; 
                        opacity: 0.8;
                        }
                        
                        .blog-content-container code {
                        background: var(--code-bg);
                        color: var(--code-text);
                        padding: 0.2em 0.4em;
                        border-radius: 4px;
                        font-size: 0.9em;
                        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                        transition: all 0.3s ease;
                        }
                        
                        .blog-content-container pre {
                        background: var(--pre-bg1);
                        color: var(--pre-txt1);
                        border-radius: 8px;
                        padding: 1.2em;
                        font-size: 0.95em;
                        overflow-x: auto;
                        margin: 1em 0;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        }
                        .blog-content-container pre code {
                        background: none;
                        color: inherit;
                        padding: 0;
                        font-size: inherit;
                        }
                        
                        .blog-content-container ul, 
                        .blog-content-container ol { 
                        margin-left: 1.5em;
                        line-height: 1.6;
                        }
                        .blog-content-container li {
                        margin-bottom: 0.3em;
                        }
                        
                        .blog-content-container blockquote {
                        background: var(--blockquote-bg);
                        border-left: 4px solid var(--blockquote-border);
                        padding: 1.2em 1.6em;
                        border-radius: 8px;
                        color: var(--main-text);
                        margin: 1.5em 0;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                        transition: all 0.3s ease;
                        }
                        
                        .blog-content-container .hero-section {
                        text-align: center;
                        margin-bottom: 3em;
                        padding: 2em 1em;
                        border-radius: 15px;
                        position: relative;
                        }
                        
                        .blog-content-container .feature-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 2em;
                        margin: 2em 0;
                        }
                        
                        .blog-content-container .feature-card {
                        background: var(--card-bg1);
                        border-radius: 15px;
                        padding: 1.8em;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        position: relative;
                        overflow: hidden;
                        }
                        
                        .blog-content-container .feature-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .feature-card.python { background: var(--card-bg1); }
                        .blog-content-container .feature-card.community { background: var(--card-bg2); }
                        .blog-content-container .feature-card.versatility { background: var(--card-bg3); }
                        .blog-content-container .feature-card.integration { background: var(--card-bg4); }
                        
                        .blog-content-container .library-showcase {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                        gap: 1.5em;
                        margin: 2em 0;
                        }
                        
                        .blog-content-container .library-card {
                        border-radius: 12px;
                        padding: 1.5em;
                        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .library-card:hover {
                        transform: translateY(-3px);
                        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .library-card.numpy { background: var(--card-bg1); }
                        .blog-content-container .library-card.pandas { background: var(--card-bg2); }
                        .blog-content-container .library-card.visualization { background: var(--card-bg3); }
                        
                        .blog-content-container .ml-frameworks {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 1.5em;
                        margin: 2em 0;
                        }
                        
                        .blog-content-container .framework-badge {
                        flex: 1 1 200px;
                        background: var(--card-bg5);
                        border-radius: 10px;
                        padding: 1.2em;
                        text-align: center;
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .framework-badge:hover {
                        transform: scale(1.05);
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .best-practices-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 1.5em;
                        margin: 2em 0;
                        }
                        
                        .blog-content-container .practice-card {
                        border-radius: 12px;
                        padding: 1.5em;
                        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .practice-card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
                        }
                        
                        .blog-content-container .practice-card.structure { background: var(--card-bg1); }
                        .blog-content-container .practice-card.quality { background: var(--card-bg2); }
                        
                        .blog-content-container .roadmap {
                        background: var(--card-bg6);
                        border-radius: 15px;
                        padding: 2em;
                        margin: 2em 0;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        }
                        
                        .blog-content-container .roadmap-steps {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 1em;
                        margin-top: 1.5em;
                        }
                        
                        .blog-content-container .step {
                        background: rgba(255, 255, 255, 0.7);
                        padding: 1em;
                        border-radius: 8px;
                        text-align: center;
                        font-weight: 600;
                        transition: all 0.3s ease;
                        }
                        
                        .blog-content-container .step:hover {
                        background: rgba(255, 255, 255, 0.9);
                        transform: translateY(-2px);
                        }
                        
                        .blog-content-container .info-box {
                        background: var(--info-bg);
                        border-left: 4px solid var(--info-border);
                        padding: 1.2em 1.6em;
                        border-radius: 8px;
                        margin: 1.5em 0;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        }
                        
                        .blog-content-container .warning-box {
                        background: var(--warning-bg);
                        border-left: 4px solid var(--warning-border);
                        padding: 1.2em 1.6em;
                        border-radius: 8px;
                        margin: 1.5em 0;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                        }
                        
                        /* Responsive design */
                        @media (max-width: 700px) {
                        .blog-content-container { 
                            padding: 1.5em 1em; 
                            border-radius: 8px;
                        }
                        .blog-content-container .feature-grid,
                        .blog-content-container .library-showcase,
                        .blog-content-container .best-practices-grid { 
                            grid-template-columns: 1fr;
                            gap: 1em;
                        }
                        .blog-content-container .ml-frameworks {
                            flex-direction: column;
                        }
                        .blog-content-container h1 {
                            font-size: 2.2rem;
                            letter-spacing: -1px;
                        }
                        .blog-content-container h2 {
                            font-size: 1.8rem;
                        }
                        }
                        
                        /* Theme-specific text colors */
                        .blog-content-container .python { 
                        color: var(--python);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .data-science { 
                        color: var(--data-science);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .ml { 
                        color: var(--ml);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .pandas { 
                        color: var(--pandas);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .numpy { 
                        color: var(--numpy);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }
                        .blog-content-container .matplotlib { 
                        color: var(--matplotlib);
                        font-weight: 600;
                        transition: color 0.3s ease;
                        }

                        /* Smooth transitions for theme changes - scoped to container */
                        .blog-content-container * {
                        transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
                        }
                    </style>

                    <div class="hero-section">
                        <h1>
                        � Mastering <span class="python">Python</span> for <span class="data-science">Data Science</span> &amp; <span class="ml">Machine Learning</span>
                        </h1>
                        <p style="font-size: 1.3rem; max-width: 700px; margin: 0 auto; color: var(--main-text); line-height: 1.5;">
                        Unlock the power of <strong>Python's ecosystem</strong> to transform raw data into actionable insights. 
                        From data manipulation to machine learning models, Python is your gateway to the future of data-driven decision making.
                        </p>
                    </div>

                    <section style="margin-bottom: 2.5em;">
                        <h2>🌟 Why Python Dominates Data Science</h2>
                        <div class="feature-grid">
                        <div class="feature-card python">
                            <h3 class="python">🚀 Simplicity Meets Power</h3>
                            <p>Python's clean syntax allows you to focus on solving problems rather than wrestling with complex code structure.</p>
                            <ul>
                            <li>Readable and intuitive syntax</li>
                            <li>Rapid prototyping capabilities</li>
                            <li>Cross-platform compatibility</li>
                            </ul>
                        </div>
                        <div class="feature-card community">
                            <h3 class="data-science">👥 Vibrant Community</h3>
                            <p>Join millions of data scientists worldwide who contribute to Python's ever-growing ecosystem.</p>
                            <ul>
                            <li>Extensive documentation</li>
                            <li>Active forums and support</li>
                            <li>Continuous innovation</li>
                            </ul>
                        </div>
                        <div class="feature-card versatility">
                            <h3 class="ml">🔧 Incredible Versatility</h3>
                            <p>From web scraping to deep learning, Python handles every stage of the data science pipeline.</p>
                            <ul>
                            <li>Data collection & cleaning</li>
                            <li>Statistical analysis</li>
                            <li>Machine learning & AI</li>
                            </ul>
                        </div>
                        <div class="feature-card integration">
                            <h3 class="python">🔗 Seamless Integration</h3>
                            <p>Python plays well with databases, APIs, and other programming languages, making it perfect for enterprise solutions.</p>
                            <ul>
                            <li>Database connectivity</li>
                            <li>API integration</li>
                            <li>Language interoperability</li>
                            </ul>
                        </div>
                        </div>
                    </section>

                    <section style="margin-bottom: 2.5em;">
                        <h2>🛠️ Essential Python Libraries for Data Science</h2>
                        <div class="library-showcase">
                        <div class="library-card numpy">
                            <h3 class="numpy">📊 NumPy - Numerical Computing Foundation</h3>
                            <p>The cornerstone of scientific computing in Python, providing powerful N-dimensional array operations.</p>
                            <pre style="color:var(--pre-txt1);">
                    import numpy as np

                    # Create arrays and perform operations
                    data = np.array([1, 2, 3, 4, 5])
                    result = np.sqrt(data) * 2
                    print(result)  # [2. 2.83 3.46 4. 4.47]
                            </pre>
                            <div class="info-box">
                            <strong>💡 Pro Tip:</strong> NumPy operations are vectorized and written in C, making them incredibly fast for large datasets.
                            </div>
                        </div>
                        
                        <div class="library-card pandas">
                            <h3 class="pandas">🐼 Pandas - Data Manipulation Powerhouse</h3>
                            <p>Transform messy data into clean, analyzable datasets with pandas' intuitive data structures.</p>
                            <pre style="color:var(--pre-txt2);">
                    import pandas as pd

                    # Load and explore data
                    df = pd.read_csv('sales_data.csv')
                    summary = df.groupby('region')['sales'].agg(['mean', 'sum'])
                    print(summary)
                            </pre>
                            <div class="warning-box">
                            <strong>⚠️ Memory Tip:</strong> Use <code>df.dtypes</code> and <code>pd.Categorical</code> to optimize memory usage for large datasets.
                            </div>
                        </div>
                        
                        <div class="library-card visualization">
                            <h3 class="matplotlib">📈 Matplotlib & Seaborn - Data Visualization</h3>
                            <p>Create stunning visualizations that tell compelling stories with your data.</p>
                            <pre style="color:var(--pre-txt3);">
                    import matplotlib.pyplot as plt
                    import seaborn as sns

                    # Create beautiful plots
                    plt.figure(figsize=(10, 6))
                    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm')
                    plt.title('Feature Correlation Analysis')
                    plt.show()
                            </pre>
                        </div>
                        </div>
                    </section>

                    <section style="margin-bottom: 2.5em;">
                        <h2>🤖 Machine Learning Frameworks</h2>
                        <div class="ml-frameworks">
                        <div class="framework-badge">
                            <h4 class="ml">🧠 Scikit-learn</h4>
                            <p>Perfect for beginners and classical ML algorithms</p>
                        </div>
                        <div class="framework-badge">
                            <h4 class="ml">🔥 PyTorch</h4>
                            <p>Dynamic neural networks for research and production</p>
                        </div>
                        <div class="framework-badge">
                            <h4 class="ml">🌊 TensorFlow</h4>
                            <p>Google's powerhouse for deep learning at scale</p>
                        </div>
                        <div class="framework-badge">
                            <h4 class="ml">⚡ XGBoost</h4>
                            <p>Gradient boosting for winning competitions</p>
                        </div>
                        </div>
                    </section>

                    <section style="margin-bottom: 2.5em;">
                        <h2>🎯 Getting Started: Your First Data Science Project</h2>
                        <div style="background:var(--card-bg1); border-radius:15px; padding:2em;">
                        <h3 style="color:var(--heading2); margin-bottom:1em;">📋 Project: Customer Churn Prediction</h3>
                        
                        <div style="margin-bottom: 1.5em;">
                            <h4 style="color:var(--python);">1. Data Collection & Exploration</h4>
                            <pre style="color:var(--pre-txt1);">
                    import pandas as pd
                    import numpy as np
                    import matplotlib.pyplot as plt
                    import seaborn as sns

                    # Load the dataset
                    df = pd.read_csv('customer_data.csv')

                    # Explore the data
                    print(df.info())
                    print(df.describe())
                    print(df.isnull().sum())
                            </pre>
                        </div>

                        <div style="margin-bottom: 1.5em;">
                            <h4 style="color:var(--data-science);">2. Data Cleaning & Feature Engineering</h4>
                            <pre style="color:var(--pre-txt2);">
                    # Handle missing values
                    df['age'].fillna(df['age'].median(), inplace=True)

                    # Create new features
                    df['tenure_years'] = df['tenure_months'] / 12
                    df['monthly_charges_per_service'] = df['monthly_charges'] / df['num_services']

                    # Encode categorical variables
                    from sklearn.preprocessing import LabelEncoder
                    le = LabelEncoder()
                    df['gender_encoded'] = le.fit_transform(df['gender'])
                            </pre>
                        </div>

                        <div style="margin-bottom: 1.5em;">
                            <h4 style="color:var(--ml);">3. Model Building & Evaluation</h4>
                            <pre style="color:var(--pre-txt3);">
                    from sklearn.model_selection import train_test_split
                    from sklearn.ensemble import RandomForestClassifier
                    from sklearn.metrics import classification_report, confusion_matrix

                    # Prepare features and target
                    X = df.drop(['customer_id', 'churn'], axis=1)
                    y = df['churn']

                    # Split the data
                    X_train, X_test, y_train, y_test = train_test_split(
                        X, y, test_size=0.2, random_state=42
                    )

                    # Train the model
                    rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
                    rf_model.fit(X_train, y_train)

                    # Make predictions and evaluate
                    y_pred = rf_model.predict(X_test)
                    print(classification_report(y_test, y_pred))
                            </pre>
                        </div>
                        </div>
                    </section>

                    <section style="margin-bottom: 2.5em;">
                        <h2>💡 Best Practices for Data Science Success</h2>
                        <div class="best-practices-grid">
                        <div class="practice-card structure">
                            <h4 class="python">🗂️ Project Organization</h4>
                            <ul style="margin-top: 0.5em;">
                            <li>Use clear folder structures</li>
                            <li>Version control with Git</li>
                            <li>Document your process</li>
                            <li>Create reproducible environments</li>
                            </ul>
                        </div>
                        <div class="practice-card quality">
                            <h4 class="data-science">✅ Data Quality First</h4>
                            <ul style="margin-top: 0.5em;">
                            <li>Always explore before modeling</li>
                            <li>Handle missing data thoughtfully</li>
                            <li>Validate your assumptions</li>
                            <li>Test for data leakage</li>
                            </ul>
                        </div>
                        </div>
                    </section>

                    <section style="margin-bottom: 2.5em;">
                        <h2>🗺️ Your Data Science Learning Roadmap</h2>
                        <div class="roadmap">
                        <p style="font-size: 1.1em; margin-bottom: 1em; text-align: center;">
                            <strong>Follow this path to become a proficient data scientist:</strong>
                        </p>
                        <div class="roadmap-steps">
                            <div class="step">1. Python Basics</div>
                            <div class="step">2. NumPy & Pandas</div>
                            <div class="step">3. Data Visualization</div>
                            <div class="step">4. Statistics</div>
                            <div class="step">5. Machine Learning</div>
                            <div class="step">6. Deep Learning</div>
                            <div class="step">7. MLOps & Deployment</div>
                            <div class="step">8. Domain Expertise</div>
                        </div>
                        </div>
                    </section>

                    <section style="margin-bottom: 2.5em;">
                        <h2>🔮 The Future is Data-Driven</h2>
                        <blockquote>
                        <strong>Python</strong> isn't just a programming language—it's your passport to the future of technology. 
                        Whether you're predicting customer behavior, optimizing business processes, or building the next AI breakthrough, 
                        Python provides the tools and community to make it happen.
                        <br/><br/>
                        <em class="python">"In God we trust. All others must bring data." - W. Edwards Deming</em>
                        </blockquote>
                    </section>

                    <section>
                        <h2>📚 Essential Resources</h2>
                        <div style="margin-top: 1.5em;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1em;">
                            <div style="background: var(--card-bg1); padding: 1em; border-radius: 8px;">
                            <h4 class="python">📖 Documentation</h4>
                            <ul style="margin: 0.5em 0;">
                                <li><a href="https://docs.python.org/" target="_blank">Python Official Docs</a></li>
                                <li><a href="https://pandas.pydata.org/docs/" target="_blank">Pandas Documentation</a></li>
                                <li><a href="https://numpy.org/doc/" target="_blank">NumPy Documentation</a></li>
                            </ul>
                            </div>
                            <div style="background: var(--card-bg2); padding: 1em; border-radius: 8px;">
                            <h4 class="data-science">🎓 Learning Platforms</h4>
                            <ul style="margin: 0.5em 0;">
                                <li><a href="https://www.kaggle.com/learn" target="_blank">Kaggle Learn</a></li>
                                <li><a href="https://www.coursera.org/" target="_blank">Coursera</a></li>
                                <li><a href="https://www.datacamp.com/" target="_blank">DataCamp</a></li>
                            </ul>
                            </div>
                            <div style="background: var(--card-bg3); padding: 1em; border-radius: 8px;">
                            <h4 class="ml">💻 Practice Platforms</h4>
                            <ul style="margin: 0.5em 0;">
                                <li><a href="https://www.kaggle.com/" target="_blank">Kaggle Competitions</a></li>
                                <li><a href="https://github.com/" target="_blank">GitHub Projects</a></li>
                                <li><a href="https://www.hackerrank.com/" target="_blank">HackerRank</a></li>
                            </ul>
                            </div>
                        </div>
                        </div>
                    </section>
                    </div>
                ''',
                date=datetime(2024, 10, 20),
                reading_time=12,
                featured=False,
                is_visible=True,
                author=author,
                category=category_life,
                tags=[tags[1], tags[3]],  # Python, Machine Learning
                cover_image='https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop'
            )
        ]
        for blog in blogs:
            db.session.add(blog)
        
        # Create sample certifications
        certifications = [
            Certification(
                name='AWS Certified Solutions Architect',
                issuer='Amazon Web Services',
                date='2024',
                description='Demonstrated expertise in designing distributed systems on AWS',
                skills=['Cloud Computing', 'AWS', 'System Architecture'],
                certificate_id='AWS-SAA-2024-001'
            ),
            Certification(
                name='Python Professional Certification',
                issuer='Python Institute',
                date='2023',
                description='Advanced Python programming and best practices',
                skills=['Python', 'Programming', 'Software Development'],
                certificate_id='PCPP-2023-001'
            )
        ]
        for cert in certifications:
            db.session.add(cert)
        
        # Create sample experiences
        experiences = [
            Experience(
                title='Software Engineer',
                company='Morningstar India Pvt. Ltd.',
                location='Mumbai, India',
                start_date=date(2021, 3, 1),
                is_current=True,
                duration='4+ years',
                responsibilities=[
                    'Collaborated with different teams to create an automated solution that efficiently moved several years(historical)\' worth of data into the data lake system in a short timeframe',
                    'Worked with project managers, developers, quality assurance and other production support teams to solve technical issues',
                    'Mentored MDP\'s, helped new Joiners with getting them accustomed to the applications by providing support, KTs and guidance',
                    'I provided urgent assistance to clients by extracting critical mapping data. Recognizing the recurring nature of these requests, I developed several SQL views to streamline the process. These views allowed for efficient querying and retrieval of relevant data. Additionally, I transformed the extracted data into user-friendly Excel files, enhancing data visualization and accessibility for clients.'
                ],
                achievements=[
                    'Delivered batch and real-time processing based on Event-Driven Architecture developed on .Net Core, Python for Data Ingestion',
                    'Reduced client onboarding time from several months to just a few weeks by developing an end-to-end automation solution. Leveraged .Net Core, AWS Lambda and Python to streamline the process, just by filling the MS form'
                ],
                technologies=['.Net', 'C#', 'Python', 'Docker', 'AWS', 'PostgreSQL'],
                color='from-blue-500 to-purple-600',
                order=1,
                is_visible=True
            ),
            Experience(
                title='Full Stack Developer Intern',
                company='Amstech Incorporation Pvt. Ltd.',
                location='Indore',
                start_date=date(2018, 6, 1),
                end_date=date(2018, 10, 31),
                is_current=False,
                duration='4 months',
                responsibilities=[
                    'Designed application on Java, Spring boot, Angular 3, Bootstrap, MySQL to design and develop an online exam platform',
                    'Designed secured, efficient and robust exam/test interface with UX focused interface'
                ],
                achievements=[
                    'Designed complete end-to-end application with rich features for admin controls',
                    'Secured application by implementing access controls for different user roles',
                    'Established development best practices'
                ],
                technologies=['Java', 'Spring', 'Hibernate', 'HTML/CSS', 'JDBC', 'MySQL'],
                color='from-green-500 to-teal-600',
                order=2,
                is_visible=True
            )
        ]
        for exp in experiences:
            db.session.add(exp)
        
        # Create technical skills data
        technical_skills = [
            TechnicalSkill(
                title='Backend Development',
                skills=[
                    '.Net / C#',
                    'Python / Flask',
                    'PostgreSQL / SQL Server',
                    'REST APIs / MVC',
                    'Event Driven Architecture / Distributed'
                ],
                color='from-indigo-500 to-purple-600',  # Updated to vibrant gradient
                icon='Server',  # Updated from Terminal to Server for better representation
                order=1,
                is_visible=True
            ),
            TechnicalSkill(
                title='DevOps & Cloud',
                skills=[
                    'AWS',
                    'Docker / ECS',
                    'CI/CD Pipelines',
                    'Monitoring & Logging'
                ],
                color='from-blue-500 to-cyan-500',  # Updated to vibrant blue-cyan gradient
                icon='Cloud',  # Updated from Globe to Cloud for better representation
                order=2,
                is_visible=True
            )
        ]
        for skill in technical_skills:
            db.session.add(skill)
        # Add 50 test contact messages for pagination, search, and ordering
        from models import ContactMessage
        import random
        from datetime import timedelta
        base_time = datetime.utcnow()
        subjects = [
            "Portfolio Inquiry", "Job Opportunity", "Feedback", "Bug Report", "Feature Request",
            "Collaboration", "General Question", "Support Needed", "Thanks", "Other"
        ]
        names = [
            "Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy"
        ]
        for i in range(50):
            name = random.choice(names)
            email = f"{name.lower()}{i}@example.com"
            subject = random.choice(subjects) + f" #{i+1}"
            message = f"This is a test message {i+1} from {name}. Content is unique for testing."
            created_at = base_time - timedelta(minutes=i*10)  # Each message 10 min apart
            # Simulate some messages as read (roughly 30% read)
            is_read = random.choice([True, False, False, False])  # 25% chance of being read
            read_at = created_at + timedelta(minutes=random.randint(10, 60)) if is_read else None
            
            contact_message = ContactMessage(
                name=name,
                email=email,
                subject=subject,
                message=message,
                is_read=is_read,
                read_at=read_at,
                created_at=created_at
            )
            db.session.add(contact_message)
        
        # Commit all changes
        db.session.commit()
        print("Database initialized successfully with sample data!")
        print("Default admin user created:")
        print("  Username: admin")
        print("  Password: admin123")
        print("  Email: admin@portfolio.com")

if __name__ == '__main__':
    init_db()
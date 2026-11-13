from app import app, db
from models import Project

with app.app_context():
    projects = Project.query.all()
    featured = [p for p in projects if p.is_featured]
    visible_featured = [p for p in projects if p.is_visible and p.is_featured]
    
    print(f"Total projects: {len(projects)}")
    print(f"Featured projects: {len(featured)}")
    print(f"Visible + Featured: {len(visible_featured)}")
    
    if visible_featured:
        print("\nVisible Featured Projects:")
        for p in visible_featured[:3]:
            print(f"  - {p.title} (order: {p.order})")

from app import app, db
from models import Project

with app.app_context():
    # Mark all projects as featured and visible
    projects = Project.query.all()
    for project in projects:
        project.is_featured = True
        project.is_visible = True
    
    db.session.commit()
    
    # Verify
    featured = Project.query.filter_by(is_visible=True, is_featured=True).all()
    print(f"✅ Updated {len(projects)} projects")
    print(f"✅ {len(featured)} projects are now featured and visible")
    
    if featured:
        print("\nFeatured Projects:")
        for p in featured:
            print(f"  - {p.title}")

import asyncio
import sys
import uuid

# Add the parent directory to sys.path so 'app' can be imported
sys.path.append(".")

from app.db.database import AsyncSessionLocal, init_db
from app.db.models import TeamMemberModel

async def seed_employees():
    # Ensure tables exist
    await init_db()
    
    employees = [
        {"name": "Alice Smith", "role": "Frontend Developer", "skills": "React,TypeScript,CSS", "experience": "senior"},
        {"name": "Bob Johnson", "role": "Backend Developer", "skills": "Python,FastAPI,PostgreSQL", "experience": "mid"},
        {"name": "Charlie Brown", "role": "DevOps Engineer", "skills": "AWS,Docker,Kubernetes", "experience": "senior"},
        {"name": "Diana Prince", "role": "UX/UI Designer", "skills": "Figma,Adobe XD,Sketch", "experience": "mid"},
        {"name": "Eve Davis", "role": "Project Manager", "skills": "Agile,Scrum,Jira", "experience": "senior"},
        {"name": "Frank White", "role": "QA Engineer", "skills": "Selenium,Cypress,JUnit", "experience": "junior"},
        {"name": "Grace Hopper", "role": "Data Scientist", "skills": "Python,Machine Learning,SQL", "experience": "senior"},
        {"name": "Hank Pym", "role": "Mobile Developer", "skills": "Swift,Kotlin,React Native", "experience": "mid"},
        {"name": "Ivy Chen", "role": "Fullstack Developer", "skills": "JavaScript,Node.js,React", "experience": "senior"},
        {"name": "Jack Bauer", "role": "Security Analyst", "skills": "Pen Testing,Network Security", "experience": "senior"},
        {"name": "Karen Page", "role": "Technical Writer", "skills": "Documentation,Markdown,Confluence", "experience": "mid"},
        {"name": "Leo Fitz", "role": "Systems Engineer", "skills": "Linux,Networking,Bash", "experience": "mid"},
        {"name": "Mia Wallace", "role": "Product Owner", "skills": "Product Management,Roadmapping", "experience": "senior"},
        {"name": "Nina Simone", "role": "Frontend Developer", "skills": "Vue.js,HTML,Tailwind", "experience": "junior"},
        {"name": "Oscar Isaac", "role": "Backend Developer", "skills": "Go,Microservices,MongoDB", "experience": "senior"},
    ]

    async with AsyncSessionLocal() as session:
        for emp in employees:
            member = TeamMemberModel(
                id=str(uuid.uuid4()),
                name=emp["name"],
                role=emp["role"],
                skills=emp["skills"],
                experience=emp["experience"]
            )
            session.add(member)
        await session.commit()
        print("Successfully added 15 employees!")

if __name__ == "__main__":
    asyncio.run(seed_employees())

# Auth Testing Playbook

Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
```
Verify bcrypt hash starts with `$2b$`, unique index on users.email.

Step 2: API Testing
```
curl -c cookies.txt -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@ui2code.dev","password":"admin123"}'
curl -b cookies.txt http://localhost:8001/api/auth/me
```
Login returns user object + sets access_token/refresh_token cookies. /me returns the same user via cookies.

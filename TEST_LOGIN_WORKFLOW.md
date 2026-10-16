# Quick Login Testing Workflow

This guide walks you through testing the complete login fix.

## Prerequisites
- Windows machine
- Python 3.11+
- Node.js 18+
- Backend running with Supabase PostgreSQL connection
- Frontend running with Vite dev server

## Step-by-Step Testing

### 1. Start Backend Server (if not already running)
```powershell
cd d:\FALCAPROJECT\AI-healthcare-project\backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
Wait for: `Uvicorn running on http://127.0.0.1:8000`

### 2. Start Frontend Server (if not already running)
```powershell
cd d:\FALCAPROJECT\AI-healthcare-project\frontend
npm run dev
```
Wait for: `Local: http://localhost:3001` or `http://localhost:3000`

### 3. Open Browser and Test Login

**URL:** http://localhost:3001 (or 3000, depending on which port was available)

#### Test 3A: Quick Demo Login
1. Look for the blue box titled "Instant Demo Evaluation Accounts"
2. Click the **"Patient (John Doe)"** button
3. Should auto-fill and login automatically
4. **Expected result:** Redirected to Patient Dashboard

#### Test 3B: Manual Demo Login
1. Go back to login page
2. **Email field should be EMPTY** (not pre-filled with patient@demo.com)
3. Type: `patient@demo.com`
4. Type password: `demo123`
5. Click "Sign In to Portal"
6. **Expected result:** Redirected to Patient Dashboard

### 4. Test Registration with New Account

#### Option 4A: Register as Patient
1. Click **"New Patient"** tab
2. Fill form with test data:
   ```
   Full Name: Test User Alpha
   Email: testuser001@example.com
   Phone: +1-555-100-0001
   Date of Birth: 1990-06-15
   Gender: Male
   Password: TestPass123
   ```
3. Click "Register Patient Account"
4. **Expected result:** Auto-login and redirect to dashboard

#### Option 4B: Register as Clinician
1. Click **"Clinician Join"** tab
2. Fill form with test data:
   ```
   Full Name: Dr. Test Clinician
   Hospital: Test Medical Center
   Department: Emergency Triage
   Role: Triage Resident
   License ID: MD-TEST-2026-001
   Email: testdoctor@example.com
   Password: TestPass123
   ```
3. Click "Submit Clinician Application"
4. **Expected result:** Message saying "pending administrative verification"

### 5. Logout and Re-Login with New Account
1. From dashboard, find logout button
2. Click logout
3. Return to login page
4. Enter your new account email and password
5. Click "Sign In"
6. **Expected result:** Login succeeds

### 6. Test Error Handling

#### Error Case 1: Wrong Password
- Email: `patient@demo.com`
- Password: `wrongpassword`
- Click "Sign In"
- **Expected result:** Error message "Invalid email/phone or password"
- **Important:** Should NOT crash with "Unexpected end of JSON input"

#### Error Case 2: Non-existent Email
- Email: `doesnotexist@example.com`
- Password: `demo123`
- Click "Sign In"
- **Expected result:** Error message "Invalid email/phone or password"

### 7. Verify in Supabase

To confirm data is actually being saved to Supabase (not SQLite):

```powershell
cd backend
python -c "
from database import get_db
conn = get_db()
cur = conn.cursor()

# Check if your test user was created
cur.execute('SELECT email, role, status FROM users WHERE email = %s', ('testuser001@example.com',))
row = cur.fetchone()
if row:
    print('✓ User created in Supabase:', dict(row))
else:
    print('✗ User not found in Supabase - check if registration succeeded')

conn.close()
"
```

## Expected Behaviors After Fix

✅ Empty email field on login page (no hardcoded demo@example.com)
✅ Can enter any registered email address
✅ Successful login redirects to dashboard
✅ Registration creates new accounts
✅ Error messages display without crashing
✅ Demo quick-login buttons still work
✅ All data saved to Supabase PostgreSQL

## If Something Goes Wrong

### Login page shows hardcoded email
- Frontend cache issue: Hard refresh `Ctrl+Shift+R`
- Rebuild frontend: `npm run build` then `npm run dev`

### Login crashes with JSON error
- Backend crashed: Restart with `python -m uvicorn main:app --host 127.0.0.1 --port 8000`
- Check backend logs for errors

### Cannot connect to backend
- Verify port 8000 is listening: `netstat -an | findstr :8000`
- Check firewall isn't blocking localhost connections

### New user not appearing in Supabase
- Check database connection in `.env` file
- Verify Supabase project is online
- Run test query above to confirm

## Quick Reference: Demo Accounts

| Role | Email | Password | Status |
|------|-------|----------|--------|
| Patient | patient@demo.com | demo123 | ACTIVE |
| Doctor | doctor@hospital.com | demo123 | ACTIVE (Approved) |
| Admin | admin@healthsystem.org | demo123 | ACTIVE |
| Doctor (Pending) | newdoc@clinic.com | demo123 | PENDING |

**Important:** Only ACTIVE and APPROVED accounts can fully use the system. PENDING accounts cannot create assessments.

## Cleanup Test Data

To remove test accounts you created:

```powershell
cd backend
python -c "
from database import get_db
conn = get_db()
cur = conn.cursor()

# Delete a test user (WARNING: This is permanent)
email = 'testuser001@example.com'
cur.execute('DELETE FROM users WHERE email = %s', (email,))
conn.commit()
print(f'Deleted user: {email}')
conn.close()
"
```

---

**Status:** ✅ Ready to test. Both servers should be running before opening the browser.

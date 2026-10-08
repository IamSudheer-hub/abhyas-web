# 📚 Abhyas — Quiz Portal

**अभ्यास ही सफलता की कुंजी है**

A free, fast, and easy-to-manage online quiz portal for teachers and students.

---

## ✨ Features

| Feature | Description |
|---|---|
| **4 Question Types** | MCQ, One Word, Short Answer, Long Answer |
| **Auto-Grading** | MCQ and One Word answers graded instantly on submission |
| **Manual Evaluation** | Teacher evaluates Short/Long answers with reference answers side-by-side |
| **Timed Quizzes** | Set time limits with auto-submission |
| **Question Shuffling** | Randomize question order per student |
| **Anti-Cheat** | Tab-switch detection and monitoring |
| **Excel Upload** | Upload questions from Excel spreadsheets |
| **Analytics Dashboard** | Average score, pass rate, grade distribution |
| **Export Results** | Download results as Excel file |
| **Partial Marks** | Award 0 to full marks on subjective answers |
| **Student Review** | Students see correct answers and feedback after release |
| **Responsive Design** | Works on desktop, tablet, and mobile |

---

## 🛠️ Setup Guide (15 minutes)

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add project"** → Enter a name (e.g., "Abhyas") → Create
3. Wait for the project to be created

### Step 2: Enable Authentication

1. In your Firebase project, go to **Build → Authentication**
2. Click **"Get started"**
3. Under **Sign-in method**, enable **Email/Password**
4. Go to the **Users** tab → Click **"Add user"**
5. Add your teacher account:
   - Email: `teacher@abhyas.com` (or your email)
   - Password: Choose a strong password
6. You can add more teacher accounts later

### Step 3: Enable Cloud Firestore

1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in test mode"** → Click Next
4. Choose a location (asia-south1 for India) → Click **Enable**

### Step 4: Set Firestore Security Rules

1. In Firestore, go to the **Rules** tab
2. Replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /quizzes/{quizId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /students/{rollNumber} {
      allow read, create: if true;
      allow update, delete: if request.auth != null;
    }
    match /submissions/{submissionId} {
      allow read, create: if true;
      allow update: if request.auth != null;
    }
  }
}
```

3. Click **Publish**

### Step 5: Get Firebase Config

1. Go to **Project Settings** (⚙️ gear icon at top)
2. Scroll to **"Your apps"** → Click the **Web** icon (`</>`)
3. Enter an app nickname (e.g., "Abhyas Web") → Click **Register app**
4. You'll see a `firebaseConfig` object. Copy the values.

### Step 6: Update Config File

Open `firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
    apiKey: "AIzaSy...",           // Your actual API key
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

### Step 7: Create Required Firestore Index

The app needs a composite index for submissions queries. The easiest way is:

1. Open `admin.html` in your browser and log in
2. Open browser console (F12 → Console tab)
3. If you see a Firestore index error, click the link in the error message
4. This will take you to Firebase Console where you can create the index automatically
5. Click **"Create Index"** and wait ~2 minutes

### Step 8: Deploy (Free Options)

#### Option A: Firebase Hosting (Recommended)

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize hosting (in the abhyas folder)
firebase init hosting
# Select your project
# Set public directory to: . (current directory)
# Configure as single-page app: No

# Deploy
firebase deploy --only hosting
```

Your site will be live at `https://your-project-id.web.app`

#### Option B: GitHub Pages (Free)

1. Create a GitHub repository
2. Push all files to the repository
3. Go to Settings → Pages → Deploy from main branch
4. Your site will be at `https://username.github.io/repo-name`

#### Option C: Netlify (Free)

1. Go to [Netlify](https://www.netlify.com)
2. Drag and drop the entire `abhyas` folder
3. Your site will be live instantly

#### Option D: Local Use

Simply open `index.html` in any browser. Works locally too!

---

## 📊 Excel Template Format

Download the template from the admin panel, or create an Excel file with these columns:

| Question | Type | Option A | Option B | Option C | Option D | Correct Answer | Reference Answer | Marks |
|---|---|---|---|---|---|---|---|---|
| What is 2+2? | MCQ | 3 | 4 | 5 | 6 | B | — | 5 |
| Capital of India? | OneWord | — | — | — | — | New Delhi | — | 5 |
| Explain photosynthesis | Short | — | — | — | — | — | Plants convert sunlight... | 10 |
| Discuss WW2 causes | Long | — | — | — | — | — | Major causes include... | 20 |

**Type values:** `MCQ`, `OneWord`, `Short`, `Long` (case-insensitive)

**Correct Answer for MCQ:** Use the letter `A`, `B`, `C`, or `D`

---

## 👨‍🏫 Teacher Workflow

1. **Login** at `admin.html` with your Firebase Auth email/password
2. **Create Quiz** → Upload Excel or add questions manually → Save as Draft or Go Live
3. **Manage Quizzes** → Change status (Draft → Live → Completed)
4. **Evaluate** → Select quiz → Select student → Grade subjective answers with reference answer visible → Save
5. **Release Results** → Release individual or all evaluated results at once
6. **Analytics** → View stats, grade distribution, export results to Excel

## 🎓 Student Workflow

1. **Register** at `student.html` with Name + Roll Number + Password
2. **Login** with Roll Number + Password
3. **Take Quiz** → Select an available quiz → Answer questions → Submit
4. **View Results** → Check released results with detailed answers and feedback

---

## 📁 File Structure

```
abhyas/
├── index.html          # Landing page
├── admin.html          # Teacher portal (SPA)
├── student.html        # Student portal (SPA)
├── style.css           # Complete stylesheet
├── firebase-config.js  # Firebase configuration (edit this!)
├── utils.js            # Shared utility functions
├── admin.js            # Admin panel logic
├── student.js          # Student panel logic
└── README.md           # This file
```

---

## 💰 Cost: Absolutely Free

| Service | Free Tier |
|---|---|
| Firebase Firestore | 50,000 reads/day, 20,000 writes/day |
| Firebase Auth | Unlimited users |
| Firebase Hosting | 10 GB/month, 360 MB storage |
| GitHub Pages / Netlify | Unlimited |

This is more than enough for a school/classroom quiz portal.

---

## ❓ FAQ

**Q: Can multiple teachers use the portal?**
A: Yes! Add more teacher accounts in Firebase Auth → Users.

**Q: Is student data secure?**
A: Student passwords are SHA-256 hashed. Firestore rules ensure only teachers can modify quiz data.

**Q: Can I use this offline?**
A: The portal requires internet for Firebase. For fully offline use, a different backend would be needed.

**Q: How many students can use it simultaneously?**
A: Firebase free tier supports thousands of concurrent connections. More than enough for a school.

---

Built with ❤️ for educators.

# Secure Access Sential 🔐

## 🛡️ Project Overview

Secure Access Sential is a real-time cybersecurity system designed with Zero Trust Architecture. It protects sensitive data like customer PII or financial records by detecting and preventing suspicious access patterns in real-time.

🎯 Domain: Cyber Security
👨‍💻 Team: Ring Zero
🏫 College: SKSVMACET

---

## 🚨 Problem Statement

A major challenge in Zero Trust Architecture is real-time detection and prevention of suspicious access to sensitive data. Secure Access Sential addresses this with multi-layer authentication, platform restrictions, and real-time alerts.

---

## 🎯 Key Features

### 👤 User Features

* Admin-only user registration
* Login via password or face recognition
* Request access to files through dashboard
* Blocks logins from non-Windows OS
* Auto-block after repeated failed login attempts

### 👨‍💼 Admin Features

* Secure login with password + OTP (Google Authenticator)
* Monitor user login/logout/activity
* Approve or deny access requests
* Block/unblock users
* Set daily login limits per user

---

## 🔐 Security Measures

* 2-minute lockout after 3 invalid login attempts
* Blocked users cannot log in even with correct credentials for 2 mins
* Platform restriction: only Windows OS allowed
* Honeytrap files to detect malicious behavior
* Suspicious access patterns trigger automatic blocking and admin alerts

---

## 🧰 Tech Stack

* **Frontend**: React.js
* **Backend**: Next.js
* **Auth & Database**: Firebase
* **Facial Recognition**: Face API.js
* **2FA**: Google Authenticator
* **Tracking**: Custom OS/device detection

---

## ✅ Final Outcome

* Fully implemented and functional real-time secure access system
* Zero Trust Architecture enforced at multiple levels
* Smart blocking, alerts, and OS-based restriction
* Scalable design for use in any sensitive environment

---

## 🚀 Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/ringzero0/Secure-Access-Sential.git
   cd Secure-Access-Sential
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up Firebase and Face API by creating a `.env` file:

   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

4. Run the app:

   ```bash
   npm run dev
   ```

---

## 💡 Future Enhancements

* Add device fingerprinting for stronger session control
* Integrate email notifications for suspicious behavior
* Expand RBAC to support more roles
* Cloud deployment with CI/CD integration

---

## 👥 Contributors

* [Praveen](https://github.com/prvnprk)
* [Latesh](https://github.com/Lateshshetty)
* [Pramodh Gouda](https://github.com/Pramod1831)

---

## 🏁 License

All rights reserved by **Ringzero**. This project is not licensed for commercial use without permission.

<div align="center">

# 📁 Shared Document & Community Platform
### *An open-source, lightweight web application for seamless technical discussions and document sharing.*

**Crafted with passion by [TNT MemeForge Studio](https://github.com/tntmemeforgestudio)**

[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2F%20Express-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Atlas-brightgreen?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Status: Active](https://img.shields.io/badge/Status-Active%20%2F%20Open%20Source-orange?style=flat-square)]()

</div>

---

## 🚀 Overview

This project is a modern, lightweight, full-stack web platform designed for communities, students, and developers to share technical resources, documents, and code snippets. 

Built primarily for **educational purposes, reference templates, and community collaboration**, this repository serves as a clean starter kit for anyone looking to understand how to connect a Node.js/Express backend with MongoDB Atlas, implement secure user interactions, and manage file attachments efficiently.

---

## 💡 Why Open Source?
We believe in the power of shared knowledge. By open-sourcing this project, our goals are to:
* **Empower Learners & Developers:** Provide a clean, easy-to-understand code structure that students and hobbyists can study, deploy, or customize for their own projects.
* **Cost-Effective & Optimized:** Achieve over **90% optimization** using free-tier cloud infrastructure (such as MongoDB Atlas Free Tier and Render), proving that robust platforms can be built with zero operating costs.
* **Community-Driven Growth:** Welcome contributions, feedback, and ideas from developers worldwide under the **TNT MemeForge Studio** ecosystem.

---

## ✨ Key Features

* **Smart Local Content Moderation:** A custom boundary-based filtering system that strictly detects exact-match prohibited keywords without triggering false positives on standard technical communication (e.g., programming terms, greetings, or web links).
* **Automated Data Pruning (90-Day Lifecycle):** To maintain optimal cloud storage and server performance, attached files are automatically pruned after 90 days, while text discussions remain permanently archived.
* **Interactive Community Engagement:** Supports posts, file attachments (Base64 handling), nested comments, real-time-like counters (likes/dislikes), and verified author badges.
* **System Health Monitor:** Built-in API endpoints (`/api/health`) to track database connection status and server RAM utilization in real-time.

---

## 🛠️ Tech Stack

* **Backend:** Node.js, Express.js
* **Database:** MongoDB Atlas (Mongoose ODM)
* **Frontend UI:** HTML5, CSS3, JavaScript, Bootstrap 5, FontAwesome
* **Hosting & Deployment:** Render (Cloud Web Service)

---

## 📦 Getting Started (Local Development)

If you want to run this project locally for study or testing purposes, follow these steps:

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/tntmemeforgestudio/web-chia-se-tai-lieu.git](https://github.com/tntmemeforgestudio/web-chia-se-tai-lieu.git)
   cd web-chia-se-tai-lieu

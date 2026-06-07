# AI-Assisted Driver Drowsiness Detection System

## Overview

This project is a real-time AI-powered Driver Drowsiness Detection System that monitors a driver's facial features through a webcam to identify signs of fatigue and inattention.

The system analyzes facial landmarks, eye closure patterns, blinking behavior, and mouth movements to estimate drowsiness risk and provide timely alerts that can help improve road safety.

---

## Demo Video

🎥 Project Demo

https://drive.google.com/file/d/1JrgO9SHrRBvqDF6ABnOOFbR2gfKHgqjJ/view?usp=sharing

---

## Features

* Real-time webcam monitoring
* Facial landmark detection using MediaPipe
* Eye Aspect Ratio (EAR) calculation
* Mouth Aspect Ratio (MAR) calculation
* Driver attention monitoring
* Drowsiness risk estimation
* Real-time dashboard visualization
* Live facial landmark tracking
* Fatigue alert system
* Backend and frontend integration

---

## Technology Stack

### Backend

* Python
* FastAPI
* OpenCV
* MediaPipe
* NumPy
* Uvicorn

### Frontend

* React
* Vite
* Tailwind CSS
* JavaScript

---

## How It Works

1. Webcam captures live video frames.
2. MediaPipe detects facial landmarks.
3. Eye and mouth metrics are calculated.
4. Driver attention and fatigue indicators are analyzed.
5. Risk levels are estimated in real time.
6. Results are displayed on a dashboard.
7. Alerts are generated when drowsiness patterns are detected.

---

## Project Structure

```text
backend/
├── main.py
├── requirements.txt

frontend/
├── src/
├── public/
├── package.json
├── vite.config.js
├── tailwind.config.js
```

---

## Installation

### Backend

```bash
cd backend

python3.11 -m venv venv
source venv/bin/activate

pip install -r requirements.txt

uvicorn main:app
```

### Frontend

```bash
cd frontend

npm install
npm run dev
```

---

## AI-Assisted Development

This project was developed using AI-assisted software engineering tools.

AI tools were used to support:

* Project architecture generation
* Code generation
* Component creation
* Backend and frontend scaffolding
* Development workflow acceleration

My contributions included:

* Defining the project idea and objectives
* Setting up the development environment
* Managing dependencies and configurations
* Debugging compatibility issues
* Fixing runtime errors
* Testing application functionality
* Integrating backend and frontend components
* Validating outputs and improving the user experience
* Creating documentation and project demonstrations

This project demonstrates my ability to effectively use modern AI development tools to build, debug, deploy, and understand real-world software systems.

---

## Challenges Solved

During development, several technical challenges were resolved, including:

* Python environment configuration
* MediaPipe compatibility issues
* FastAPI backend setup
* React and Vite frontend setup
* Dependency management
* Frontend build configuration troubleshooting
* Backend-frontend communication

---

## Future Improvements

* Advanced fatigue prediction models
* Driver identity recognition
* Night-time monitoring support
* Mobile application integration
* Cloud-based monitoring dashboard
* Historical analytics and reporting
* Multi-driver support

---

## Applications

* Smart transportation systems
* Driver safety monitoring
* Fleet management solutions
* Logistics and trucking industries
* Research in computer vision and road safety

---

## Author

**Shreya Gupta**

B.Tech Computer Science Engineering
Banasthali Vidyapith

---

## Disclaimer

This project was created as a learning and portfolio project to explore AI-assisted software development, computer vision, and real-time monitoring systems.

The system is intended for educational and demonstration purposes and should not be considered a certified commercial driver safety solution.

---

Built using AI-assisted development, Computer Vision, FastAPI, React, OpenCV, and MediaPipe.

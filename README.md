🌱 Foliage Care

Foliage Care is a full-stack web application that helps users **diagnose crop diseases** using machine learning. The platform promotes **organic agriculture** and provides an intuitive interface for farmers and enthusiasts to upload images, get diagnosis results, and connect for help.

🧩 Application Stack

| **Layer**          | **Technology**                                      | **Role / Purpose**                                                                                          |
|--------------------|------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| **Frontend**       | HTML5, CSS, JavaScript (ES6)                        | Provides the user interface (Foliage Care website) for image upload and result display.                     |
| **Authentication** | Firebase Authentication                              | Manages secure user registration (Email/Password) and third-party login (Google OAuth).                     |
| **Styling**        | Google Fonts (*Playfair Display*, *Roboto*), Font Awesome | Used for aesthetic, elegant typography and iconography.                                                     |
| **Backend API**    | FastAPI (Python)                                    | High-performance API that routes frontend requests to the AI models.                                        |
| **Server**         | Uvicorn                                              | ASGI server used to run the FastAPI application efficiently.                                                |

## 🤖 Machine Learning Pipeline

The detection process uses a robust **two-step classification pipeline** to ensure accuracy and prevent false positives (like identifying a non-plant image).

| **Step**                 | **Model File**          | **Function & Output**                                                                                                                                                     |
|---------------------------|------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Step 1: Gatekeeper**    | `plant_detector.h5`    | **Binary Classification:** Determines if the image contains a plant leaf (Yes/No).                                                                                         |
| **Step 2: Expert**        | `new_disease_model.h5` | **Multi-Class Classification:** Identifies the specific plant and its health status among **22 total classes** (e.g., `Apple__Black_rot`, `Potato__healthy`, etc.).         |
| **Framework**             | TensorFlow / Keras     | Used for training, fine-tuning (*MobileNetV2* base), and loading all `.h5` models.                                                                                        |
| **Data**                  | Image-based dataset    | Contains images for **22 classes** across multiple crops (Apple, Potato, Corn, Grape, Peach, Cherry, Pepper Bell).                                                        |




 Features

- 🌿 Upload plant images for disease detection
- 🤖 AI model classifies disease based on image input
- 🔐 User login/signup (JWT or session-based)
- 📬 Contact page to connect with the team
- ⚡ FastAPI backend with async support
- 📡 Cross-origin access with CORS (frontend-backend integration)


MAIN LANDING PAGE
![Screenshot 2025-05-27 131624](https://github.com/user-attachments/assets/020cf329-6ba1-477c-8351-b8ff026e7a20)

![image](https://github.com/user-attachments/assets/39a6512e-fed8-4f42-a5bf-f55c11aa6d40)

DIAGNOSE PAGE

![image](https://github.com/user-attachments/assets/42fca12d-5e2e-48c6-8fb4-7cb54d83aa7f)


<img width="789" height="831" alt="image" src="https://github.com/user-attachments/assets/2fd3a05e-5006-4ec6-9501-36284af67406" />


![image](https://github.com/user-attachments/assets/415aa5f9-a358-40cb-bb7e-e8017d26eeb8)

ABOUT PAGE

![image](https://github.com/user-attachments/assets/30b3a476-4dd5-4aa3-bf3e-829ee3138121)

![image](https://github.com/user-attachments/assets/a925bac1-1f28-4fb5-8476-73d9cbce0abe)

LOGIN/SIGNUP PAGE
<img width="1784" height="825" alt="image" src="https://github.com/user-attachments/assets/09a34f79-8f78-4ede-9b51-08e856fca2a6" />



CONNECT/FEEDBACK PAGE

![image](https://github.com/user-attachments/assets/4c5b6b46-b3bf-47e5-8eb9-028983bbb6e0)

![image](https://github.com/user-attachments/assets/bd7b809a-9fa4-45ec-85a7-43aeb7d19113)


TY









import requests
with open('Frontend/assets/leaf.png', 'rb') as f:
    files = {'file': f}
    data = {'user_name': 'Test', 'user_type': 'home_gardener', 'location': 'Pune'}
    res = requests.post('http://localhost:8000/predict', files=files, data=data)
    print(res.status_code)
    text = res.text
    print(text)

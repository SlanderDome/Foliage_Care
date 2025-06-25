document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelector('.tab-button.active').classList.remove('active');
        button.classList.add('active');

        document.querySelector('.form.active').classList.remove('active');
        const target = button.dataset.target;
        document.querySelector(target).classList.add('active');
    });
});

document.querySelector("#login").addEventListener("submit", function (event) {
    event.preventDefault();  
    
    
    const email = event.target.querySelector('input[type="email"]').value;
    const password = event.target.querySelector('input[type="password"]').value;

    if (email && password) {
        localStorage.setItem("successMessage", "Successfully Logged In");

        
        window.location.href = "index.html";
    } else {
        alert("Please enter valid credentials.");
    }
});

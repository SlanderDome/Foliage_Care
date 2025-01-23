
document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", (e) => {
     
      document.querySelectorAll(".tab-button").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".form").forEach((form) => form.classList.remove("active"));
  
    
      const target = document.querySelector(e.target.getAttribute("data-target"));
      button.classList.add("active");
      target.classList.add("active");
    });
  });
  
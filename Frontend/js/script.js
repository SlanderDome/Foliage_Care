// Adding dynamic hover effects on the navbar
document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("mouseover", () => {
      link.style.color = "#ffa726";
    });
    link.addEventListener("mouseout", () => {
      link.style.color = "#fff";
    });
  });
  
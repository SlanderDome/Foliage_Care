
document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("mouseover", () => {
      link.style.color = "#ffa726";
    });
    link.addEventListener("mouseout", () => {
      link.style.color = "#fff";
    });
  });
  
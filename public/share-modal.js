useEffect(() => {
    const modal = document.getElementById("someElement"); 
    if (modal) {
      modal.addEventListener("click", () => console.log("Clicked!"));
    }
  
    return () => {
      if (modal) {
        modal.removeEventListener("click", () => console.log("Clicked!"));
      }
    };
  }, []);
  
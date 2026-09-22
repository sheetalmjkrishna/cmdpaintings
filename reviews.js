const reviewsApiBaseUrl = window.CMDPAINTINGS_API_URL || "";

function reviewsApiUrl(path) {
    return `${reviewsApiBaseUrl}${path}`;
}

async function loadReviews() {
    const response = await fetch(reviewsApiUrl("/api/reviews"));
    if (!response.ok) throw new Error("Could not load testimonials.");
    const reviews = await response.json();
    const slider = document.querySelector(".testimonials-slider");
    if (!slider) return;

    slider.replaceChildren();
    const wrapper = document.createElement("div");
    wrapper.className = "swiper-wrapper";
    reviews.forEach((review) => wrapper.append(createReviewSlide(review)));
    slider.append(wrapper);

    if (reviews.length > 1) {
        const pagination = document.createElement("div");
        pagination.className = "swiper-pagination";
        slider.append(pagination);
    }
    if (reviews.length && window.startTestimonialSlider) window.startTestimonialSlider();
}

function createReviewSlide(review) {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";

    const item = document.createElement("div");
    item.className = "testimonial-item";

    const quote = document.createElement("p");
    const leftQuote = document.createElement("i");
    leftQuote.className = "bx bxs-quote-alt-left quote-icon-left";
    const text = document.createTextNode(` ${review.review || ""} `);
    const rightQuote = document.createElement("i");
    rightQuote.className = "bx bxs-quote-alt-right quote-icon-right";
    quote.append(leftQuote, text, rightQuote);

    const name = document.createElement("h3");
    name.textContent = review.name || "Anonymous";
    item.append(quote, name);
    slide.append(item);
    return slide;
}

async function submitReview() {
    const firstName = document.querySelector("#reviewer_fname").value.trim();
    const lastName = document.querySelector("#reviewer_lname").value.trim();
    const review = document.querySelector("#review").value.trim();
    const name = [firstName, lastName].filter(Boolean).join(" ");

    if (!name || !review) {
        showMessage("Enter your name and review.", "alert alert-danger");
        return;
    }

    try {
        const response = await fetch(reviewsApiUrl("/api/reviews"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, review })
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || "Could not submit your review.");
        }
        bootstrap.Modal.getInstance(document.querySelector("#addReviewModal")).hide();
        document.querySelector("#reviewer_fname").value = "";
        document.querySelector("#reviewer_lname").value = "";
        document.querySelector("#review").value = "";
        showMessage("Thank you. Your review was submitted.", "alert alert-success");
        await loadReviews();
    } catch (error) {
        showMessage(error.message, "alert alert-danger");
    }
}

loadReviews().catch((error) => showMessage(error.message, "alert alert-danger"));

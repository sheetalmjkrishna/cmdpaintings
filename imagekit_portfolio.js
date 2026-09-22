const portfolioApiBaseUrl = window.CMDPAINTINGS_API_URL || "";
const portfolioFolders = ["religious", "people", "misc"];
let portfolioPassword = "";

function showMessage(message, className) {
    const alert = document.querySelector("#alertMessage");
    if (!alert) return;
    alert.querySelector("span").textContent = message;
    alert.className = `${className} bring-forward`;
    alert.style.display = "block";
    window.setTimeout(() => {
        alert.style.display = "none";
    }, 5000);
}

function portfolioApiUrl(path) {
    return `${portfolioApiBaseUrl}${path}`;
}

async function imageKitAuth(password) {
    const passwordBytes = new TextEncoder().encode(password || "");
    const passwordDigest = await crypto.subtle.digest("SHA-256", passwordBytes);
    const passwordFingerprint = [...new Uint8Array(passwordDigest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 12);
    const response = await fetch(portfolioApiUrl("/api/imagekit/auth"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
    });
    if (!response.ok) throw new Error(await describeApiFailure(response, "ImageKit authentication failed."));
    return response.json();
}

async function authorizePortfolioUpload() {
    const passwordInput = document.querySelector("#portfolioPassword");
    const error = document.querySelector("#portfolioPasswordError");
    error.textContent = "";
    try {
        await imageKitAuth(passwordInput.value);
        portfolioPassword = passwordInput.value;
        passwordInput.value = "";
        bootstrap.Modal.getInstance(document.querySelector("#portfolioPasswordModal")).hide();
        bootstrap.Modal.getOrCreateInstance(document.querySelector("#addToPortfolioModal")).show();
    } catch (requestError) {
        error.textContent = requestError.message;
    }
}

async function describeApiFailure(response, fallback) {
    if (response.redirected || response.status === 301 || response.status === 302) {
        return "The Vercel API is protected by a login page. Disable Deployment Protection for this API deployment.";
    }
    let details = "";
    try {
        const body = await response.json();
        details = body.error ? `: ${body.error}` : "";
    } catch (error) {
        // Keep the user-facing error useful when the response is not JSON.
    }
    return `${fallback} (HTTP ${response.status})${details}`;
}

async function loadImageKitPortfolio() {
    const results = await Promise.all(portfolioFolders.map(async (folder) => {
        const response = await fetch(portfolioApiUrl(`/api/imagekit/files?path=${encodeURIComponent(`/Photos/${folder}`)}`));
        if (!response.ok) throw new Error(await describeApiFailure(response, "Could not load the ImageKit portfolio."));
        return { folder, files: await response.json() };
    }));
    const container = document.querySelector(".portfolio-container");
    if (!container) return;
    container.replaceChildren();
    results.forEach(({ folder, files }) => {
        files.filter((file) => file.type === "file").forEach((file) => renderImageKitPortfolioItem(container, folder, file));
    });
    await waitForPortfolioImages(container);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (window.startPortfolioSlider) window.startPortfolioSlider();
}

function renderImageKitPortfolioItem(container, folder, file) {
    const item = document.createElement("div");
    item.className = `col-lg-4 col-md-6 portfolio-item filter-${folder}`;
    item.dataset.fileId = file.fileId;
    item.innerHTML = `<div class="portfolio-img"><img src="${file.url}" class="img-fluid" alt="${file.name}"></div><div class="portfolio-info"><h4>${folder}</h4><p>${file.description || file.customMetadata?.description || ""}</p><button type="button" class="yellow-button transparent add-new d-flex align-items-center justify-content-center" data-delete-file="${file.fileId}" title="Delete image"><i class="bi bi-dash"></i></button><a href="${file.url}" class="portfolio-lightbox" data-gallery="portfolioGallery" data-type="image" title="${folder}"><i class="bi bi-arrows-angle-expand"></i></a></div>`;
    item.querySelector("[data-delete-file]").addEventListener("click", () => removeImageKitPortfolioItem(file.fileId, item));
    container.append(item);
}

function waitForPortfolioImages(container) {
    const images = [...container.querySelectorAll("img")];
    return Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
        });
    }));
}

async function uploadPortfolioToImageKit() {
    const file = document.querySelector("#portfolioPhoto").files[0];
    const folder = document.querySelector("#category").value;
    const description = document.querySelector("#description").value.trim();
    if (!file) {
        showMessage("Choose a photo first.", "alert alert-danger");
        return;
    }
    try {
        const auth = await imageKitAuth(portfolioPassword);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", file.name);
        formData.append("publicKey", auth.publicKey);
        formData.append("token", auth.token);
        formData.append("signature", auth.signature);
        formData.append("expire", auth.expire);
        formData.append("folder", `/Photos/${folder}`);
        formData.append("useUniqueFileName", "true");
        if (description) formData.append("description", description);
        const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
        if (!response.ok) throw new Error("ImageKit rejected the upload.");
        bootstrap.Modal.getInstance(document.querySelector("#addToPortfolioModal")).hide();
        document.querySelector("#portfolioPhoto").value = "";
        document.querySelector("#description").value = "";
        await loadImageKitPortfolio();
        showMessage("Image uploaded.", "alert alert-success");
    } catch (error) {
        showMessage(error.message, "alert alert-danger");
    }
}

async function removeImageKitPortfolioItem(fileId, item) {
    if (!window.confirm("Remove this image from the portfolio?")) return;
    const response = await fetch(portfolioApiUrl(`/api/imagekit/files/${encodeURIComponent(fileId)}`), { method: "DELETE" });
    if (!response.ok) {
        showMessage("Could not remove the image.", "alert alert-danger");
        return;
    }
    item.remove();
    showMessage("Image removed.", "alert alert-success");
}

loadImageKitPortfolio().catch((error) => showMessage(error.message, "alert alert-danger"));
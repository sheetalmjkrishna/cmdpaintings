const portfolioApiBaseUrl = window.CMDPAINTINGS_API_URL || "";
const portfolioFolders = ["kerala_mural", "acrylic", "other"];
const portfolioPasswordHeader = "x-portfolio-password";
const portfolioStatusKey = "cmdpaintings:status";
// Long enough to read the toast and for ImageKit's file list to catch up with the change.
const reloadDelay = 2000;
let portfolioPassword = "";
let pendingPortfolioAction = null;
let messageTimer = 0;

function showMessage(message, className) {
    const alert = document.querySelector("#alertMessage");
    if (!alert) return;
    alert.querySelector("span").textContent = message;
    alert.className = `${className} bring-forward`;
    alert.style.display = "block";
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => {
        alert.style.display = "none";
    }, 5000);
}

// Show the status, pause so it can be read and so ImageKit settles, then reload into the new gallery.
// The message is stashed because the reload wipes the toast, and shown again on the fresh page.
function reloadWithMessage(message, className) {
    showMessage(message, className);
    try {
        window.sessionStorage.setItem(portfolioStatusKey, JSON.stringify({ message, className }));
    } catch (error) {
        // Private browsing can block sessionStorage; the reload then simply loses the message.
    }
    window.setTimeout(() => window.location.reload(), reloadDelay);
}

function showStashedMessage() {
    let stashed = null;
    try {
        stashed = window.sessionStorage.getItem(portfolioStatusKey);
        window.sessionStorage.removeItem(portfolioStatusKey);
    } catch (error) {
        return;
    }
    if (!stashed) return;
    try {
        const { message, className } = JSON.parse(stashed);
        if (message) showMessage(message, className);
    } catch (error) {
        // Ignore a malformed stash rather than blocking page start-up.
    }
}

function portfolioApiUrl(path) {
    return `${portfolioApiBaseUrl}${path}`;
}

async function imageKitAuth(password) {
    const response = await fetch(portfolioApiUrl("/api/imagekit/auth"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
    });
    if (!response.ok) throw new Error(await describeApiFailure(response, "ImageKit authentication failed."));
    return response.json();
}

function requestPortfolioPassword(prompt, action) {
    pendingPortfolioAction = action;
    document.querySelector("#portfolioPasswordPrompt").textContent = prompt;
    document.querySelector("#portfolioPasswordError").textContent = "";
    document.querySelector("#portfolioPassword").value = "";
    bootstrap.Modal.getOrCreateInstance(document.querySelector("#portfolioPasswordModal")).show();
}

function requestPortfolioUpload() {
    requestPortfolioPassword("Enter the password to add an image.", () => {
        bootstrap.Modal.getOrCreateInstance(document.querySelector("#addToPortfolioModal")).show();
    });
}

function requestPortfolioItemRemoval(fileId) {
    requestPortfolioPassword("Enter the password to permanently remove this image.", () => removeImageKitPortfolioItem(fileId));
}

async function submitPortfolioPassword() {
    const passwordInput = document.querySelector("#portfolioPassword");
    const error = document.querySelector("#portfolioPasswordError");
    error.textContent = "";
    let action = null;
    try {
        await imageKitAuth(passwordInput.value);
        portfolioPassword = passwordInput.value;
        passwordInput.value = "";
        action = pendingPortfolioAction;
        pendingPortfolioAction = null;
        bootstrap.Modal.getInstance(document.querySelector("#portfolioPasswordModal")).hide();
    } catch (requestError) {
        error.textContent = requestError.message;
        return;
    }
    // The modal is closed by now, so the action reports its own failures via showMessage.
    if (action) await action();
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
    const title = toTitleCase(folder);
    const description = toTitleCase(file.description || file.customMetadata?.description || "");
    item.innerHTML = `<div class="portfolio-img"><img src="${file.url}" class="img-fluid" alt="${file.name}"></div><div class="portfolio-info"><h4>${title}</h4><p>${description}</p><button type="button" class="yellow-button portfolio-delete d-flex align-items-center justify-content-center" data-delete-file="${file.fileId}" title="Delete image"><i class="bi bi-dash"></i></button><a href="${file.url}" class="portfolio-lightbox" data-gallery="portfolioGallery" data-type="image"><i class="bi bi-arrows-angle-expand"></i></a></div>`;
    item.querySelector("[data-delete-file]").addEventListener("click", () => requestPortfolioItemRemoval(file.fileId));
    container.append(item);
}

function toTitleCase(value) {
    return value.replace(/\S+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
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
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message || `ImageKit rejected the upload. (HTTP ${response.status})`);
        }
        bootstrap.Modal.getInstance(document.querySelector("#addToPortfolioModal")).hide();
        document.querySelector("#portfolioPhoto").value = "";
        document.querySelector("#description").value = "";
        reloadWithMessage("Image uploaded.", "alert alert-success");
    } catch (error) {
        showMessage(`Could not upload the image: ${error.message}`, "alert alert-danger");
    }
}

async function removeImageKitPortfolioItem(fileId) {
    try {
        const response = await fetch(portfolioApiUrl(`/api/imagekit/files/${encodeURIComponent(fileId)}`), {
            method: "DELETE",
            headers: { [portfolioPasswordHeader]: portfolioPassword }
        });
        if (!response.ok) {
            showMessage(await describeApiFailure(response, "Could not remove the image."), "alert alert-danger");
            return;
        }
        reloadWithMessage("Image removed.", "alert alert-success");
    } catch (error) {
        showMessage(`Could not reach the delete API: ${error.message}. If the API was just changed, redeploy it.`, "alert alert-danger");
    }
}

showStashedMessage();
loadImageKitPortfolio().catch((error) => showMessage(error.message, "alert alert-danger"));
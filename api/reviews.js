const crypto = require("crypto");
const { sendJson, handleOptions, imageKitRequest, getConfig } = require("./imagekit");

const reviewsPath = "/Reviews";
const reviewsFileName = "reviews.json";
const maxReviews = 100;

function parseRequestBody(request) {
    if (typeof request.body === "string") return JSON.parse(request.body || "{}");
    return request.body || {};
}

function normalizeReviews(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((review) => review && typeof review === "object").slice(-maxReviews);
}

async function findReviewsFile() {
    const result = await imageKitRequest("GET", `/files?path=${encodeURIComponent(reviewsPath)}&limit=100`);
    if (!result.ok) throw new Error(`ImageKit file listing failed (${result.status}).`);
    const files = await result.json();
    return files.find((file) => file.name === reviewsFileName);
}

async function readReviews() {
    const reviewsFile = await findReviewsFile();
    if (!reviewsFile?.url) return [];
    const result = await fetch(reviewsFile.url);
    if (!result.ok) throw new Error(`Reviews file could not be read (${result.status}).`);
    return normalizeReviews(await result.json());
}

async function writeReviews(reviews) {
    const { privateKey } = getConfig();
    const content = Buffer.from(JSON.stringify(normalizeReviews(reviews), null, 2)).toString("base64");
    const formData = new FormData();
    formData.append("file", `data:application/json;base64,${content}`);
    formData.append("fileName", reviewsFileName);
    formData.append("folder", reviewsPath);
    formData.append("useUniqueFileName", "false");
    formData.append("overwriteFile", "true");

    const result = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`
        },
        body: formData
    });
    if (!result.ok) {
        let detail = `ImageKit review upload failed (${result.status}).`;
        try {
            const body = await result.json();
            detail = body.message || detail;
        } catch (error) {
            // Keep the API response useful if ImageKit returns non-JSON.
        }
        throw new Error(detail);
    }
}

module.exports = async function handler(request, response) {
    if (handleOptions(request, response)) return;
    try {
        if (request.method === "GET") {
            return sendJson(response, 200, await readReviews(), request);
        }
        if (request.method !== "POST") {
            return sendJson(response, 405, { error: "Method not allowed" }, request);
        }

        const body = parseRequestBody(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const review = typeof body.review === "string" ? body.review.trim() : "";
        if (!name || !review) {
            return sendJson(response, 400, { error: "Name and review are required." }, request);
        }
        if (name.length > 100 || review.length > 1000) {
            return sendJson(response, 400, { error: "Name or review is too long." }, request);
        }

        const reviews = await readReviews();
        const newReview = {
            id: crypto.randomUUID(),
            name,
            review,
            createdAt: new Date().toISOString()
        };
        await writeReviews([...reviews, newReview]);
        return sendJson(response, 201, { message: "Review submitted.", review: newReview }, request);
    } catch (error) {
        return sendJson(response, 500, { error: error.message }, request);
    }
};

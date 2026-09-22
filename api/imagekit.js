const crypto = require("crypto");

function getConfig() {
    const { IMAGEKIT_PRIVATE_KEY: privateKey, IMAGEKIT_PUBLIC_KEY: publicKey } = process.env;
    if (!privateKey || !publicKey) {
        throw new Error("Missing IMAGEKIT_PRIVATE_KEY or IMAGEKIT_PUBLIC_KEY.");
    }
    return { privateKey, publicKey };
}

function cors(response, request) {
    const configuredOrigins = [process.env.FRONTEND_ORIGIN, process.env.FRONTEND_ORIGINS]
        .filter(Boolean)
        .flatMap((origins) => origins.split(",").map((origin) => origin.trim()))
        .filter(Boolean);
    const allowedOrigins = new Set([
        ...configuredOrigins,
        "https://cmdpaintings.vercel.app",
        "http://localhost:3000"
    ]);
    const requestOrigin = request?.headers?.origin;
    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
        response.setHeader("Access-Control-Allow-Origin", requestOrigin);
        response.setHeader("Vary", "Origin");
    }
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, x-portfolio-password");
}

function passwordMatches(supplied) {
    const configured = process.env.AUTH_PASSWORD;
    if (!configured || typeof supplied !== "string" || supplied.length === 0) return false;
    const suppliedBytes = Buffer.from(supplied);
    const configuredBytes = Buffer.from(configured);
    if (suppliedBytes.length !== configuredBytes.length) return false;
    return crypto.timingSafeEqual(suppliedBytes, configuredBytes);
}

function sendJson(response, statusCode, body, request) {
    cors(response, request);
    response.status(statusCode).json(body);
}

function handleOptions(request, response) {
    if (request.method !== "OPTIONS") return false;
    cors(response, request);
    response.status(204).end();
    return true;
}

async function imageKitRequest(method, endpoint) {
    const { privateKey } = getConfig();
    return fetch(`https://api.imagekit.io/v1${endpoint}`, {
        method,
        headers: {
            Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
            "Content-Type": "application/json"
        }
    });
}

module.exports = { crypto, getConfig, sendJson, handleOptions, imageKitRequest, passwordMatches };

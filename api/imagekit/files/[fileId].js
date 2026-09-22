const { sendJson, handleOptions, imageKitRequest, passwordMatches } = require("../../imagekit");

module.exports = async function handler(request, response) {
    if (handleOptions(request, response)) return;
    if (request.method !== "DELETE") return sendJson(response, 405, { error: "Method not allowed" }, request);
    if (!process.env.AUTH_PASSWORD) return sendJson(response, 500, { error: "AUTH_PASSWORD is not configured." }, request);
    if (!passwordMatches(request.headers["x-portfolio-password"])) return sendJson(response, 401, { error: "Incorrect password." }, request);
    try {
        const result = await imageKitRequest("DELETE", `/files/${encodeURIComponent(request.query.fileId)}`);
        const body = result.status === 204 ? {} : await result.json();
        return sendJson(response, result.status, body, request);
    } catch (error) {
        return sendJson(response, 500, { error: error.message }, request);
    }
};

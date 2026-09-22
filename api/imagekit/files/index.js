const { sendJson, handleOptions, imageKitRequest } = require("../../imagekit");

module.exports = async function handler(request, response) {
    if (handleOptions(request, response)) return;
    if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed" }, request);
    try {
        const path = encodeURIComponent(request.query.path || "/Photos");
        const result = await imageKitRequest("GET", `/files?path=${path}&limit=100`);
        const body = await result.json();
        return sendJson(response, result.status, body, request);
    } catch (error) {
        return sendJson(response, 500, { error: error.message }, request);
    }
};

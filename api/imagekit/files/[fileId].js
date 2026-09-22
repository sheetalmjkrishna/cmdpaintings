const { sendJson, handleOptions, imageKitRequest } = require("../../imagekit");

module.exports = async function handler(request, response) {
    if (handleOptions(request, response)) return;
    if (request.method !== "DELETE") return sendJson(response, 405, { error: "Method not allowed" }, request);
    try {
        const result = await imageKitRequest("DELETE", `/files/${encodeURIComponent(request.query.fileId)}`);
        const body = result.status === 204 ? {} : await result.json();
        return sendJson(response, result.status, body, request);
    } catch (error) {
        return sendJson(response, 500, { error: error.message }, request);
    }
};

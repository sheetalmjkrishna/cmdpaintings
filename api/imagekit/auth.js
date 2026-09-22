const { crypto, getConfig, sendJson, handleOptions } = require("../imagekit");

function passwordFingerprint(value) {
    const text = typeof value === "string" ? value : "";
    return crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);
}

module.exports = function handler(request, response) {
    if (handleOptions(request, response)) return;
    if (request.method !== "POST") return sendJson(response, 405, { error: "Method not allowed" }, request);
    try {
        const configuredPassword = process.env.AUTH_PASSWORD;
        const requestPassword = typeof request.body === "string" ? JSON.parse(request.body).password : request.body?.password;
        console.info("Portfolio password check", {
            expectedLength: configuredPassword?.length || 0,
            expectedFingerprint: passwordFingerprint(configuredPassword),
            suppliedLength: typeof requestPassword === "string" ? requestPassword.length : 0,
            suppliedFingerprint: passwordFingerprint(requestPassword),
            matches: Boolean(configuredPassword && requestPassword === configuredPassword)
        });
        if (!configuredPassword) return sendJson(response, 500, { error: "AUTH_PASSWORD is not configured." }, request);
        if (!requestPassword || requestPassword !== configuredPassword) return sendJson(response, 401, { error: "Incorrect password." }, request);
        const { privateKey, publicKey } = getConfig();
        const expire = Math.floor(Date.now() / 1000) + 600;
        const token = crypto.randomBytes(24).toString("hex");
        const signature = crypto.createHmac("sha1", privateKey).update(token + expire).digest("hex");
        return sendJson(response, 200, { token, expire, signature, publicKey }, request);
    } catch (error) {
        return sendJson(response, 500, { error: error.message }, request);
    }
};

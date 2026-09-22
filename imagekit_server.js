const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const port = Number(process.env.PORT || 3000);
const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
const rootDirectory = __dirname;

if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error("Set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT before starting the server.");
}

function sendJson(response, statusCode, body) {
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end(JSON.stringify(body));
}

function imageKitRequestOptions(method, requestPath) {
    return {
        method,
        headers: {
            Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
            "Content-Type": "application/json"
        }
    };
}

async function handleApi(request, response, requestUrl) {
    if (request.method === "OPTIONS") {
        response.writeHead(204, { "Access-Control-Allow-Origin": "*" });
        response.end();
        return true;
    }

    if (request.method === "POST" && requestUrl.pathname === "/api/imagekit/auth") {
        const body = await new Promise((resolve, reject) => {
            let data = "";
            request.on("data", (chunk) => data += chunk);
            request.on("end", () => resolve(data));
            request.on("error", reject);
        });
        const requestPassword = JSON.parse(body || "{}").password;
        if (!process.env.AUTH_PASSWORD) {
            sendJson(response, 500, { error: "AUTH_PASSWORD is not configured." });
            return true;
        }
        if (!requestPassword || requestPassword !== process.env.AUTH_PASSWORD) {
            sendJson(response, 401, { error: "Incorrect password." });
            return true;
        }
        const expire = Math.floor(Date.now() / 1000) + 600;
        const token = crypto.randomBytes(24).toString("hex");
        const signature = crypto.createHmac("sha1", privateKey).update(token + expire).digest("hex");
        sendJson(response, 200, { token, expire, signature, publicKey });
        return true;
    }

    if (request.method === "GET" && requestUrl.pathname === "/api/imagekit/files") {
        const imageKitUrl = new URL("/v1/files", "https://api.imagekit.io");
        imageKitUrl.searchParams.set("path", requestUrl.searchParams.get("path") || "/Photos");
        imageKitUrl.searchParams.set("limit", "100");
        const result = await fetch(imageKitUrl, imageKitRequestOptions("GET"));
        const body = await result.json();
        sendJson(response, result.status, body);
        return true;
    }

    const deleteMatch = requestUrl.pathname.match(/^\/api\/imagekit\/files\/([^/]+)$/);
    if (request.method === "DELETE" && deleteMatch) {
        const result = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(deleteMatch[1])}`, imageKitRequestOptions("DELETE"));
        const body = result.status === 204 ? {} : await result.json();
        sendJson(response, result.status, body);
        return true;
    }

    return false;
}

function serveStatic(request, response, requestUrl) {
    const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
    const filePath = path.resolve(rootDirectory, `.${requestedPath}`);
    if (!filePath.startsWith(rootDirectory) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }
    const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".ico": "image/x-icon" };
    response.writeHead(200, { "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    try {
        if (requestUrl.pathname.startsWith("/api/")) {
            if (await handleApi(request, response, requestUrl)) return;
            sendJson(response, 404, { error: "Not found" });
            return;
        }
        serveStatic(request, response, requestUrl);
    } catch (error) {
        sendJson(response, 500, { error: error.message });
    }
});

server.listen(port, () => {
    console.log(`ImageKit gallery running at http://localhost:${port}`);
});

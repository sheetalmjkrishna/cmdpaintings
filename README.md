# cmdpaintings
Personal painting gallery.

## ImageKit gallery

The root gallery uses ImageKit for image upload, collection listing, viewing, and deletion. The ImageKit private key stays on the server; do not put it in browser code.

Requirements: Node.js 18 or newer and an ImageKit account.

For local development, set the ImageKit values in the terminal before starting:

```sh
export IMAGEKIT_PUBLIC_KEY="your_public_key"
export IMAGEKIT_PRIVATE_KEY="your_private_key"
export IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/your_imagekit_id"
npm start
```

Open `http://localhost:3000`. Images are stored in the `/Photos` folder. Do not expose the Node server directly to the public internet without adding authentication for the delete endpoint.

## GitHub Pages + Vercel

GitHub Pages hosts the static gallery. Vercel hosts the `/api/imagekit` serverless functions. In Vercel, import this repository and add these environment variables:

```text
IMAGEKIT_PUBLIC_KEY     ImageKit public key
IMAGEKIT_PRIVATE_KEY    ImageKit private key
FRONTEND_ORIGIN         Your GitHub Pages URL, such as https://sheetalmjkrishna.github.io
```

After Vercel deploys, put its project URL in `api-config.js` as `window.CMDPAINTINGS_API_URL`. The ImageKit URL endpoint is not needed by the API because ImageKit's upload and management APIs are addressed directly.

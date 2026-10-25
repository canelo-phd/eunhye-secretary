// Local development uses the private Node server; the published site uses Cloudflare Worker.
window.ENHE_API_BASE_URL = location.hostname === 'localhost' ? '' : 'https://eunhye-api.angelcanelophd.workers.dev';

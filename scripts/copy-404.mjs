// Vercel serves dist/404.html (status 404) for paths with no static file.
// Expo exports the not-found route as +not-found.html: copy it so unknown URLs
// render the app's own 404 screen instead of the home page HTML.
import fs from 'node:fs';
fs.copyFileSync('dist/+not-found.html', 'dist/404.html');
console.log('dist/404.html <- dist/+not-found.html');

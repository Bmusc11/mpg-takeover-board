# MPG Takeover Board

Live management takeover board for Musca Property Group, hosted on Netlify.

- public/index.html: the board
- netlify/functions/api.mjs: the database API (pre-bundled, no install needed)
- netlify/src and netlify/lib: source for the API
- Data is stored in Netlify Blobs on this site.

Settings (Netlify > Project configuration > Environment variables, then redeploy):
- TEAM_CODE: the team access code (required, the board stays locked without it)
- REMINDER_KEY: changes the key used by the reminder email check

To rebuild the API after editing netlify/lib or netlify/src:
npm i @netlify/blobs esbuild && npx esbuild netlify/src/api.mjs --bundle --platform=node --target=node20 --format=esm --outfile=netlify/functions/api.mjs

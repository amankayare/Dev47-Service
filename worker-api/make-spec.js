const fs = require('fs');
const spec = fs.readFileSync('D:/Workspace/Dev47-Service/worker-api/public/openapi.json', 'utf8');
const fileContent = `export const dynamic = 'force-dynamic';\n\nexport async function GET() {\n  return new Response(${JSON.stringify(spec)}, {\n    headers: {\n      'Content-Type': 'application/json; charset=utf-8',\n      'Access-Control-Allow-Origin': '*',\n    },\n  });\n}\n`;
fs.writeFileSync('D:/Workspace/Dev47-Service/worker-api/src/app/apispec_1.json/route.ts', fileContent, 'utf8');
console.log('Successfully wrote apispec_1.json route.ts');

import spec from "./spec.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(JSON.stringify(spec), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

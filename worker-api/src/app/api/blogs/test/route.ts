import { handleOptions, jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  return jsonResponse(
    { message: "Blogs blueprint is working!" },
    200,
    request,
  );
}

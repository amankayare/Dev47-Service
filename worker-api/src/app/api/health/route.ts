export async function GET(): Promise<Response> {
  return Response.json({
    status: "ok",
    message: "Portfolio API is running!",
  });
}

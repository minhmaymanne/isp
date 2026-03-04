export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return Response.json({
        message: "ISP API is running",
        version: "1.0.0",
        endpoints: ["/", "/health"],
      });
    }

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  },
};

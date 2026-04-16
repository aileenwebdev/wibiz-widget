/**
 * Middleware: validate the incoming Bearer token against WIBIZ_API_KEY.
 * Used to protect the subscriber webhook endpoint that Wibiz calls.
 */
function bearerAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ error: "Missing Authorization header." });
  }

  if (token !== process.env.WIBIZ_API_KEY) {
    return res.status(401).json({ error: "Invalid API key." });
  }

  next();
}

module.exports = bearerAuth;

import crypto from "crypto";

// Function to generate a random API key
function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

export default generateApiKey;

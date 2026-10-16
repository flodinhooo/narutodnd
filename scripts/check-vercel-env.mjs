const errors = [];
try {
  const url = new URL(process.env.DATABASE_URL || "");
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
} catch {
  errors.push("DATABASE_URL must contain the PostgreSQL connection URL.");
}
const secret = process.env.CAMPAIGN_ACCESS_LOOKUP_SECRET?.trim();
if (!secret || secret === "replace-with-a-long-random-secret") {
  errors.push("CAMPAIGN_ACCESS_LOOKUP_SECRET must contain a private random secret; campaign creation and login require it.");
}
if (errors.length) {
  console.error("Vercel configuration is incomplete. Set these Environment Variables for the deployment environment and redeploy:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

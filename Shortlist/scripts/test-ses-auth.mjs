import { SESClient, GetAccountSendingEnabledCommand, ListIdentitiesCommand } from "@aws-sdk/client-ses";

const client = new SESClient({
  region: process.env.AWS_REGION?.trim() || "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID?.trim() ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY?.trim() ?? "",
  },
});

async function main() {
  try {
    const enabled = await client.send(new GetAccountSendingEnabledCommand({}));
    console.log("SES sending enabled:", enabled.Enabled);
    const identities = await client.send(new ListIdentitiesCommand({}));
    console.log("Verified identities:", identities.Identities?.join(", ") || "(none)");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("SES check failed:", message);
  }
}

main();

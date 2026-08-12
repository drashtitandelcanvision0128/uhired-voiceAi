import Razorpay from "razorpay";
import { env } from "@/lib/env";

export function getRazorpayClient() {
  const keyId = env.razorpayKeyId;
  const keySecret = env.razorpayKeySecret;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are not configured.");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

import { apiPost } from "@/lib/api";

export async function confirmMerchant({ from, canonicalName }) {
  return apiPost("/v1/merchant/confirm", { from, canonicalName });
}
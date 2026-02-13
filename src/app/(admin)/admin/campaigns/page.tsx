import { getAdminCampaigns } from "@/lib/actions/admin";
import { CampaignsClient } from "./CampaignsClient";

export default async function AdminCampaignsPage() {
  const campaigns = await getAdminCampaigns();
  return <CampaignsClient campaigns={campaigns} />;
}

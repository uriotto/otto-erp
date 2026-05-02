import { notFound } from "next/navigation";
import { getProposalByToken } from "./sign-action";
import { ProposalClient } from "./proposal-client";

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await getProposalByToken(token);
  if (!proposal) notFound();

  return <ProposalClient proposal={proposal} token={token} />;
}

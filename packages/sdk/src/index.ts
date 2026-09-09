import { NFCOSClient, type NFCOSOptions } from "./client";
import { CardsResource } from "./resources/cards";
import { CampaignsResource } from "./resources/campaigns";
import { ZonesResource, BranchesResource, OrganizationsResource } from "./resources/structure";
import { AnalyticsResource } from "./resources/analytics";
import { EventsResource } from "./resources/events";
import { FeedbackResource } from "./resources/feedback";
import { WebhooksResource } from "./resources/webhooks";

export * from "./types";
export { NFCOSClient, type NFCOSOptions } from "./client";
export { autoPaginate } from "./paginate";

/**
 * SDK oficial do NFC OS.
 *
 * ```ts
 * const nfc = new NFCOS({ apiKey: process.env.NFC_API_KEY! });
 * const { data: cards } = await nfc.cards.list();
 * await nfc.campaigns.activate("cmp_123");
 * ```
 */
export class NFCOS {
  readonly cards: CardsResource;
  readonly campaigns: CampaignsResource;
  readonly zones: ZonesResource;
  readonly branches: BranchesResource;
  readonly organizations: OrganizationsResource;
  readonly analytics: AnalyticsResource;
  readonly events: EventsResource;
  readonly feedback: FeedbackResource;
  readonly webhooks: WebhooksResource;

  constructor(options: NFCOSOptions) {
    const client = new NFCOSClient(options);
    this.cards = new CardsResource(client);
    this.campaigns = new CampaignsResource(client);
    this.zones = new ZonesResource(client);
    this.branches = new BranchesResource(client);
    this.organizations = new OrganizationsResource(client);
    this.analytics = new AnalyticsResource(client);
    this.events = new EventsResource(client);
    this.feedback = new FeedbackResource(client);
    this.webhooks = new WebhooksResource(client);
  }
}

export default NFCOS;
